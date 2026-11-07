import { resolvePageScanGesture } from '../lib/auth/pageScanSelection';

let overlay: HTMLDivElement | null = null;
let selection: HTMLDivElement | null = null;
let startX = 0;
let startY = 0;
let activePointerId: number | null = null;

const scannerEventOptions = { capture: true, passive: false };

const pageScannerWindow = window as Window & { __twofaPageScannerInstalled?: boolean };

if (!pageScannerWindow.__twofaPageScannerInstalled) {
  pageScannerWindow.__twofaPageScannerInstalled = true;
  chrome.runtime.onMessage.addListener(handleMessage);
}

function handleMessage(
  message: unknown,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: { ok: boolean }) => void
) {
  const payload = message as { type?: unknown; message?: unknown };

  if (payload.type === 'page-scan:start') {
    showOverlay();
    sendResponse({ ok: true });
    return undefined;
  }

  if (payload.type === 'page-scan:result') {
    sendResponse({ ok: true });
    setTimeout(() => window.alert(getResultMessage(payload.message)), 0);
    return undefined;
  }

  return undefined;
}

function showOverlay(): void {
  removeOverlay();

  // Modal libraries can set body pointer-events to none and dismiss when an
  // injected overlay becomes the outside event target.
  const bodyPointerEventsLocked = document.body
    ? getComputedStyle(document.body).pointerEvents === 'none'
    : false;

  overlay = document.createElement('div');
  overlay.id = 'twofa-page-scanner-overlay';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    `pointer-events:${bodyPointerEventsLocked ? 'none' : 'auto'}`,
    // Touch drags select an area instead of scrolling or zooming the page.
    'touch-action:none',
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
  window.addEventListener('pointerdown', startSelection, scannerEventOptions);
  window.addEventListener('pointermove', resizeSelection, scannerEventOptions);
  window.addEventListener('pointerup', finishSelection, scannerEventOptions);
  window.addEventListener('pointercancel', cancelSelection, scannerEventOptions);
  window.addEventListener('contextmenu', blockScanEvent, scannerEventOptions);
  window.addEventListener('keydown', cancelOnEscape, scannerEventOptions);
  document.documentElement.append(overlay);
}

function startSelection(event: PointerEvent): void {
  if (!event.isTrusted || !selection) {
    return;
  }
  claimScanEvent(event);

  if (activePointerId !== null || (event.pointerType === 'mouse' && event.button !== 0)) {
    return;
  }

  activePointerId = event.pointerId;
  startX = event.clientX;
  startY = event.clientY;
  selection.style.display = 'block';
  drawSelection(event.clientX, event.clientY);
}

function resizeSelection(event: PointerEvent): void {
  if (!event.isTrusted || !selection) {
    return;
  }
  claimScanEvent(event);

  if (event.pointerId !== activePointerId || selection.style.display === 'none') {
    return;
  }
  drawSelection(event.clientX, event.clientY);
}

function finishSelection(event: PointerEvent): void {
  if (!event.isTrusted || !selection) {
    return;
  }
  claimScanEvent(event);

  if (event.pointerId !== activePointerId || selection.style.display === 'none') {
    return;
  }

  const rect = resolvePageScanGesture(
    { x: startX, y: startY },
    { x: event.clientX, y: event.clientY },
    { width: window.innerWidth, height: window.innerHeight },
    window.devicePixelRatio
  );
  suppressNextClick();
  removeOverlay();

  if (!rect) {
    reportFailure('No scan area was selected.');
    return;
  }

  sendRuntimeMessage({ type: 'page-scan:capture', rect });
}

function cancelSelection(event: PointerEvent): void {
  if (!event.isTrusted || !overlay) {
    return;
  }
  claimScanEvent(event);

  if (event.pointerId !== activePointerId) {
    return;
  }

  removeOverlay();
  reportFailure('Page scan cancelled.');
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

function getRect(currentX: number, currentY: number) {
  return {
    left: Math.min(startX, currentX),
    top: Math.min(startY, currentY),
    width: Math.abs(currentX - startX),
    height: Math.abs(currentY - startY)
  };
}

function removeOverlay(): void {
  overlay?.remove();
  overlay = null;
  selection = null;
  activePointerId = null;
  window.removeEventListener('pointerdown', startSelection, scannerEventOptions);
  window.removeEventListener('pointermove', resizeSelection, scannerEventOptions);
  window.removeEventListener('pointerup', finishSelection, scannerEventOptions);
  window.removeEventListener('pointercancel', cancelSelection, scannerEventOptions);
  window.removeEventListener('contextmenu', blockScanEvent, scannerEventOptions);
  window.removeEventListener('keydown', cancelOnEscape, scannerEventOptions);
}

function cancelOnEscape(event: KeyboardEvent): void {
  if (!event.isTrusted || event.key !== 'Escape' || !overlay) {
    return;
  }

  claimScanEvent(event);
  removeOverlay();
  reportFailure('Page scan cancelled.');
}

function blockScanEvent(event: Event): void {
  if (!event.isTrusted || !overlay) {
    return;
  }
  claimScanEvent(event);
}

function claimScanEvent(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function suppressNextClick(): void {
  const stopClick = (event: MouseEvent) => {
    claimScanEvent(event);
  };

  window.addEventListener('click', stopClick, { capture: true, passive: false, once: true });
  window.setTimeout(() => window.removeEventListener('click', stopClick, true), 500);
}

function reportFailure(message: string): void {
  sendRuntimeMessage({ type: 'page-scan:failed', message });
}

function getResultMessage(message: unknown): string {
  return typeof message === 'string' && message ? message : 'Page scan finished.';
}

function sendRuntimeMessage(message: unknown): void {
  chrome.runtime.sendMessage(message, () => {
    void chrome.runtime.lastError;
  });
}
