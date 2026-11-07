/** Firefox-only runtime API, which the `chrome` typings leave out. */
interface BrowserInfoRuntime {
  getBrowserInfo(callback: (info: { version: string }) => void): void;
}

/** Whether the extension runs in a browser on Android. */
export function isAndroid(): Promise<boolean> {
  if (typeof chrome === 'undefined' || typeof chrome.runtime?.getPlatformInfo !== 'function') {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    chrome.runtime.getPlatformInfo((info) => {
      resolve(!chrome.runtime.lastError && info.os === 'android');
    });
  });
}

/** Major version of Firefox, or of a browser built on it, when the extension runs in one. */
export function getFirefoxVersion(): Promise<number | undefined> {
  const runtime = (typeof chrome === 'undefined' ? undefined : chrome.runtime) as
    | Partial<BrowserInfoRuntime>
    | undefined;
  const getBrowserInfo = runtime?.getBrowserInfo?.bind(runtime);
  if (!getBrowserInfo) {
    return Promise.resolve(undefined);
  }

  return new Promise((resolve) => {
    getBrowserInfo((info) => {
      const version = chrome.runtime.lastError ? NaN : Number.parseInt(info.version, 10);
      resolve(Number.isSafeInteger(version) ? version : undefined);
    });
  });
}
