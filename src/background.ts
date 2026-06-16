interface MessageResponse {
  ok: boolean;
  error?: string;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'start-page-scan') {
    respond(sendResponse, startPageScan());
    return true;
  }

  if (message?.type === 'page-scan:capture') {
    respond(sendResponse, captureSelection(sender.tab?.windowId, sender.tab?.id, message.rect));
    return true;
  }

  if (message?.type === 'page-scan:image') {
    sendRuntimeMessage({ type: 'page-scan:ready', dataUrl: message.dataUrl });
    sendResponse({ ok: true });
    return undefined;
  }

  if (message?.type === 'page-scan:failed') {
    sendRuntimeMessage({ type: 'page-scan:failed', message: message.message });
    sendResponse({ ok: true });
    return undefined;
  }

  return undefined;
});

async function startPageScan(): Promise<void> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error('No active tab is available to scan.');
  }

  if (isRestrictedPage(tab.url)) {
    throw new Error('Page scan is unavailable on browser, extension, or store pages.');
  }

  await executeScript(tab.id, 'assets/pageScanner.js');
  await sendTabMessage(tab.id, { type: 'page-scan:start' });
}

async function captureSelection(
  windowId: number | undefined,
  tabId: number | undefined,
  rect: unknown
): Promise<void> {
  if (!tabId || !isCaptureRect(rect)) {
    throw new Error('No scan area was selected.');
  }

  const dataUrl = await captureVisibleTab(windowId);
  await sendTabMessage(tabId, { type: 'page-scan:screenshot', dataUrl, rect });
}

function respond(sendResponse: (response: MessageResponse) => void, action: Promise<void>): void {
  action
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'Page scan failed.';
      sendRuntimeMessage({ type: 'page-scan:failed', message });
      sendResponse({ ok: false, error: message });
    });
}

function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      settleChromeCallback(() => resolve(tabs[0]), reject);
    });
  });
}

function executeScript(tabId: number, file: string): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        files: [file]
      },
      () => settleChromeCallback(resolve, reject)
    );
  });
}

function captureVisibleTab(windowId: number | undefined): Promise<string> {
  return new Promise((resolve, reject) => {
    const callback = (dataUrl: string) => settleChromeCallback(() => resolve(dataUrl), reject);
    if (windowId === undefined) {
      chrome.tabs.captureVisibleTab({ format: 'png' }, callback);
    } else {
      chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, callback);
    }
  });
}

function sendTabMessage(tabId: number, message: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, () => settleChromeCallback(resolve, reject));
  });
}

function sendRuntimeMessage(message: unknown): void {
  chrome.runtime.sendMessage(message, () => {
    void chrome.runtime.lastError;
  });
}

function settleChromeCallback(resolve: () => void, reject: (error: Error) => void): void {
  const message = chrome.runtime.lastError?.message;
  if (message) {
    reject(new Error(message));
  } else {
    resolve();
  }
}

function isCaptureRect(value: unknown): value is {
  left: number;
  top: number;
  width: number;
  height: number;
  devicePixelRatio: number;
} {
  return (
    typeof value === 'object' &&
    value !== null &&
    ['left', 'top', 'width', 'height', 'devicePixelRatio'].every(
      (key) => typeof (value as Record<string, unknown>)[key] === 'number'
    )
  );
}

function isRestrictedPage(url: string | undefined): boolean {
  if (!url) {
    return true;
  }

  return /^(chrome|edge|about|moz-extension|chrome-extension|devtools):/i.test(url);
}
