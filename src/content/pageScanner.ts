interface CaptureRect {
  left: number;
  top: number;
  width: number;
  height: number;
  devicePixelRatio: number;
}

let overlay: HTMLDivElement | null = null;
let selection: HTMLDivElement | null = null;
let startX = 0;
let startY = 0;

interface MessageResponse {
  ok: boolean;
  error?: string;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'page-scan:start') {
    showOverlay();
    sendResponse({ ok: true });
    return undefined;
  }

  if (message?.type === 'page-scan:screenshot') {
    respond(sendResponse, cropScreenshot(message.dataUrl, message.rect));
    return true;
  }

  return undefined;
});

function showOverlay(): void {
  removeOverlay();

  overlay = document.createElement('div');
  overlay.id = 'twofa-page-scanner-overlay';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'cursor:crosshair',
    'background:rgba(9,12,20,.38)'
  ].join(';');

  selection = document.createElement('div');
  selection.style.cssText = [
    'position:fixed',
    'display:none',
    'border:2px solid #fff',
    'box-shadow:0 0 0 9999px rgba(9,12,20,.45)',
    'background:rgba(255,255,255,.08)'
  ].join(';');

  overlay.append(selection);
  overlay.addEventListener('pointerdown', startSelection);
  overlay.addEventListener('pointermove', resizeSelection);
  overlay.addEventListener('pointerup', finishSelection);
  overlay.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('keydown', cancelOnEscape, true);
  document.documentElement.append(overlay);
}

function startSelection(event: PointerEvent): void {
  if (!selection) {
    return;
  }
  startX = event.clientX;
  startY = event.clientY;
  selection.style.display = 'block';
  drawSelection(event.clientX, event.clientY);
}

function resizeSelection(event: PointerEvent): void {
  if (!selection || selection.style.display === 'none') {
    return;
  }
  drawSelection(event.clientX, event.clientY);
}

function finishSelection(event: PointerEvent): void {
  const rect = getRect(event.clientX, event.clientY);
  removeOverlay();

  if (rect.width < 12 || rect.height < 12) {
    reportFailure('No scan area was selected.');
    return;
  }

  sendRuntimeMessage({ type: 'page-scan:capture', rect });
}

function drawSelection(currentX: number, currentY: number): void {
  if (!selection) {
    return;
  }
  const rect = getRect(currentX, currentY);
  selection.style.left = `${rect.left}px`;
  selection.style.top = `${rect.top}px`;
  selection.style.width = `${rect.width}px`;
  selection.style.height = `${rect.height}px`;
}

function getRect(currentX: number, currentY: number): CaptureRect {
  return {
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY),
    devicePixelRatio: window.devicePixelRatio || 1
  };
}

async function cropScreenshot(dataUrl: string, rect: CaptureRect): Promise<void> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();

  const canvas = document.createElement('canvas');
  const scale = rect.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to read the selected page area.');
  }

  context.drawImage(
    image,
    rect.left * scale,
    rect.top * scale,
    rect.width * scale,
    rect.height * scale,
    0,
    0,
    canvas.width,
    canvas.height
  );

  sendRuntimeMessage({ type: 'page-scan:image', dataUrl: canvas.toDataURL('image/png') });
}

function removeOverlay(): void {
  overlay?.remove();
  overlay = null;
  selection = null;
  document.removeEventListener('keydown', cancelOnEscape, true);
}

function cancelOnEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !overlay) {
    return;
  }

  event.preventDefault();
  removeOverlay();
  reportFailure('Page scan cancelled.');
}

function respond(sendResponse: (response: MessageResponse) => void, action: Promise<void>): void {
  action
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      const message = error instanceof Error ? error.message : 'Page scan failed.';
      reportFailure(message);
      sendResponse({ ok: false, error: message });
    });
}

function reportFailure(message: string): void {
  sendRuntimeMessage({ type: 'page-scan:failed', message });
}

function sendRuntimeMessage(message: unknown): void {
  chrome.runtime.sendMessage(message, () => {
    void chrome.runtime.lastError;
  });
}
