import { base64ToBytes, bytesToBase64 } from './base32';
import type { VaultData, VaultEnvelope } from './types';

const KDF_ITERATIONS = 310_000;
const MIN_KDF_ITERATIONS = 100_000;
const MAX_KDF_ITERATIONS = 1_000_000;
const VAULT_PARAMETERS_ERROR = 'Vault encryption parameters are not supported.';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface UnlockedVault {
  data: VaultData;
  key: CryptoKey;
}

export async function createVaultEnvelope(data: VaultData, password: string): Promise<UnlockedVault & {
  envelope: VaultEnvelope;
}> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(password, salt);
  const now = new Date().toISOString();
  const envelope = await encryptVaultData(data, key, {
    createdAt: now,
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: KDF_ITERATIONS,
      salt: bytesToBase64(salt)
    }
  });

  return { data, key, envelope };
}

export async function unlockVaultEnvelope(
  envelope: VaultEnvelope,
  password: string
): Promise<UnlockedVault> {
  const salt = readSupportedKdfSalt(envelope);
  const key = await deriveKey(password, salt, envelope.kdf.iterations);
  const data = await decryptVaultData(envelope, key);

  return { key, data };
}

export async function unlockVaultEnvelopeWithKey(
  envelope: VaultEnvelope,
  key: CryptoKey
): Promise<UnlockedVault> {
  const data = await decryptVaultData(envelope, key);

  return { key, data };
}

export async function exportVaultKey(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

export async function importVaultKey(key: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', key, { name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt'
  ]);
}

export function getVaultKeyFingerprint(envelope: VaultEnvelope): string {
  return [
    envelope.version,
    envelope.createdAt,
    envelope.kdf.name,
    envelope.kdf.hash,
    envelope.kdf.iterations,
    envelope.kdf.salt
  ].join(':');
}

async function decryptVaultData(envelope: VaultEnvelope, key: CryptoKey): Promise<VaultData> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(base64ToBytes(envelope.cipher.iv)) },
    key,
    toArrayBuffer(base64ToBytes(envelope.cipher.data))
  );

  return JSON.parse(decoder.decode(plaintext)) as VaultData;
}

export async function encryptVaultData(
  data: VaultData,
  key: CryptoKey,
  metadata: Pick<VaultEnvelope, 'createdAt' | 'kdf'>
): Promise<VaultEnvelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(JSON.stringify(data))
  );
  const now = new Date().toISOString();

  return {
    version: 1,
    kdf: metadata.kdf,
    cipher: {
      name: 'AES-GCM',
      iv: bytesToBase64(iv),
      data: bytesToBase64(new Uint8Array(ciphertext))
    },
    createdAt: metadata.createdAt,
    updatedAt: now
  };
}

async function deriveKey(password: string, salt: Uint8Array, iterations = KDF_ITERATIONS): Promise<CryptoKey> {
  if (password.length < 8) {
    throw new Error('Vault password must be at least 8 characters.');
  }

  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveKey'
  ]);

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function readSupportedKdfSalt(envelope: VaultEnvelope): Uint8Array {
  if (
    typeof envelope !== 'object' ||
    envelope === null ||
    Array.isArray(envelope) ||
    envelope.version !== 1 ||
    typeof envelope.kdf !== 'object' ||
    envelope.kdf === null ||
    Array.isArray(envelope.kdf)
  ) {
    throw new Error(VAULT_PARAMETERS_ERROR);
  }

  const { kdf } = envelope;
  if (
    kdf.name !== 'PBKDF2' ||
    kdf.hash !== 'SHA-256' ||
    !Number.isInteger(kdf.iterations) ||
    kdf.iterations < MIN_KDF_ITERATIONS ||
    kdf.iterations > MAX_KDF_ITERATIONS ||
    typeof kdf.salt !== 'string'
  ) {
    throw new Error(VAULT_PARAMETERS_ERROR);
  }

  try {
    const salt = base64ToBytes(kdf.salt);
    if (salt.length !== 16) {
      throw new Error(VAULT_PARAMETERS_ERROR);
    }
    return salt;
  } catch {
    throw new Error(VAULT_PARAMETERS_ERROR);
  }
}
