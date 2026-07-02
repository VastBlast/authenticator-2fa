import { describe, expect, test } from 'vitest';
import { importEncryptedBackup } from '../../src/lib/auth/backup';
import { createVaultEnvelope } from '../../src/lib/auth/vaultCrypto';
import type { VaultData, VaultEnvelope } from '../../src/lib/auth/types';

const PASSWORD = 'correct horse battery staple';
const validVaultData: VaultData = {
  accounts: [],
  settings: {
    language: 'en',
    theme: 'light',
    showCountdownSeconds: false,
    autoPasteCodes: false
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
});

function backupText(vault: VaultEnvelope): string {
  return JSON.stringify({
    app: '2fa-authenticator',
    version: 1,
    exportedAt: new Date(0).toISOString(),
    vault
  });
}
