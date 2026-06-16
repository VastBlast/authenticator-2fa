import { describe, expect, test, vi } from 'vitest';
import { createPlainVaultRecord, isEncryptedVaultRecord, isPlainVaultRecord } from '../../src/lib/auth/vaultRecords';
import type { StoredVault, VaultData, VaultEnvelope } from '../../src/lib/auth/types';

const vaultData: VaultData = {
  accounts: [],
  settings: {
    language: 'en',
    theme: 'light'
  }
};

describe('vault record helpers', () => {
  test('creates a plain vault record and preserves createdAt on update', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const first = createPlainVaultRecord(vaultData);

    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    const second = createPlainVaultRecord(vaultData, first);
    vi.useRealTimers();

    expect(first.format).toBe('plain');
    expect(second.createdAt).toBe(first.createdAt);
    expect(second.updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  test('classifies legacy encrypted envelopes separately from plain records', () => {
    const encrypted: VaultEnvelope = {
      version: 1,
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 310000,
        salt: 'salt'
      },
      cipher: {
        name: 'AES-GCM',
        iv: 'iv',
        data: 'data'
      },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    };
    const plain: StoredVault = createPlainVaultRecord(vaultData);

    expect(isEncryptedVaultRecord(encrypted)).toBe(true);
    expect(isEncryptedVaultRecord(plain)).toBe(false);
    expect(isPlainVaultRecord(plain)).toBe(true);
    expect(isPlainVaultRecord(encrypted)).toBe(false);
  });
});
