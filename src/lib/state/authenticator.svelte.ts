import type {} from 'svelte';
import { createAccount, generateOtpCode, updateAccount } from '../auth/otp';
import {
  clearStoredVault,
  clearVaultSessionKey,
  loadStoredVault,
  loadVaultSessionKey,
  saveStoredVault,
  saveVaultSessionKey
} from '../auth/storage';
import {
  createVaultEnvelope,
  encryptVaultData,
  exportVaultKey,
  getVaultKeyFingerprint,
  importVaultKey,
  unlockVaultEnvelope,
  unlockVaultEnvelopeWithKey
} from '../auth/vaultCrypto';
import { createPlainVaultRecord, isEncryptedVaultRecord, isPlainVaultRecord } from '../auth/vaultRecords';
import { importEncryptedBackup } from '../auth/backup';
import { importAnyText } from '../auth/importText';
import {
  compareAccountOrder,
  mergeImportedAccounts,
  normalizeAccountOrder,
  reorderAccountsById
} from '../auth/vaultImport';
import type {
  AccountDraft,
  AppSettings,
  AuthenticatorAccount,
  ImportResult,
  OtpCode,
  PlainVaultRecord,
  StoredVault,
  VaultData,
  VaultEnvelope
} from '../auth/types';
import { DEFAULT_SETTINGS } from '../auth/types';

export class AuthenticatorVault {
  initialized = $state(false);
  hasVault = $state(false);
  locked = $state(false);
  passwordProtected = $state(false);
  busy = $state(false);
  accounts = $state.raw<AuthenticatorAccount[]>([]);
  settings = $state.raw<AppSettings>({ ...DEFAULT_SETTINGS });
  codes = $state<Record<string, OtpCode>>({});
  notice = $state('');
  error = $state('');

  private key: CryptoKey | null = null;
  private encryptedVault: VaultEnvelope | null = null;
  private plainVault: PlainVaultRecord | null = null;

  sortedAccounts = $derived.by(() => [...this.accounts].sort(compareAccountOrder));

  async initialize(): Promise<void> {
    this.busy = true;
    try {
      const stored = await loadStoredVault();
      await this.applyStoredVault(stored);
      if (!this.locked) {
        await this.refreshCodes();
      }
    } finally {
      this.initialized = true;
      this.busy = false;
    }
  }

  async create(password: string): Promise<void> {
    await this.changePassword('', password);
    if (!this.error) {
      this.notice = 'Vault password set.';
    }
  }

  async unlock(password: string): Promise<void> {
    if (!this.encryptedVault) {
      await this.initialize();
    }
    if (!this.encryptedVault) {
      this.error = 'No encrypted vault exists yet.';
      return;
    }

    this.busy = true;
    this.clearStatus();
    try {
      const unlocked = await unlockVaultEnvelope(this.encryptedVault, password);
      this.key = unlocked.key;
      this.applyUnlockedData(unlocked.data);
      this.locked = false;
      await this.saveSessionKey(unlocked.key, this.encryptedVault);
      await this.refreshCodes();
    } catch {
      this.error = 'Unlock failed. Check the password and try again.';
    } finally {
      this.busy = false;
    }
  }

  async lock(): Promise<void> {
    if (!this.passwordProtected) {
      this.notice = 'Password protection is off.';
      return;
    }

    await clearVaultSessionKey();
    this.key = null;
    this.accounts = [];
    this.codes = {};
    this.locked = true;
    this.notice = 'Vault locked.';
  }

  async addAccount(draft: AccountDraft): Promise<void> {
    const account = createAccount(draft);
    await this.mergeAccounts([account]);
  }

  async updateAccount(id: string, draft: Partial<AccountDraft>): Promise<void> {
    const index = this.accounts.findIndex((account) => account.id === id);
    if (index === -1) {
      return;
    }

    const accounts = [...this.accounts];
    accounts[index] = updateAccount(accounts[index], draft);
    await this.persistData({ accounts, settings: this.settings }, 'Account updated.');
    await this.refreshCodes();
  }

  async deleteAccount(id: string): Promise<void> {
    const accounts = this.accounts.filter((account) => account.id !== id);
    await this.persistData({ accounts, settings: this.settings }, 'Account removed.');
    await this.refreshCodes();
  }

  async reorderAccounts(orderedIds: string[]): Promise<void> {
    const accounts = reorderAccountsById(this.sortedAccounts, orderedIds);
    if (!accounts) {
      return;
    }

    await this.persistData({ accounts, settings: this.settings });
  }

  async advanceHotp(id: string): Promise<void> {
    const account = this.accounts.find((item) => item.id === id);
    if (!account || account.type !== 'hotp') {
      return;
    }
    await this.updateAccount(id, { counter: account.counter + 1 });
  }

  async importText(text: string): Promise<ImportResult> {
    const result = importAnyText(text);
    const merged = await this.mergeAccounts(result.accounts);
    return {
      ...result,
      imported: merged.imported,
      skipped: result.skipped + merged.skipped
    };
  }

  async importEncryptedBackupText(text: string, password: string): Promise<ImportResult> {
    const result = await importEncryptedBackup(text, password);
    const merged = await this.mergeAccounts(result.accounts);
    return {
      ...result,
      imported: merged.imported,
      skipped: result.skipped + merged.skipped
    };
  }

  async replaceSettings(settings: AppSettings): Promise<void> {
    await this.persistData({ accounts: this.accounts, settings }, 'Settings saved.');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    this.busy = true;
    this.clearStatus();
    try {
      const wasPasswordProtected = this.passwordProtected;
      if (this.passwordProtected) {
        if (!this.encryptedVault) {
          throw new Error('No encrypted vault exists yet.');
        }
        try {
          await unlockVaultEnvelope(this.encryptedVault, currentPassword);
        } catch {
          throw new Error('Current password is incorrect.');
        }
      }

      const data = this.getCurrentData();
      const unlocked = await createVaultEnvelope(data, newPassword);
      this.key = unlocked.key;
      this.encryptedVault = unlocked.envelope;
      this.plainVault = null;
      this.hasVault = true;
      this.passwordProtected = true;
      this.locked = false;
      await saveStoredVault(unlocked.envelope);
      await this.saveSessionKey(unlocked.key, unlocked.envelope);
      this.notice = wasPasswordProtected ? 'Vault password changed.' : 'Vault password set.';
    } catch (error) {
      this.error = getErrorMessage(error);
    } finally {
      this.busy = false;
    }
  }

  async removePassword(currentPassword: string): Promise<void> {
    if (!this.passwordProtected) {
      this.notice = 'Password protection is already off.';
      return;
    }
    if (!this.encryptedVault) {
      this.error = 'No encrypted vault exists yet.';
      return;
    }

    this.busy = true;
    this.clearStatus();
    try {
      try {
        await unlockVaultEnvelope(this.encryptedVault, currentPassword);
      } catch {
        throw new Error('Current password is incorrect.');
      }

      const plainVault = createPlainVaultRecord(this.getCurrentData(), this.plainVault);
      await saveStoredVault(plainVault);
      await clearVaultSessionKey();
      this.key = null;
      this.encryptedVault = null;
      this.plainVault = plainVault;
      this.hasVault = true;
      this.passwordProtected = false;
      this.locked = false;
      this.notice = 'Vault password removed.';
    } catch (error) {
      this.error = getErrorMessage(error);
    } finally {
      this.busy = false;
    }
  }

  async resetVault(): Promise<void> {
    this.busy = true;
    this.clearStatus();
    try {
      await clearStoredVault();
      await clearVaultSessionKey();
      this.key = null;
      this.encryptedVault = null;
      this.plainVault = null;
      this.accounts = [];
      this.codes = {};
      this.settings = { ...DEFAULT_SETTINGS };
      this.hasVault = false;
      this.passwordProtected = false;
      this.locked = false;
    } catch (error) {
      this.error = getErrorMessage(error);
    } finally {
      this.busy = false;
    }
  }

  async refreshCodes(now = Date.now()): Promise<void> {
    if (this.locked || this.accounts.length === 0) {
      this.codes = {};
      return;
    }

    const entries = await Promise.all(this.accounts.map((account) => generateOtpCode(account, now)));
    this.codes = Object.fromEntries(entries.map((entry) => [entry.accountId, entry]));
  }

  private async applyStoredVault(stored: StoredVault | null): Promise<void> {
    this.key = null;
    this.encryptedVault = null;
    this.plainVault = null;
    this.accounts = [];
    this.codes = {};
    this.settings = { ...DEFAULT_SETTINGS };
    this.hasVault = Boolean(stored);
    this.passwordProtected = false;
    this.locked = false;

    if (!stored) {
      return;
    }

    if (isPlainVaultRecord(stored)) {
      this.plainVault = stored;
      this.applyUnlockedData(stored.data);
      return;
    }

    if (!isEncryptedVaultRecord(stored)) {
      this.hasVault = false;
      return;
    }

    this.encryptedVault = stored;
    this.passwordProtected = true;
    this.locked = true;

    const sessionKey = await loadVaultSessionKey(getVaultKeyFingerprint(stored));
    if (!sessionKey) {
      return;
    }

    try {
      const key = await importVaultKey(sessionKey);
      const unlocked = await unlockVaultEnvelopeWithKey(stored, key);
      this.key = unlocked.key;
      this.applyUnlockedData(unlocked.data);
      this.locked = false;
      await this.refreshCodes();
    } catch {
      await clearVaultSessionKey();
    }
  }

  private async mergeAccounts(incoming: AuthenticatorAccount[]): Promise<{ imported: number; skipped: number }> {
    if (incoming.length === 0) {
      this.notice = 'No accounts were found to import.';
      return { imported: 0, skipped: 0 };
    }

    const merged = mergeImportedAccounts(this.accounts, incoming);
    if (merged.imported === 0) {
      this.notice = 'No new accounts were imported.';
      return { imported: 0, skipped: merged.skipped };
    }

    await this.persistData(
      { accounts: merged.accounts, settings: this.settings },
      `${merged.imported} account${merged.imported === 1 ? '' : 's'} imported.`
    );
    await this.refreshCodes();
    return { imported: merged.imported, skipped: merged.skipped };
  }

  private async persistData(data: VaultData, message?: string): Promise<void> {
    const normalizedData = normalizeVaultData(data);

    if (this.passwordProtected) {
      if (!this.key || !this.encryptedVault) {
        throw new Error('Unlock the vault before making changes.');
      }

      const envelope = await encryptVaultData(normalizedData, this.key, this.encryptedVault);
      await saveStoredVault(envelope);
      await this.saveSessionKey(this.key, envelope);
      this.encryptedVault = envelope;
      this.plainVault = null;
    } else {
      const plainVault = createPlainVaultRecord(normalizedData, this.plainVault);
      await saveStoredVault(plainVault);
      this.plainVault = plainVault;
      this.encryptedVault = null;
      this.key = null;
    }

    this.applyUnlockedData(normalizedData);
    this.hasVault = true;
    this.locked = false;
    if (message) {
      this.notice = message;
    }
  }

  private async saveSessionKey(key: CryptoKey, envelope: VaultEnvelope): Promise<void> {
    await saveVaultSessionKey(getVaultKeyFingerprint(envelope), await exportVaultKey(key));
  }

  private applyUnlockedData(data: VaultData): void {
    this.accounts = normalizeAccountOrder(data.accounts);
    this.settings = { ...DEFAULT_SETTINGS, ...data.settings };
  }

  private getCurrentData(): VaultData {
    return normalizeVaultData({
      accounts: this.accounts,
      settings: this.settings
    });
  }

  private clearStatus(): void {
    this.notice = '';
    this.error = '';
  }
}

function normalizeVaultData(data: VaultData): VaultData {
  // Browser extension storage structured-clones values, so persist plain objects
  // instead of Svelte state proxies.
  return {
    accounts: normalizeAccountOrder(data.accounts),
    settings: normalizeSettings(data.settings)
  };
}

function normalizeSettings(settings: Partial<AppSettings> | undefined): AppSettings {
  return { ...DEFAULT_SETTINGS, ...settings };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export const authenticatorVault = new AuthenticatorVault();
