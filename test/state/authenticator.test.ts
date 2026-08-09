import { beforeEach, describe, expect, test, vi } from 'vitest';
import { loadStoredVault, saveStoredVault } from '../../src/lib/auth/storage';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type AuthenticatorAccount
} from '../../src/lib/auth/types';
import {
  createPlainVaultRecord,
  isEncryptedVaultRecord,
  isPlainVaultRecord
} from '../../src/lib/auth/vaultRecords';
import { AuthenticatorVault } from '../../src/lib/state/authenticator.svelte';
import { installMemoryStorage, installStructuredCloneChromeStorage } from '../helpers/storage';

const OTPAUTH_URI = otpAuthUri('alice@example.com');
const BOB_URI = otpAuthUri('bob@example.com');
const CAROL_URI = otpAuthUri('carol@example.com');
const DANA_URI = otpAuthUri('dana@example.com');
const MULTI_IMPORT = [OTPAUTH_URI, BOB_URI, CAROL_URI].join('\n');
const PASSWORD = 'correct horse battery staple';

describe('AuthenticatorVault persistence and locking', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  test('starts unlocked without a password and persists imported accounts as a plain vault', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();

    expect(vault.locked).toBe(false);
    expect(vault.passwordProtected).toBe(false);
    expect(vault.hasVault).toBe(false);

    const result = await vault.importText(OTPAUTH_URI);

    expect(result.imported).toBe(1);
    expect(vault.error).toBe('');
    expect(vault.notice).toBe('1 account imported.');
    expect(vault.accounts).toHaveLength(1);
    expect(vault.locked).toBe(false);
    expect(vault.passwordProtected).toBe(false);

    const stored = await loadStoredVault();
    expect(isPlainVaultRecord(stored)).toBe(true);

    const reopened = new AuthenticatorVault();
    await reopened.initialize();

    expect(reopened.locked).toBe(false);
    expect(reopened.passwordProtected).toBe(false);
    expect(reopened.accounts).toHaveLength(1);
    expect(reopened.accounts[0].label).toBe('alice@example.com');
  });

  test('starts a new vault in the browser UI language', async () => {
    Object.defineProperty(globalThis, 'chrome', {
      configurable: true,
      value: { i18n: { getUILanguage: () => 'fr-CA' } }
    });

    const vault = new AuthenticatorVault();
    await vault.initialize();

    expect(vault.settings.language).toBe('fr');
    expect(await loadStoredVault()).toBeNull();

    await vault.importText(OTPAUTH_URI);
    const reopened = new AuthenticatorVault();
    await reopened.initialize();

    expect(reopened.settings.language).toBe('fr');
  });

  test('failed plain persistence does not leave a fake imported account in memory', async () => {
    const { localStorage } = installMemoryStorage();
    const vault = new AuthenticatorVault();
    await vault.initialize();
    localStorage.setItem = () => {
      throw new Error('storage failed');
    };

    await expect(vault.importText(OTPAUTH_URI)).rejects.toThrow('storage failed');

    expect(vault.accounts).toHaveLength(0);
    expect(vault.hasVault).toBe(false);
    expect(vault.locked).toBe(false);
  });

  test('duplicate imports do not rewrite the vault or report a new import', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);

    const duplicate = await vault.importText(OTPAUTH_URI);

    expect(duplicate.imported).toBe(0);
    expect(duplicate.skipped).toBe(1);
    expect(vault.accounts).toHaveLength(1);
    expect(vault.notice).toBe('No new accounts were imported.');
  });

  test('assigns imported accounts a stable manual order', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();

    await vault.importText(MULTI_IMPORT);

    expect(accountLabels(vault.sortedAccounts)).toEqual([
      'alice@example.com',
      'bob@example.com',
      'carol@example.com'
    ]);
    expect(vault.sortedAccounts.map((account) => account.sortOrder)).toEqual([0, 1, 2]);

    const stored = await loadStoredVault();
    if (!isPlainVaultRecord(stored)) {
      throw new Error('Expected a plain vault record.');
    }
    expect(stored.data.accounts.map((account) => account.sortOrder)).toEqual([0, 1, 2]);
  });

  test('reorders accounts and restores that order after reopening', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(MULTI_IMPORT);
    await vault.updateSettings({ accountSortMode: 'manual' });
    const noticeBeforeReorder = vault.notice;

    const byLabel = accountsByLabel(vault.sortedAccounts);
    await vault.reorderAccounts([
      byLabel.get('carol@example.com')?.id ?? '',
      byLabel.get('alice@example.com')?.id ?? '',
      byLabel.get('bob@example.com')?.id ?? ''
    ]);

    expect(vault.notice).toBe(noticeBeforeReorder);
    expect(accountLabels(vault.sortedAccounts)).toEqual([
      'carol@example.com',
      'alice@example.com',
      'bob@example.com'
    ]);
    expect(vault.sortedAccounts.map((account) => account.sortOrder)).toEqual([0, 1, 2]);

    const reopened = new AuthenticatorVault();
    await reopened.initialize();

    expect(accountLabels(reopened.sortedAccounts)).toEqual([
      'carol@example.com',
      'alice@example.com',
      'bob@example.com'
    ]);
  });

  test('reorders accounts using structured-clone storage', async () => {
    installStructuredCloneChromeStorage();
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(MULTI_IMPORT);
    await vault.updateSettings({ accountSortMode: 'manual' });

    const byLabel = accountsByLabel(vault.sortedAccounts);
    await vault.reorderAccounts([
      byLabel.get('carol@example.com')?.id ?? '',
      byLabel.get('alice@example.com')?.id ?? '',
      byLabel.get('bob@example.com')?.id ?? ''
    ]);

    expect(accountLabels(vault.sortedAccounts)).toEqual([
      'carol@example.com',
      'alice@example.com',
      'bob@example.com'
    ]);
  });

  test('ignores incomplete, duplicate, or unknown reorder requests', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(MULTI_IMPORT);
    await vault.updateSettings({ accountSortMode: 'manual' });
    const originalIds = vault.sortedAccounts.map((account) => account.id);

    await vault.reorderAccounts([originalIds[1], originalIds[0]]);
    expect(vault.sortedAccounts.map((account) => account.id)).toEqual(originalIds);

    await vault.reorderAccounts([originalIds[1], originalIds[1], originalIds[2]]);
    expect(vault.sortedAccounts.map((account) => account.id)).toEqual(originalIds);

    await vault.reorderAccounts([originalIds[1], originalIds[0], 'missing-account']);
    expect(vault.sortedAccounts.map((account) => account.id)).toEqual(originalIds);
  });

  test('appends newly imported accounts after the current manual order', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(MULTI_IMPORT);
    await vault.updateSettings({ accountSortMode: 'manual' });

    const byLabel = accountsByLabel(vault.sortedAccounts);
    await vault.reorderAccounts([
      byLabel.get('carol@example.com')?.id ?? '',
      byLabel.get('alice@example.com')?.id ?? '',
      byLabel.get('bob@example.com')?.id ?? ''
    ]);
    await vault.importText(DANA_URI);

    expect(accountLabels(vault.sortedAccounts)).toEqual([
      'carol@example.com',
      'alice@example.com',
      'bob@example.com',
      'dana@example.com'
    ]);
    expect(vault.sortedAccounts.map((account) => account.sortOrder)).toEqual([0, 1, 2, 3]);
  });

  test('settings persist without enabling password protection', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();

    expect(vault.settings.theme).toBe('system');
    expect(vault.settings.hideCodes).toBe(false);
    expect(vault.settings.alwaysShowAllCodes).toBe(false);

    await vault.updateSettings({
      language: 'fr',
      theme: 'dark',
      showCountdownSeconds: true,
      hideCodes: true,
      autoPasteCodes: true,
      accountSortMode: 'contextual',
      alwaysShowAllCodes: true
    });

    expect(vault.hasVault).toBe(true);
    expect(vault.passwordProtected).toBe(false);
    expect(vault.locked).toBe(false);

    const reopened = new AuthenticatorVault();
    await reopened.initialize();

    expect(reopened.settings.language).toBe('fr');
    expect(reopened.settings.theme).toBe('dark');
    expect(reopened.settings.showCountdownSeconds).toBe(true);
    expect(reopened.settings.hideCodes).toBe(true);
    expect(reopened.settings.autoPasteCodes).toBe(true);
    expect(reopened.settings.accountSortMode).toBe('contextual');
    expect(reopened.settings.alwaysShowAllCodes).toBe(true);
  });

  test('applies defaults to legacy settings without newer preferences', async () => {
    await saveStoredVault(
      createPlainVaultRecord({
        accounts: [],
        settings: {
          language: 'en',
          theme: 'system',
          showCountdownSeconds: false,
          autoPasteCodes: false
        } as AppSettings
      })
    );

    const vault = new AuthenticatorVault();
    await vault.initialize();

    expect(vault.settings.accountSortMode).toBe('contextual');
    expect(vault.settings.hideCodes).toBe(false);
    expect(vault.settings.alwaysShowAllCodes).toBe(false);
  });

  test('normalizes regional and unsupported stored language values', async () => {
    await saveStoredVault(
      createPlainVaultRecord({
        accounts: [],
        settings: { ...DEFAULT_SETTINGS, language: 'de-DE' }
      })
    );

    const regional = new AuthenticatorVault();
    await regional.initialize();
    expect(regional.settings.language).toBe('de');

    await regional.updateSettings({ language: 'not-supported' });
    expect(regional.settings.language).toBe('en');
  });

  test('merges concurrent settings updates without losing changes', async () => {
    installStructuredCloneChromeStorage();
    const vault = new AuthenticatorVault();
    await vault.initialize();

    await Promise.all([
      vault.updateSettings({ theme: 'dark' }),
      vault.updateSettings({ showCountdownSeconds: true }),
      vault.updateSettings({ accountSortMode: 'contextual' }),
      vault.updateSettings({ hideCodes: true }),
      vault.updateSettings({ alwaysShowAllCodes: true })
    ]);
    await Promise.all([
      vault.updateSettings({ autoPasteCodes: true }),
      vault.updateSettings({ autoPasteCodes: false }),
      vault.updateSettings({ autoPasteCodes: true })
    ]);

    expect(vault.settings.theme).toBe('dark');
    expect(vault.settings.showCountdownSeconds).toBe(true);
    expect(vault.settings.hideCodes).toBe(true);
    expect(vault.settings.accountSortMode).toBe('contextual');
    expect(vault.settings.autoPasteCodes).toBe(true);
    expect(vault.settings.alwaysShowAllCodes).toBe(true);

    const reopened = new AuthenticatorVault();
    await reopened.initialize();
    expect(reopened.settings.theme).toBe('dark');
    expect(reopened.settings.showCountdownSeconds).toBe(true);
    expect(reopened.settings.hideCodes).toBe(true);
    expect(reopened.settings.accountSortMode).toBe('contextual');
    expect(reopened.settings.autoPasteCodes).toBe(true);
    expect(reopened.settings.alwaysShowAllCodes).toBe(true);
  });

  test('finishes a pending settings write before resetting the vault', async () => {
    installStructuredCloneChromeStorage({ localWriteDelayMs: 10 });
    const vault = new AuthenticatorVault();
    await vault.initialize();

    const settingsWrite = vault.updateSettings({ theme: 'dark' });
    const reset = vault.resetVault();
    await Promise.all([settingsWrite, reset]);

    expect(vault.hasVault).toBe(false);
    expect(vault.settings).toEqual({
      language: 'en',
      theme: 'system',
      showCountdownSeconds: false,
      hideCodes: false,
      autoPasteCodes: false,
      accountSortMode: 'contextual',
      alwaysShowAllCodes: false
    });
    expect(await loadStoredVault()).toBeNull();
  });

  test('finishes a pending encrypted settings write before locking', async () => {
    installStructuredCloneChromeStorage({ localWriteDelayMs: 10 });
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.changePassword('', PASSWORD);

    const settingsWrite = vault.updateSettings({ theme: 'dark' });
    const lock = vault.lock();
    await Promise.all([settingsWrite, lock]);

    expect(vault.locked).toBe(true);
    expect(vault.accounts).toHaveLength(0);

    const reopened = new AuthenticatorVault();
    await reopened.initialize();
    expect(reopened.locked).toBe(true);
    await reopened.unlock(PASSWORD);
    expect(reopened.settings.theme).toBe('dark');
  });

  test('serializes unlock and lock in invocation order', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.changePassword('', PASSWORD);
    await vault.lock();

    await Promise.all([vault.unlock(PASSWORD), vault.lock()]);

    expect(vault.locked).toBe(true);
    expect(vault.accounts).toHaveLength(0);
    const reopened = new AuthenticatorVault();
    await reopened.initialize();
    expect(reopened.locked).toBe(true);
  });

  test('preserves manual order while contextual sorting is enabled', async () => {
    installStructuredCloneChromeStorage();
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(MULTI_IMPORT);
    await vault.updateSettings({ accountSortMode: 'manual' });

    const byLabel = accountsByLabel(vault.sortedAccounts);
    await vault.reorderAccounts([
      byLabel.get('carol@example.com')?.id ?? '',
      byLabel.get('alice@example.com')?.id ?? '',
      byLabel.get('bob@example.com')?.id ?? ''
    ]);
    const manualIds = vault.sortedAccounts.map((account) => account.id);

    await vault.updateSettings({ accountSortMode: 'contextual' });
    await vault.reorderAccounts([...manualIds].reverse());

    expect(vault.sortedAccounts.map((account) => account.id)).toEqual(manualIds);

    const reopened = new AuthenticatorVault();
    await reopened.initialize();
    expect(reopened.settings.accountSortMode).toBe('contextual');
    expect(reopened.sortedAccounts.map((account) => account.id)).toEqual(manualIds);

    await reopened.updateSettings({ accountSortMode: 'manual' });
    expect(reopened.sortedAccounts.map((account) => account.id)).toEqual(manualIds);
  });

  test('enables password protection and restores unlocked state for the extension session', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.updateSettings({ accountSortMode: 'contextual' });
    await vault.changePassword('', PASSWORD);

    expect(vault.error).toBe('');
    expect(vault.locked).toBe(false);
    expect(vault.passwordProtected).toBe(true);
    expect(isEncryptedVaultRecord(await loadStoredVault())).toBe(true);

    const reopened = new AuthenticatorVault();
    await reopened.initialize();

    expect(reopened.locked).toBe(false);
    expect(reopened.passwordProtected).toBe(true);
    expect(reopened.accounts).toHaveLength(1);
    expect(reopened.settings.accountSortMode).toBe('contextual');
  });

  test('failed password setup does not switch live state to password protected', async () => {
    const { localStorage } = installMemoryStorage();
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    localStorage.setItem = () => {
      throw new Error('storage failed');
    };

    await vault.changePassword('', PASSWORD);

    expect(vault.error).toBe('storage failed');
    expect(vault.passwordProtected).toBe(false);
    expect(vault.locked).toBe(false);
    expect(vault.accounts).toHaveLength(1);
    expect(isPlainVaultRecord(await loadStoredVault())).toBe(true);
  });

  test('failed session key save keeps live state aligned with encrypted storage', async () => {
    const { sessionStorage } = installMemoryStorage();
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    sessionStorage.setItem = () => {
      throw new Error('session failed');
    };

    await vault.changePassword('', PASSWORD);

    expect(vault.error).toBe('session failed');
    expect(vault.passwordProtected).toBe(true);
    expect(vault.locked).toBe(false);
    expect(vault.accounts).toHaveLength(1);
    expect(isEncryptedVaultRecord(await loadStoredVault())).toBe(true);
  });

  test('ordinary encrypted writes do not rewrite the unchanged session key', async () => {
    const { sessionStorage } = installMemoryStorage();
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.changePassword('', PASSWORD);
    sessionStorage.setItem = () => {
      throw new Error('session failed');
    };

    await expect(vault.updateSettings({ theme: 'dark' })).resolves.toBeUndefined();

    expect(vault.settings.theme).toBe('dark');
    const reopened = new AuthenticatorVault();
    await reopened.initialize();
    expect(reopened.locked).toBe(false);
    expect(reopened.settings.theme).toBe('dark');
  });

  test('does not publish a stale code after the vault is locked', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.changePassword('', PASSWORD);

    let releaseSign = () => {};
    let markSignStarted = () => {};
    const signReleased = new Promise<void>((resolve) => (releaseSign = resolve));
    const signStarted = new Promise<void>((resolve) => (markSignStarted = resolve));
    const originalSign = crypto.subtle.sign.bind(crypto.subtle);
    const sign = vi.spyOn(crypto.subtle, 'sign').mockImplementation(async (algorithm, key, data) => {
      markSignStarted();
      await signReleased;
      return originalSign(algorithm, key, data);
    });

    const refresh = vault.refreshCodes();
    await signStarted;
    await vault.lock();
    releaseSign();
    await refresh;
    sign.mockRestore();

    expect(vault.locked).toBe(true);
    expect(vault.codes).toEqual({});
  });

  test('manual lock clears the session unlock and requires the password again', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.changePassword('', PASSWORD);

    await vault.lock();

    expect(vault.locked).toBe(true);
    expect(vault.accounts).toHaveLength(0);

    const reopened = new AuthenticatorVault();
    await reopened.initialize();

    expect(reopened.locked).toBe(true);
    expect(reopened.passwordProtected).toBe(true);
    expect(reopened.accounts).toHaveLength(0);

    await reopened.unlock(PASSWORD);

    expect(reopened.error).toBe('');
    expect(reopened.locked).toBe(false);
    expect(reopened.accounts).toHaveLength(1);
  });

  test('changing password while locked preserves encrypted vault data', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.changePassword('', PASSWORD);
    await vault.lock();

    await vault.changePassword(PASSWORD, 'new correct horse battery staple');

    expect(vault.error).toBe('');
    expect(vault.locked).toBe(false);
    expect(vault.accounts).toHaveLength(1);

    await vault.lock();
    await vault.unlock('new correct horse battery staple');

    expect(vault.error).toBe('');
    expect(vault.accounts).toHaveLength(1);
  });

  test('removing password while locked preserves vault data', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.changePassword('', PASSWORD);
    await vault.lock();

    await vault.removePassword(PASSWORD);

    expect(vault.error).toBe('');
    expect(vault.passwordProtected).toBe(false);
    expect(vault.locked).toBe(false);
    expect(vault.accounts).toHaveLength(1);
    expect(isPlainVaultRecord(await loadStoredVault())).toBe(true);
  });

  test('failed session key clear keeps live state aligned with plain storage', async () => {
    const { sessionStorage } = installMemoryStorage();
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.changePassword('', PASSWORD);
    sessionStorage.removeItem = () => {
      throw new Error('session clear failed');
    };

    await vault.removePassword(PASSWORD);

    expect(vault.error).toBe('session clear failed');
    expect(vault.passwordProtected).toBe(false);
    expect(vault.locked).toBe(false);
    expect(vault.accounts).toHaveLength(1);
    expect(isPlainVaultRecord(await loadStoredVault())).toBe(true);
  });

  test('wrong unlock password keeps encrypted vault locked and empty', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.changePassword('', PASSWORD);
    await vault.lock();

    const reopened = new AuthenticatorVault();
    await reopened.initialize();
    await reopened.unlock('wrong password');

    expect(reopened.error).toBe('Unlock failed. Check the password and try again.');
    expect(reopened.locked).toBe(true);
    expect(reopened.accounts).toHaveLength(0);
  });

  test('wrong password does not remove protection or mutate stored data', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.changePassword('', PASSWORD);

    await vault.removePassword('wrong password');

    expect(vault.error).toBe('Current password is incorrect.');
    expect(vault.passwordProtected).toBe(true);
    expect(vault.locked).toBe(false);
    expect(vault.accounts).toHaveLength(1);
    expect(isEncryptedVaultRecord(await loadStoredVault())).toBe(true);
  });

  test('removing password returns the vault to plain auto-unlocked storage', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
    await vault.changePassword('', PASSWORD);
    await vault.removePassword(PASSWORD);

    expect(vault.error).toBe('');
    expect(vault.passwordProtected).toBe(false);
    expect(vault.locked).toBe(false);
    expect(isPlainVaultRecord(await loadStoredVault())).toBe(true);

    const reopened = new AuthenticatorVault();
    await reopened.initialize();

    expect(reopened.locked).toBe(false);
    expect(reopened.passwordProtected).toBe(false);
    expect(reopened.accounts).toHaveLength(1);
  });
});

function otpAuthUri(label: string): string {
  return `otpauth://totp/${encodeURIComponent(`Example:${label}`)}?secret=JBSWY3DPEHPK3PXP&issuer=Example`;
}

function accountLabels(accounts: AuthenticatorAccount[]): string[] {
  return accounts.map((account) => account.label);
}

function accountsByLabel(accounts: AuthenticatorAccount[]): Map<string, AuthenticatorAccount> {
  return new Map(accounts.map((account) => [account.label, account]));
}
