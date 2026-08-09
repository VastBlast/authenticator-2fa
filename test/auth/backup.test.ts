import { describe, expect, test } from 'vitest';
import {
  BackupPasswordError,
  createEncryptedBackupFile,
  createPlainOtpAuthFile,
  importEncryptedBackup,
  readPortableBackup
} from '../../src/lib/auth/backup';
import { createAccount } from '../../src/lib/auth/otp';
import { createVaultEnvelope } from '../../src/lib/auth/vaultCrypto';
import type { VaultData, VaultEnvelope } from '../../src/lib/auth/types';

const PASSWORD = 'correct horse battery staple';
const validVaultData: VaultData = {
  accounts: [],
  settings: {
    language: 'en',
    theme: 'light',
    showCountdownSeconds: false,
    hideCodes: false,
    autoPasteCodes: false,
    accountSortMode: 'manual',
    alwaysShowAllCodes: false
  }
};

describe('encrypted backup import', () => {
  test('rejects decrypted account records that do not match the account schema', async () => {
    const { envelope } = await createVaultEnvelope(
      {
        ...validVaultData,
        accounts: [
          {
            id: 'bad-account',
            label: 'Broken',
            secret: 'A'
          }
        ]
      } as unknown as VaultData,
      PASSWORD
    );

    await expect(importEncryptedBackup(backupText(envelope), PASSWORD)).rejects.toThrow(
      'Imported account is not valid.'
    );
  });

  test('rejects unsupported KDF iteration counts before decrypting', async () => {
    const { envelope } = await createVaultEnvelope(validVaultData, PASSWORD);
    const backup = backupText({
      ...envelope,
      kdf: {
        ...envelope.kdf,
        iterations: 1_000_001
      }
    });

    await expect(importEncryptedBackup(backup, PASSWORD)).rejects.toThrow(
      'Vault encryption parameters are not supported.'
    );
  });

  test('reports a wrong password as a password failure', async () => {
    const { envelope } = await createVaultEnvelope(validVaultData, PASSWORD);

    await expect(importEncryptedBackup(backupText(envelope), 'not the password')).rejects.toThrow(
      BackupPasswordError
    );
  });

  test('rejects files that are not authenticator backups', async () => {
    await expect(importEncryptedBackup('{"accounts":[]}', PASSWORD)).rejects.toThrow(
      'Backup file is not a supported encrypted authenticator backup.'
    );
  });
});

describe('encrypted backup export', () => {
  test('round-trips accounts through an encrypted backup file', async () => {
    const account = createAccount({ issuer: 'Example', label: 'alice@example.com', secret: 'JBSWY3DPEHPK3PXP' });
    const file = await createEncryptedBackupFile(
      [account],
      validVaultData.settings,
      PASSWORD,
      new Date('2026-08-09T12:00:00')
    );

    expect(file.filename).toBe('authenticator-2fa-backup-2026-08-09.json');
    const result = await importEncryptedBackup(await file.blob.text(), PASSWORD);
    expect(result.imported).toBe(1);
    expect(result.accounts[0].secret).toBe(account.secret);
  });

  test('names plain exports after the day they were taken', () => {
    const file = createPlainOtpAuthFile([], new Date('2026-01-02T00:00:00'));

    expect(file.filename).toBe('authenticator-2fa-otpauth-2026-01-02.txt');
  });
});

describe('portable backup detection', () => {
  test('recognizes an encrypted backup without its password', async () => {
    const file = await createEncryptedBackupFile([], validVaultData.settings, PASSWORD);

    expect(readPortableBackup(await file.blob.text())).toMatchObject({ version: 1 });
  });

  test.each([
    ['plain otpauth text', 'otpauth://totp/Example:alice@example.com?secret=JBSWY3DPEHPK3PXP'],
    ['unrelated json', '{"accounts":[]}'],
    ['a truncated file', '{"app":"2fa-authenticator","version":1}'],
    ['an unsupported version', '{"app":"2fa-authenticator","version":2,"vault":{}}']
  ])('ignores %s', (_label, text) => {
    expect(readPortableBackup(text)).toBeNull();
  });
});

function backupText(vault: VaultEnvelope): string {
  return JSON.stringify({
    app: '2fa-authenticator',
    version: 1,
    exportedAt: new Date(0).toISOString(),
    vault
  });
}
