import { isAndroid } from './platform';

/** Screens the app can open on directly, for tasks handed over from the popup. */
const APP_ROUTES = ['add-qr', 'import'] as const;

export type AppRoute = (typeof APP_ROUTES)[number];

const ROUTE_PARAM = 'open';
const PAGE_WINDOW_PARAM = 'window';
// Outer size, so the 400×532 popup layout fits alongside the window frame.
const APP_WINDOW_SIZE = { width: 440, height: 680 } as const;
const OPEN_WINDOW_FAILED = 'Could not open a new window.';

/** User-Agent Client Hints, which only Chromium-based browsers provide. */
interface UserAgentData {
  brands: { brand: string }[];
  platform: string;
}

let popupWindow: boolean | undefined;

/**
 * Finds out whether this page is a desktop toolbar popup: a small window that
 * the browser sizes to the page and closes whenever it loses focus. Android
 * browsers show the popup full screen instead, where it acts like any other
 * page. Pages run this once before rendering, which later checks rely on.
 */
export async function detectPopupWindow(): Promise<boolean> {
  popupWindow = isToolbarPopup() && !(await isAndroid());
  return popupWindow;
}

/**
 * Whether choosing files here has to continue in a separate window. A popup
 * window closes when a native file picker takes focus, destroying the page
 * before the picker can report back, except in Chromium on Windows.
 */
export function needsFilePickerWindow(): boolean {
  if (popupWindow === undefined) {
    throw new Error('detectPopupWindow() has to finish before the app renders.');
  }
  return popupWindow && !isChromiumOnWindows();
}

/** Route a page URL asks to open on, ignoring anything unrecognized. */
export function readAppRoute(pageUrl: string): AppRoute | null {
  const value = new URL(pageUrl).searchParams.get(ROUTE_PARAM);
  return APP_ROUTES.find((route) => route === value) ?? null;
}

/**
 * Browser window whose active tab this page reads and acts on. Popups and side
 * panels belong to the window they are shown in; a window opened through
 * `openAppWindow` acts for the window it was opened from. Without window
 * management, as on Android, there is none and the current tab applies.
 */
export function getPageWindowId(): Promise<number | undefined> {
  const linked = readWindowId(new URL(window.location.href).searchParams.get(PAGE_WINDOW_PARAM));
  if (linked !== undefined || typeof chrome === 'undefined' || !chrome.windows?.getCurrent) {
    return Promise.resolve(linked);
  }

  return new Promise((resolve) => {
    chrome.windows.getCurrent((current) => {
      resolve(chrome.runtime.lastError ? undefined : current.id);
    });
  });
}

/**
 * Continues on `route` in a separate extension window, which stays open while
 * native dialogs have focus and keeps acting on this page's browser window,
 * then closes this popup window.
 */
export async function openAppWindow(route: AppRoute): Promise<void> {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ [ROUTE_PARAM]: route }).toString();
  url.hash = '';
  const pageWindowId = await getPageWindowId();
  if (pageWindowId !== undefined) {
    url.searchParams.set(PAGE_WINDOW_PARAM, String(pageWindowId));
  }

  await new Promise<void>((resolve, reject) => {
    chrome.windows.create({ url: url.href, type: 'popup', ...APP_WINDOW_SIZE }, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message || OPEN_WINDOW_FAILED));
      } else {
        resolve();
      }
    });
  });
  window.close();
}

function isToolbarPopup(): boolean {
  if (typeof window === 'undefined' || typeof chrome === 'undefined') {
    return false;
  }
  return chrome.extension?.getViews?.({ type: 'popup' }).includes(window) ?? false;
}

function isChromiumOnWindows(): boolean {
  const userAgentData = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
  return (
    userAgentData?.platform === 'Windows' &&
    userAgentData.brands.some(({ brand }) => brand === 'Chromium')
  );
}

function readWindowId(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) && id >= 0 ? id : undefined;
}
