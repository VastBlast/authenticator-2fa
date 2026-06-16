chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === 'start-page-scan') {
    void startPageScan();
    return true;
  }

  if (message?.type === 'page-scan:capture') {
    void captureSelection(sender.tab?.windowId, sender.tab?.id, message.rect);
    return true;
  }

  if (message?.type === 'page-scan:image') {
    sendRuntimeMessage({ type: 'page-scan:ready', dataUrl: message.dataUrl });
    return true;
  }

  return undefined;
});

async function startPageScan(): Promise<void> {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return;
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
    return;
  }

  const dataUrl = await captureVisibleTab(windowId);
  await sendTabMessage(tabId, { type: 'page-scan:screenshot', dataUrl, rect });
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
