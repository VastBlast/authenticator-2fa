import { createVaultEnvelope, unlockVaultEnvelope } from './vaultCrypto';
import { exportOtpAuthText } from './otpauth';
import { importAnyText } from './importText';
import { normalizeImportedAccounts } from './otp';
import type { AppSettings, AuthenticatorAccount, ImportResult, VaultEnvelope } from './types';

export { importAnyText };

export interface PortableBackup {
  app: '2fa-authenticator';
  version: 1;
  exportedAt: string;
  vault: VaultEnvelope;
}

export function exportPlainOtpAuth(accounts: AuthenticatorAccount[]): Blob {
  return new Blob([exportOtpAuthText(accounts)], { type: 'text/plain;charset=utf-8' });
}

export async function exportEncryptedBackup(
  accounts: AuthenticatorAccount[],
  settings: AppSettings,
  password: string
): Promise<Blob> {
  const { envelope } = await createVaultEnvelope({ accounts, settings }, password);
  const backup: PortableBackup = {
    app: '2fa-authenticator',
    version: 1,
    exportedAt: new Date().toISOString(),
    vault: envelope
  };

  return new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' });
}

export async function importEncryptedBackup(fileText: string, password: string): Promise<ImportResult> {
  const parsed = JSON.parse(fileText) as Partial<PortableBackup>;
  if (parsed.app !== '2fa-authenticator' || parsed.version !== 1 || !parsed.vault) {
    throw new Error('Backup file is not a supported encrypted authenticator backup.');
  }

  const unlocked = await unlockVaultEnvelope(parsed.vault, password);
  const accounts = normalizeImportedAccounts(unlocked.data.accounts);
  return {
    accounts,
    imported: accounts.length,
    skipped: 0,
    errors: []
  };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noreferrer';
  anchor.click();
  URL.revokeObjectURL(url);
}
