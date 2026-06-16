export interface PendingPageScan {
  status: 'ready' | 'failed';
  createdAt: string;
  dataUrl?: string;
  message?: string;
}

const PENDING_PAGE_SCAN_KEY = 'vastblast.2fa-authenticator.pending-page-scan';

export async function savePendingPageScan(scan: PendingPageScan): Promise<void> {
  const storage = getChromeStorage();
  if (storage) {
    await new Promise<void>((resolve, reject) => {
      storage.set({ [PENDING_PAGE_SCAN_KEY]: scan }, () => settleChromeCallback(resolve, reject));
    });
    return;
  }

  getLocalStorage().setItem(PENDING_PAGE_SCAN_KEY, JSON.stringify(scan));
}

export async function loadPendingPageScan(): Promise<PendingPageScan | null> {
  const storage = getChromeStorage();
  if (storage) {
    return new Promise<PendingPageScan | null>((resolve, reject) => {
      storage.get(PENDING_PAGE_SCAN_KEY, (items) => {
        settleChromeCallback(() => resolve((items[PENDING_PAGE_SCAN_KEY] as PendingPageScan | undefined) ?? null), reject);
      });
    });
  }

  const raw = getLocalStorage().getItem(PENDING_PAGE_SCAN_KEY);
  return raw ? (JSON.parse(raw) as PendingPageScan) : null;
}

export async function clearPendingPageScan(): Promise<void> {
  const storage = getChromeStorage();
  if (storage) {
    await new Promise<void>((resolve, reject) => {
      storage.remove(PENDING_PAGE_SCAN_KEY, () => settleChromeCallback(resolve, reject));
    });
    return;
  }

  getLocalStorage().removeItem(PENDING_PAGE_SCAN_KEY);
}

function getChromeStorage(): chrome.storage.LocalStorageArea | null {
  return typeof chrome !== 'undefined' && chrome.storage?.local ? chrome.storage.local : null;
}

function getLocalStorage(): Storage {
  if (typeof localStorage === 'undefined') {
    throw new Error('Persistent scan storage is unavailable.');
  }
  return localStorage;
}

function settleChromeCallback(resolve: () => void, reject: (error: Error) => void): void {
  const message = chrome.runtime.lastError?.message;
  if (message) {
    reject(new Error(message));
  } else {
    resolve();
  }
}
