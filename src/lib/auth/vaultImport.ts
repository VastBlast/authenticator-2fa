import { importAnyText } from './importText';
import {
  loadStoredVault,
  loadVaultSessionKey,
  saveStoredVault,
  saveVaultSessionKey
} from './storage';
import { normalizeImportedAccounts } from './otp';
import type {
  AppSettings,
  AuthenticatorAccount,
  ImportResult,
  PlainVaultRecord,
  VaultData,
  VaultEnvelope
} from './types';
import { DEFAULT_SETTINGS } from './types';
import {
  encryptVaultData,
  exportVaultKey,
  getVaultKeyFingerprint,
  importVaultKey,
  unlockVaultEnvelopeWithKey
} from './vaultCrypto';
import { createPlainVaultRecord, isEncryptedVaultRecord, isPlainVaultRecord } from './vaultRecords';

interface MergeResult {
  accounts: AuthenticatorAccount[];
  imported: number;
  skipped: number;
}

type LoadedVault =
  | {
      type: 'plain';
      data: VaultData;
      record: PlainVaultRecord | null;
    }
  | {
      type: 'encrypted';
      data: VaultData;
      envelope: VaultEnvelope;
      key: CryptoKey;
    };

export async function importTextIntoStoredVault(text: string): Promise<ImportResult> {
  const parsed = importAnyText(text);
  const loaded = await loadUnlockedStoredVault();
  const merged = mergeImportedAccounts(loaded.data.accounts, parsed.accounts);

  if (merged.imported > 0) {
    await saveLoadedVault(loaded, {
      accounts: merged.accounts,
      settings: normalizeSettings(loaded.data.settings)
    });
  }

  return {
    ...parsed,
    imported: merged.imported,
    skipped: parsed.skipped + merged.skipped
  };
}

export function getImportResultMessage(result: ImportResult): string {
  if (result.imported > 0) {
    return `${result.imported} account${result.imported === 1 ? '' : 's'} imported.`;
  }
  if (result.errors[0]) {
    return result.errors[0];
  }
  if (result.skipped > 0) {
    return 'No new account was imported. It may already exist.';
  }
  return 'No account was found to import.';
}

export function mergeImportedAccounts(
  existing: AuthenticatorAccount[],
  incoming: AuthenticatorAccount[]
): MergeResult {
  const existingAccounts = normalizeAccountOrder(existing);
  const incomingAccounts = normalizeImportedAccounts(incoming);
  const existingFingerprints = new Set(existingAccounts.map(accountFingerprint));
  const additions = incomingAccounts.filter((account) => !existingFingerprints.has(accountFingerprint(account)));

  return {
    accounts: [
      ...existingAccounts,
      ...additions.map((account, index) => ({
        ...account,
        sortOrder: existingAccounts.length + index
      }))
    ],
    imported: additions.length,
    skipped: incomingAccounts.length - additions.length
  };
}

export function normalizeAccountOrder(accounts: AuthenticatorAccount[]): AuthenticatorAccount[] {
  const indexedAccounts = accounts.map((account, index) => ({ account, index }));
  const hasSortOrder = indexedAccounts.some(({ account }) => isSortOrder(account.sortOrder));
  const orderedAccounts = hasSortOrder
    ? [...indexedAccounts].sort(
        (left, right) =>
          getSortOrder(left.account) - getSortOrder(right.account) || left.index - right.index
      )
    : indexedAccounts;

  return orderedAccounts.map(({ account }, index) => ({
    ...account,
    sortOrder: index
  }));
}

export function reorderAccountsById(
  accounts: AuthenticatorAccount[],
  orderedIds: string[]
): AuthenticatorAccount[] | null {
  if (accounts.length !== orderedIds.length || new Set(orderedIds).size !== orderedIds.length) {
    return null;
  }

  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const reordered = orderedIds.map((id) => accountsById.get(id));
  if (reordered.some((account) => !account)) {
    return null;
  }

  const currentIds = accounts.map((account) => account.id);
  if (orderedIds.every((id, index) => id === currentIds[index])) {
    return null;
  }

  return reordered.map((account, index) => ({
    ...(account as AuthenticatorAccount),
    sortOrder: index
  }));
}

export function compareAccountOrder(
  left: AuthenticatorAccount,
  right: AuthenticatorAccount
): number {
  return (
    getSortOrder(left) - getSortOrder(right) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.issuer.localeCompare(right.issuer) ||
    left.label.localeCompare(right.label)
  );
}

async function loadUnlockedStoredVault(): Promise<LoadedVault> {
  const stored = await loadStoredVault();
  if (!stored) {
    return {
      type: 'plain',
      data: { accounts: [], settings: { ...DEFAULT_SETTINGS } },
      record: null
    };
  }

  if (isPlainVaultRecord(stored)) {
    return {
      type: 'plain',
      data: {
        accounts: normalizeAccountOrder(stored.data.accounts),
        settings: normalizeSettings(stored.data.settings)
      },
      record: stored
    };
  }

  if (!isEncryptedVaultRecord(stored)) {
    throw new Error('Stored vault is not readable.');
  }

  const sessionKey = await loadVaultSessionKey(getVaultKeyFingerprint(stored));
  if (!sessionKey) {
    throw new Error('Unlock the vault before importing the scanned QR code.');
  }

  const key = await importVaultKey(sessionKey);
  const unlocked = await unlockVaultEnvelopeWithKey(stored, key);
  return {
    type: 'encrypted',
    data: {
      accounts: normalizeAccountOrder(unlocked.data.accounts),
      settings: normalizeSettings(unlocked.data.settings)
    },
    envelope: stored,
    key
  };
}

async function saveLoadedVault(loaded: LoadedVault, data: VaultData): Promise<void> {
  const normalizedData = {
    accounts: normalizeAccountOrder(data.accounts),
    settings: normalizeSettings(data.settings)
  };

  if (loaded.type === 'encrypted') {
    const envelope = await encryptVaultData(normalizedData, loaded.key, loaded.envelope);
    await saveStoredVault(envelope);
    await saveVaultSessionKey(getVaultKeyFingerprint(envelope), await exportVaultKey(loaded.key));
    return;
  }

  await saveStoredVault(createPlainVaultRecord(normalizedData, loaded.record));
}

function normalizeSettings(settings: Partial<AppSettings> | undefined): AppSettings {
  return { ...DEFAULT_SETTINGS, ...settings };
}

function getSortOrder(account: AuthenticatorAccount): number {
  return isSortOrder(account.sortOrder) ? account.sortOrder : Number.POSITIVE_INFINITY;
}

function isSortOrder(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function accountFingerprint(account: AuthenticatorAccount): string {
  return [
    account.type,
    account.issuer.trim().toLowerCase(),
    account.label.trim().toLowerCase(),
    account.secret.trim().toUpperCase()
  ].join('\u001f');
}
