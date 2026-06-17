import { beforeEach, describe, expect, test } from 'vitest';
import { loadStoredVault } from '../../src/lib/auth/storage';
import { importTextIntoStoredVault } from '../../src/lib/auth/vaultImport';
import { isPlainVaultRecord } from '../../src/lib/auth/vaultRecords';
import { AuthenticatorVault } from '../../src/lib/state/authenticator.svelte';
import { installMemoryStorage } from '../helpers/storage';

const ALICE_URI = otpAuthUri('alice@example.com');
const BOB_URI = otpAuthUri('bob@example.com');
const PASSWORD = 'correct horse battery staple';

describe('importTextIntoStoredVault', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  test('imports into an empty plain vault', async () => {
    const result = await importTextIntoStoredVault(ALICE_URI);

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);

    const stored = await loadStoredVault();
    if (!isPlainVaultRecord(stored)) {
      throw new Error('Expected a plain vault record.');
    }
    expect(stored.data.accounts).toHaveLength(1);
    expect(stored.data.accounts[0].label).toBe('alice@example.com');
    expect(stored.data.accounts[0].sortOrder).toBe(0);
  });

  test('rejects malformed JSON account imports before storage', async () => {
    const malformed = JSON.stringify({
      accounts: [
        {
          id: 'bad-account',
          label: 'Broken',
          secret: 'A'
        }
      ]
    });

    await expect(importTextIntoStoredVault(malformed)).rejects.toThrow('Imported account is not valid.');
    expect(await loadStoredVault()).toBeNull();
  });

  test('reports duplicates without rewriting account order', async () => {
    await importTextIntoStoredVault(ALICE_URI);

    const duplicate = await importTextIntoStoredVault(ALICE_URI);

    expect(duplicate.imported).toBe(0);
    expect(duplicate.skipped).toBe(1);

    const stored = await loadStoredVault();
    if (!isPlainVaultRecord(stored)) {
      throw new Error('Expected a plain vault record.');
    }
    expect(stored.data.accounts).toHaveLength(1);
    expect(stored.data.accounts[0].sortOrder).toBe(0);
  });

  test('imports into an encrypted vault while the session key is available', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(ALICE_URI);
    await vault.changePassword('', PASSWORD);

    const result = await importTextIntoStoredVault(BOB_URI);

    expect(result.imported).toBe(1);

    const reopened = new AuthenticatorVault();
    await reopened.initialize();
    expect(reopened.locked).toBe(false);
    expect(reopened.passwordProtected).toBe(true);
    expect(reopened.sortedAccounts.map((account) => account.label)).toEqual([
      'alice@example.com',
      'bob@example.com'
    ]);
  });

  test('rejects encrypted imports after the vault is manually locked', async () => {
    const vault = new AuthenticatorVault();
    await vault.initialize();
    await vault.importText(ALICE_URI);
    await vault.changePassword('', PASSWORD);
    await vault.lock();

    await expect(importTextIntoStoredVault(BOB_URI)).rejects.toThrow(
      'Unlock the vault before importing the scanned QR code.'
    );
  });
});

function otpAuthUri(label: string): string {
  return `otpauth://totp/${encodeURIComponent(`Example:${label}`)}?secret=JBSWY3DPEHPK3PXP&issuer=Example`;
}
