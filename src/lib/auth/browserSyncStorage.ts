import { isAndroid } from '../extension/platform';

export type BrowserSyncErrorCode = 'unavailable' | 'passwordRequired' | 'invalidKey' | 'notFound' | 'quota' | 'invalidData' | 'storage';

export class BrowserSyncError extends Error {
  constructor(readonly code: BrowserSyncErrorCode) {
    super(code);
  }
}

/**
 * Whether this browser carries extension storage between devices. Firefox for
 * Android provides `storage.sync` but keeps it on the device.
 */
export async function browserSyncAvailable(): Promise<boolean> {
  return typeof chrome !== 'undefined' && Boolean(chrome.storage?.sync) && !(await isAndroid());
}

export async function readBrowserSyncItems(): Promise<Record<string, unknown>> {
  if (!(await browserSyncAvailable())) throw new BrowserSyncError('unavailable');
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(null, (items) => settle(() => resolve(items), reject));
  });
}

/** Preflight the whole batch: a large account must not leave a partial upload. */
export async function writeBrowserSyncItems(
  current: Record<string, unknown>,
  updates: Record<string, unknown>
): Promise<void> {
  if (Object.keys(updates).length === 0) return;
  if (!(await browserSyncAvailable())) throw new BrowserSyncError('unavailable');
  const combined = { ...current, ...updates };
  const sizes = Object.entries(combined).map(([key, value]) =>
    new TextEncoder().encode(key + JSON.stringify(value)).byteLength
  );
  if (sizes.length > 512 || sizes.some((size) => size > 8192) || sizes.reduce((sum, size) => sum + size, 0) > 102400) {
    throw new BrowserSyncError('quota');
  }
  await new Promise<void>((resolve, reject) => {
    chrome.storage.sync.set(updates, () => settle(resolve, reject));
  });
}

function settle(resolve: () => void, reject: (error: Error) => void): void {
  const message = chrome.runtime.lastError?.message;
  if (message) {
    reject(new BrowserSyncError(/quota|MAX_WRITE|MAX_ITEMS/i.test(message) ? 'quota' : 'storage'));
  } else {
    resolve();
  }
}
