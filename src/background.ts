import { decodeQrDataUrlInWorker } from './lib/auth/qrWorker';
import { getImportResultMessage, importTextIntoStoredVault } from './lib/auth/vaultImport';

interface CaptureRect {
  left: number;
  top: number;
  width: number;
  height: number;
  devicePixelRatio: number;
}

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
    respond(
      sendResponse,
      captureSelection(sender.tab?.windowId, sender.tab?.id, message.rect),
      sender.tab?.id
    );
    return true;
  }

  if (message?.type === 'page-scan:image') {
    respond(sendResponse, completePageScan(sender.tab?.id, message.dataUrl), sender.tab?.id);
    return true;
  }

  if (message?.type === 'page-scan:failed') {
    respond(sendResponse, reportScanFailure(sender.tab?.id, message.message));
    return true;
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

function respond(
  sendResponse: (response: MessageResponse) => void,
  action: Promise<void>,
  failureTabId?: number
): void {
  action
    .then(() => sendResponse({ ok: true }))
    .catch(async (error) => {
      const message = error instanceof Error ? error.message : 'Page scan failed.';
      if (failureTabId !== undefined) {
        await alertPageScanResult(failureTabId, message);
      }
      sendRuntimeMessage({ type: 'page-scan:completed', ok: false, message });
      sendResponse({ ok: false, error: message });
    });
}

async function completePageScan(tabId: number | undefined, dataUrl: unknown): Promise<void> {
  if (tabId === undefined || typeof dataUrl !== 'string') {
    throw new Error('Page scan failed.');
  }

  const text = await decodeQrDataUrlInWorker(dataUrl);
  const result = await importTextIntoStoredVault(text);
  const message = getImportResultMessage(result);
  await alertPageScanResult(tabId, message);
  sendRuntimeMessage({ type: 'page-scan:completed', ok: result.imported > 0, message });
}

async function reportScanFailure(tabId: number | undefined, message: unknown): Promise<void> {
  const resultMessage = typeof message === 'string' && message ? message : 'Page scan failed.';
  if (tabId !== undefined) {
    await alertPageScanResult(tabId, resultMessage);
  }
  sendRuntimeMessage({ type: 'page-scan:completed', ok: false, message: resultMessage });
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

async function alertPageScanResult(tabId: number, message: string): Promise<void> {
  try {
    await sendTabMessage(tabId, { type: 'page-scan:result', message });
  } catch {
    await executeAlert(tabId, message);
  }
}

function executeAlert(tabId: number, message: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.scripting.executeScript(
      {
        target: { tabId },
        func: (text: string) => window.alert(text),
        args: [message]
      },
      () => resolve()
    );
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

function isCaptureRect(value: unknown): value is CaptureRect {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const rect = value as Partial<Record<keyof CaptureRect, unknown>>;
  return (
    isFiniteNumber(rect.left) &&
    isFiniteNumber(rect.top) &&
    isFiniteNumber(rect.width) &&
    isFiniteNumber(rect.height) &&
    isFiniteNumber(rect.devicePixelRatio)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isRestrictedPage(url: string | undefined): boolean {
  if (!url) {
    return true;
  }

  return /^(chrome|edge|about|moz-extension|chrome-extension|devtools):/i.test(url);
}
