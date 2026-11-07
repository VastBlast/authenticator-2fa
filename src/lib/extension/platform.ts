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
