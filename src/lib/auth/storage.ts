import type { VaultEnvelope } from './types';

const VAULT_KEY = 'vastblast.2fa-authenticator.vault';

export async function loadVaultEnvelope(): Promise<VaultEnvelope | null> {
  const stored = await readStorage<Record<string, VaultEnvelope | undefined>>(VAULT_KEY);
  return stored[VAULT_KEY] ?? null;
}

export async function saveVaultEnvelope(envelope: VaultEnvelope): Promise<void> {
  await writeStorage({ [VAULT_KEY]: envelope });
}

export async function clearVaultEnvelope(): Promise<void> {
  const storage = getChromeStorage();
  if (storage) {
    await new Promise<void>((resolve, reject) => {
      storage.remove(VAULT_KEY, () => settleChromeCallback(resolve, reject));
    });
    return;
  }

  localStorage.removeItem(VAULT_KEY);
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

async function writeStorage(items: Record<string, unknown>): Promise<void> {
  const storage = getChromeStorage();
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

function getChromeStorage(): chrome.storage.LocalStorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
}

function settleChromeCallback(resolve: () => void, reject: (error: Error) => void): void {
  const message = chrome.runtime.lastError?.message;
  if (message) {
    reject(new Error(message));
  } else {
    resolve();
  }
}
