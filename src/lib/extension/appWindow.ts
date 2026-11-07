import { getFirefoxVersion, isAndroid } from './platform';

/** Screens the app can open on directly, for tasks handed over from the popup. */
const APP_ROUTES = ['add-qr', 'import'] as const;

export type AppRoute = (typeof APP_ROUTES)[number];

const ROUTE_PARAM = 'open';
const PAGE_WINDOW_PARAM = 'window';
// Outer size, so the 400×532 popup layout fits alongside the window frame.
const APP_WINDOW_SIZE = { width: 440, height: 680 } as const;
const OPEN_PAGE_FAILED = 'Could not open a new window or tab.';
// Firefox for Android hands files picked in a popup to the page from this
// version on (bug 1962923); earlier versions silently drop them.
const FIREFOX_ANDROID_POPUP_FILES_VERSION = 153;

/** User-Agent Client Hints, which only Chromium-based browsers provide. */
interface UserAgentData {
  brands: { brand: string }[];
  platform: string;
}

/** Where choosing files continues when this page cannot receive the files. */
export type FilePickerHandoff = 'window' | 'tab';

/** How the browser shows this page. */
export interface PageSurface {
  /**
   * A desktop toolbar popup: a small window that the browser sizes to the
   * page and closes whenever it loses focus. Android browsers show the popup
   * full screen instead, where it acts like any other page.
   */
  popupWindow: boolean;
  /** Where choosing files continues, or null where this page picks them itself. */
  filePickerHandoff: FilePickerHandoff | null;
}

let surface: PageSurface | undefined;

/** Finds out how the browser shows this page. Pages run this once before rendering. */
export async function detectPageSurface(): Promise<PageSurface> {
  surface = await readPageSurface();
  return surface;
}

/** Where choosing files has to continue, or null when this page can pick them itself. */
export function getFilePickerHandoff(): FilePickerHandoff | null {
  if (!surface) {
    throw new Error('detectPageSurface() has to finish before the app renders.');
  }
  return surface.filePickerHandoff;
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
 * Continues on `route` in a separate extension window or tab, which can pick
 * files and keeps acting on this page's browser window, then closes this popup.
 */
export async function openAppPage(route: AppRoute, target: FilePickerHandoff): Promise<void> {
  const url = new URL(window.location.href);
  url.search = new URLSearchParams({ [ROUTE_PARAM]: route }).toString();
  url.hash = '';
  const pageWindowId = await getPageWindowId();
  if (pageWindowId !== undefined) {
    url.searchParams.set(PAGE_WINDOW_PARAM, String(pageWindowId));
  }

  await new Promise<void>((resolve, reject) => {
    const settle = () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message || OPEN_PAGE_FAILED));
      } else {
        resolve();
      }
    };

    if (target === 'window') {
      chrome.windows.create({ url: url.href, type: 'popup', ...APP_WINDOW_SIZE }, settle);
    } else {
      chrome.tabs.create({ url: url.href }, settle);
    }
  });
  window.close();
}

async function readPageSurface(): Promise<PageSurface> {
  if (!isToolbarPopup()) {
    return { popupWindow: false, filePickerHandoff: null };
  }

  if (!(await isAndroid())) {
    // The popup window closes when a native file picker takes focus, destroying
    // the page before the picker can report back, except in Chromium on Windows.
    return { popupWindow: true, filePickerHandoff: isChromiumOnWindows() ? null : 'window' };
  }

  // Android browsers have tabs but no windows to continue in.
  const firefoxVersion = await getFirefoxVersion();
  const dropsFiles = firefoxVersion !== undefined && firefoxVersion < FIREFOX_ANDROID_POPUP_FILES_VERSION;
  return { popupWindow: false, filePickerHandoff: dropsFiles ? 'tab' : null };
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
