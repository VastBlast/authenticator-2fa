import type { StoredVault } from './types';

const VAULT_KEY = 'vastblast.2fa-authenticator.vault';
const VAULT_SESSION_KEY = 'vastblast.2fa-authenticator.session-key';

export interface VaultSessionKey {
  fingerprint: string;
  key: JsonWebKey;
  savedAt: string;
}

export async function loadStoredVault(): Promise<StoredVault | null> {
  const stored = await readStorage<Record<string, StoredVault | undefined>>(VAULT_KEY);
  return stored[VAULT_KEY] ?? null;
}

export async function saveStoredVault(vault: StoredVault): Promise<void> {
  await writeStorage(getChromeStorage(), { [VAULT_KEY]: vault });
}

export async function clearStoredVault(): Promise<void> {
  await removeStorageValue(getChromeStorage(), VAULT_KEY);
}

export async function loadVaultSessionKey(fingerprint: string): Promise<JsonWebKey | null> {
  const stored = await readSessionStorage<Record<string, VaultSessionKey | undefined>>(VAULT_SESSION_KEY);
  const session = stored[VAULT_SESSION_KEY];
  return session?.fingerprint === fingerprint ? session.key : null;
}

export async function saveVaultSessionKey(fingerprint: string, key: JsonWebKey): Promise<void> {
  await writeSessionStorage({
    [VAULT_SESSION_KEY]: {
      fingerprint,
      key,
      savedAt: new Date().toISOString()
    } satisfies VaultSessionKey
  });
}

export async function clearVaultSessionKey(): Promise<void> {
  await removeStorageValue(getSessionStorage(), VAULT_SESSION_KEY);
}

async function readStorage<T extends Record<string, unknown>>(key: string): Promise<T> {
  const storage = getChromeStorage();
  if (storage) {
    return new Promise<T>((resolve, reject) => {
      storage.get(key, (items) => settleChromeCallback(() => resolve(items as T), reject));
    });
  }

  const raw = localStorage.getItem(key);
  return { [key]: raw ? JSON.parse(raw) : undefined } as T;
}

async function readSessionStorage<T extends Record<string, unknown>>(key: string): Promise<T> {
  const storage = getSessionStorage();
  if (storage) {
    return new Promise<T>((resolve, reject) => {
      storage.get(key, (items) => settleChromeCallback(() => resolve(items as T), reject));
    });
  }

  const raw = sessionStorage.getItem(key);
  return { [key]: raw ? JSON.parse(raw) : undefined } as T;
}

async function writeSessionStorage(items: Record<string, unknown>): Promise<void> {
  const storage = getSessionStorage();
  if (storage) {
    await new Promise<void>((resolve, reject) => {
      storage.set(items, () => settleChromeCallback(resolve, reject));
    });
    return;
  }

  for (const [key, value] of Object.entries(items)) {
    sessionStorage.setItem(key, JSON.stringify(value));
  }
}

async function writeStorage(
  storage: chrome.storage.StorageArea | chrome.storage.SessionStorageArea | null,
  items: Record<string, unknown>
): Promise<void> {
  if (storage) {
    await new Promise<void>((resolve, reject) => {
      storage.set(items, () => settleChromeCallback(resolve, reject));
    });
    return;
  }

  for (const [key, value] of Object.entries(items)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

async function removeStorageValue(
  storage: chrome.storage.StorageArea | chrome.storage.SessionStorageArea | null,
  key: string
): Promise<void> {
  if (storage) {
    await new Promise<void>((resolve, reject) => {
      storage.remove(key, () => settleChromeCallback(resolve, reject));
    });
    return;
  }

  localStorage.removeItem(key);
  sessionStorage.removeItem(key);
}

function getChromeStorage(): chrome.storage.LocalStorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
}

function getSessionStorage(): chrome.storage.SessionStorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.session ? chrome.storage.session : null;
}

function settleChromeCallback(resolve: () => void, reject: (error: Error) => void): void {
  const message = chrome.runtime.lastError?.message;
  if (message) {
    reject(new Error(message));
  } else {
    resolve();
  }
}
