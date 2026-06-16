import type { PlainVaultRecord, StoredVault, VaultData, VaultEnvelope } from './types';

export function isEncryptedVaultRecord(record: StoredVault | null): record is VaultEnvelope {
  return Boolean(record && 'cipher' in record && 'kdf' in record);
}

export function isPlainVaultRecord(record: StoredVault | null): record is PlainVaultRecord {
  return Boolean(record && 'format' in record && record.format === 'plain');
}

export function createPlainVaultRecord(
  data: VaultData,
  previous?: PlainVaultRecord | null
): PlainVaultRecord {
  const now = new Date().toISOString();
  return {
    version: 1,
    format: 'plain',
    data,
    createdAt: previous?.createdAt ?? now,
    updatedAt: now
  };
}
