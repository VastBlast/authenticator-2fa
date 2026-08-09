import { createVaultEnvelope, unlockVaultEnvelope, VAULT_PARAMETERS_ERROR } from './vaultCrypto';
import { exportOtpAuthText } from './otpauth';
import { importAnyText } from './importText';
import { normalizeImportedAccounts } from './otp';
import type { AppSettings, AuthenticatorAccount, ImportResult, VaultEnvelope } from './types';

export { importAnyText };

const BACKUP_APP = '2fa-authenticator';
const BACKUP_VERSION = 1;
const UNSUPPORTED_BACKUP_ERROR = 'Backup file is not a supported encrypted authenticator backup.';

export interface PortableBackup {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  vault: VaultEnvelope;
}

/** A ready-to-download export. */
export interface BackupFile {
  blob: Blob;
  filename: string;
}

/** Raised when an encrypted backup cannot be opened with the supplied password. */
export class BackupPasswordError extends Error {
  constructor() {
    super('Backup password is incorrect.');
    this.name = 'BackupPasswordError';
  }
}

export function createPlainOtpAuthFile(
  accounts: AuthenticatorAccount[],
  exportedAt = new Date()
): BackupFile {
  return {
    blob: new Blob([exportOtpAuthText(accounts)], { type: 'text/plain;charset=utf-8' }),
    filename: getBackupFileName('otpauth', 'txt', exportedAt)
  };
}

export async function createEncryptedBackupFile(
  accounts: AuthenticatorAccount[],
  settings: AppSettings,
  password: string,
  exportedAt = new Date()
): Promise<BackupFile> {
  const { envelope } = await createVaultEnvelope({ accounts, settings }, password);
  const backup: PortableBackup = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: exportedAt.toISOString(),
    vault: envelope
  };

  return {
    blob: new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' }),
    filename: getBackupFileName('backup', 'json', exportedAt)
  };
}

/** Encrypted vault carried by a portable backup, or `null` for any other text. */
export function readPortableBackup(text: string): VaultEnvelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const backup = parsed as Partial<PortableBackup> | null;
  const isPortableBackup =
    typeof backup === 'object' &&
    backup !== null &&
    backup.app === BACKUP_APP &&
    backup.version === BACKUP_VERSION &&
    typeof backup.vault === 'object' &&
    backup.vault !== null;

  return isPortableBackup ? (backup.vault as VaultEnvelope) : null;
}

export async function importEncryptedBackup(
  fileText: string,
  password: string
): Promise<ImportResult> {
  const vault = readPortableBackup(fileText);
  if (!vault) {
    throw new Error(UNSUPPORTED_BACKUP_ERROR);
  }

  let unlocked;
  try {
    unlocked = await unlockVaultEnvelope(vault, password);
  } catch (error) {
    // Unsupported envelopes are a property of the file, so they are reported as
    // they are. Everything else here means the password could not open it.
    if (error instanceof Error && error.message === VAULT_PARAMETERS_ERROR) {
      throw error;
    }
    throw new BackupPasswordError();
  }

  const accounts = normalizeImportedAccounts(unlocked.data.accounts);
  return {
    accounts,
    imported: accounts.length,
    skipped: 0,
    errors: []
  };
}

export function downloadFile({ blob, filename }: BackupFile): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noreferrer';
  // Anchors must be connected for the download to start in every browser, and
  // the object URL has to outlive the click that consumes it.
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getBackupFileName(kind: string, extension: string, date: Date): string {
  const stamp = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0'))
    .join('-');

  return `authenticator-2fa-${kind}-${stamp}.${extension}`;
}
