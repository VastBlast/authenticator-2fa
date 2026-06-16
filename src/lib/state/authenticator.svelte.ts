import { SvelteSet } from 'svelte/reactivity';
import { createAccount, generateOtpCode, updateAccount } from '../auth/otp';
import { clearVaultEnvelope, loadVaultEnvelope, saveVaultEnvelope } from '../auth/storage';
import { createVaultEnvelope, encryptVaultData, unlockVaultEnvelope } from '../auth/vaultCrypto';
import { importAnyText, importEncryptedBackup } from '../auth/backup';
import type {
  AccountDraft,
  AppSettings,
  AuthenticatorAccount,
  ImportResult,
  OtpCode,
  VaultEnvelope
} from '../auth/types';
import { DEFAULT_SETTINGS } from '../auth/types';

export class AuthenticatorVault {
  initialized = $state(false);
  hasVault = $state(false);
  locked = $state(true);
  busy = $state(false);
  accounts = $state.raw<AuthenticatorAccount[]>([]);
  settings = $state<AppSettings>({ ...DEFAULT_SETTINGS });
  codes = $state<Record<string, OtpCode>>({});
  notice = $state('');
  error = $state('');

  private key: CryptoKey | null = null;
  private envelope: VaultEnvelope | null = null;

  sortedAccounts = $derived.by(() =>
    [...this.accounts].sort((left, right) => {
      if (left.pinned !== right.pinned) {
        return left.pinned ? -1 : 1;
      }
      const issuerSort = left.issuer.localeCompare(right.issuer);
      return issuerSort || left.label.localeCompare(right.label);
    })
  );

  async initialize(): Promise<void> {
    this.busy = true;
    try {
      this.envelope = await loadVaultEnvelope();
      this.hasVault = Boolean(this.envelope);
      this.locked = this.hasVault;
      if (!this.hasVault) {
        this.settings = { ...DEFAULT_SETTINGS };
      }
    } finally {
      this.initialized = true;
      this.busy = false;
    }
  }

  async create(password: string): Promise<void> {
    this.busy = true;
    this.clearStatus();
    try {
      const data = { accounts: [], settings: { ...DEFAULT_SETTINGS } };
      const unlocked = await createVaultEnvelope(data, password);
      this.key = unlocked.key;
      this.envelope = unlocked.envelope;
      this.accounts = [];
      this.settings = data.settings;
      this.hasVault = true;
      this.locked = false;
      await saveVaultEnvelope(unlocked.envelope);
      this.notice = 'Vault created.';
    } catch (error) {
      this.error = getErrorMessage(error);
    } finally {
      this.busy = false;
    }
  }

  async unlock(password: string): Promise<void> {
    if (!this.envelope) {
      await this.initialize();
    }
    if (!this.envelope) {
      this.error = 'No vault exists yet.';
      return;
    }

    this.busy = true;
    this.clearStatus();
    try {
      const unlocked = await unlockVaultEnvelope(this.envelope, password);
      this.key = unlocked.key;
      this.accounts = unlocked.data.accounts;
      this.settings = { ...DEFAULT_SETTINGS, ...unlocked.data.settings };
      this.locked = false;
      await this.refreshCodes();
    } catch {
      this.error = 'Unlock failed. Check the password and try again.';
    } finally {
      this.busy = false;
    }
  }

  lock(): void {
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
    this.accounts = accounts;
    await this.persist('Account updated.');
    await this.refreshCodes();
  }

  async deleteAccount(id: string): Promise<void> {
    this.accounts = this.accounts.filter((account) => account.id !== id);
    await this.persist('Account removed.');
    await this.refreshCodes();
  }

  async togglePinned(id: string): Promise<void> {
    const account = this.accounts.find((item) => item.id === id);
    if (!account) {
      return;
    }
    await this.updateAccount(id, { pinned: !account.pinned });
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
    this.settings = settings;
    await this.persist('Settings saved.');
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    if (!this.envelope) {
      this.error = 'No vault exists yet.';
      return;
    }

    this.busy = true;
    this.clearStatus();
    try {
      try {
        await unlockVaultEnvelope(this.envelope, currentPassword);
      } catch {
        throw new Error('Current password is incorrect.');
      }

      const data = { accounts: this.accounts, settings: this.settings };
      const unlocked = await createVaultEnvelope(data, newPassword);
      this.key = unlocked.key;
      this.envelope = unlocked.envelope;
      await saveVaultEnvelope(unlocked.envelope);
      this.notice = 'Vault password changed.';
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
      await clearVaultEnvelope();
      this.key = null;
      this.envelope = null;
      this.accounts = [];
      this.codes = {};
      this.settings = { ...DEFAULT_SETTINGS };
      this.hasVault = false;
      this.locked = true;
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

  private async mergeAccounts(incoming: AuthenticatorAccount[]): Promise<{ imported: number; skipped: number }> {
    if (incoming.length === 0) {
      this.notice = 'No accounts were found to import.';
      return { imported: 0, skipped: 0 };
    }

    const existing = new SvelteSet(this.accounts.map(accountFingerprint));
    const additions = incoming.filter((account) => !existing.has(accountFingerprint(account)));
    const skipped = incoming.length - additions.length;

    if (additions.length === 0) {
      this.notice = 'No new accounts were imported.';
      return { imported: 0, skipped };
    }

    this.accounts = [...this.accounts, ...additions];
    await this.persist(`${additions.length} account${additions.length === 1 ? '' : 's'} imported.`);
    await this.refreshCodes();
    return { imported: additions.length, skipped };
  }

  private async persist(message: string): Promise<void> {
    if (!this.key || !this.envelope) {
      throw new Error('Vault is locked.');
    }

    this.envelope = await encryptVaultData(
      { accounts: this.accounts, settings: this.settings },
      this.key,
      this.envelope
    );
    await saveVaultEnvelope(this.envelope);
    this.notice = message;
  }

  private clearStatus(): void {
    this.notice = '';
    this.error = '';
  }
}

function accountFingerprint(account: AuthenticatorAccount): string {
  return [
    account.type,
    account.issuer.trim().toLowerCase(),
    account.label.trim().toLowerCase(),
    account.secret.trim().toUpperCase()
  ].join('\u001f');
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export const authenticatorVault = new AuthenticatorVault();
