import { beforeEach, describe, expect, test } from 'vitest';
import { loadStoredVault } from '../../src/lib/auth/storage';
import { isEncryptedVaultRecord, isPlainVaultRecord } from '../../src/lib/auth/vaultRecords';
import { AuthenticatorVault } from '../../src/lib/state/authenticator.svelte';
import { installMemoryStorage } from '../helpers/storage';

const OTPAUTH_URI = 'otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Example';
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

  test('settings persist without enabling password protection', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();

    await vault.replaceSettings({
      language: 'fr',
      theme: 'dark',
      copyWithSpaces: true
    });

    expect(vault.hasVault).toBe(true);
    expect(vault.passwordProtected).toBe(false);
    expect(vault.locked).toBe(false);

    const reopened = new AuthenticatorVault();
    await reopened.initialize();

    expect(reopened.settings.language).toBe('fr');
    expect(reopened.settings.theme).toBe('dark');
    expect(reopened.settings.copyWithSpaces).toBe(true);
  });

  test('enables password protection and restores unlocked state for the extension session', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(OTPAUTH_URI);
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
