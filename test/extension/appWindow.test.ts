import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  detectPageSurface,
  getFilePickerHandoff,
  getPageWindowId,
  openAppPage,
  readAppRoute
} from '../../src/lib/extension/appWindow';

const PAGE_URL = 'chrome-extension://abcdefghijklmnop/index.html';

interface FakeWindow {
  location: { href: string };
  close: ReturnType<typeof vi.fn>;
}

function installWindow(href = PAGE_URL): FakeWindow {
  const fakeWindow: FakeWindow = { location: { href }, close: vi.fn() };
  vi.stubGlobal('window', fakeWindow);
  return fakeWindow;
}

function installChrome(
  api: Record<string, unknown>,
  { os = 'linux', firefoxVersion }: { os?: string; firefoxVersion?: string } = {}
): void {
  const runtime = {
    lastError: undefined,
    getPlatformInfo: (callback: (info: { os: string }) => void) => callback({ os }),
    ...(firefoxVersion && {
      getBrowserInfo: (callback: (info: { version: string }) => void) => callback({ version: firefoxVersion })
    })
  };
  vi.stubGlobal('chrome', { runtime, ...api });
}

function installBrowser(platform?: string): void {
  // Only Chromium-based browsers expose client hints.
  const userAgentData = platform
    ? { platform, brands: [{ brand: 'Chromium' }, { brand: 'Google Chrome' }] }
    : undefined;
  vi.stubGlobal('navigator', { userAgentData });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test('readAppRoute ignores missing and unrecognized routes', () => {
  expect(readAppRoute(PAGE_URL)).toBeNull();
  expect(readAppRoute(`${PAGE_URL}?open=settings`)).toBeNull();
});

describe('detectPageSurface', () => {
  test('hands off from the toolbar popup to a window wherever the picker would close it', async () => {
    const popup = installWindow();
    installChrome({ extension: { getViews: () => [popup] } });

    for (const platform of [undefined, 'macOS', 'Linux']) {
      installBrowser(platform);
      await expect(detectPageSurface(), platform ?? 'Firefox').resolves.toMatchObject({ popupWindow: true });
      expect(getFilePickerHandoff(), platform ?? 'Firefox').toBe('window');
    }

    // Chromium keeps its popup open behind the picker on Windows.
    installBrowser('Windows');
    await detectPageSurface();
    expect(getFilePickerHandoff()).toBeNull();
  });

  test('never hands off from side panels, tabs, or app windows', async () => {
    installWindow();
    installBrowser();
    // Another browser window may be showing its own popup meanwhile.
    installChrome({ extension: { getViews: () => [{ location: { href: PAGE_URL } }] } });

    await expect(detectPageSurface()).resolves.toMatchObject({ popupWindow: false });
    expect(getFilePickerHandoff()).toBeNull();
  });

  test('picks files in the full-screen Android popup once Firefox hands them over there', async () => {
    const popup = installWindow();
    installBrowser();

    for (const [firefoxVersion, handoff] of [['152.0', 'tab'], ['153.0', null]] as const) {
      installChrome({ extension: { getViews: () => [popup] } }, { os: 'android', firefoxVersion });
      await expect(detectPageSurface(), firefoxVersion).resolves.toMatchObject({ popupWindow: false });
      expect(getFilePickerHandoff(), firefoxVersion).toBe(handoff);
    }
  });
});

describe('openAppPage', () => {
  test('opens the route in a window that acts for the original browser window', async () => {
    const popup = installWindow();
    let currentWindowId = 7;
    const create = vi.fn((_data: chrome.windows.CreateData, callback: () => void) => {
      expect(popup.close).not.toHaveBeenCalled();
      callback();
    });
    installChrome({
      windows: {
        create,
        getCurrent: (callback: (current: { id: number }) => void) => callback({ id: currentWindowId })
      }
    });

    await openAppPage('add-qr', 'window');

    const [data] = create.mock.calls[0]!;
    expect(data.type).toBe('popup');
    // The 400×532 popup layout cannot shrink, and the window frame needs room too.
    expect(data.width).toBeGreaterThanOrEqual(420);
    expect(data.height).toBeGreaterThanOrEqual(600);
    expect(popup.close).toHaveBeenCalledOnce();

    // Inside the new window, page context, page scans, and auto-paste must
    // still target the tab the user came from, not the extension window.
    installWindow(data.url as string);
    currentWindowId = 99;
    expect(readAppRoute(window.location.href)).toBe('add-qr');
    await expect(getPageWindowId()).resolves.toBe(7);
  });

  test('continues in a tab where the browser has no windows', async () => {
    const popup = installWindow();
    const create = vi.fn((_data: chrome.tabs.CreateProperties, callback: () => void) => callback());
    installChrome({ tabs: { create } }, { os: 'android' });

    await openAppPage('import', 'tab');

    expect(readAppRoute(create.mock.calls[0]![0].url as string)).toBe('import');
    expect(popup.close).toHaveBeenCalledOnce();
  });

  test('keeps the popup open and reports why the window failed', async () => {
    const popup = installWindow();
    const runtime: { lastError?: { message?: string } } = {};
    const create = vi.fn((_data: chrome.windows.CreateData, callback: () => void) => {
      runtime.lastError = { message: 'Window limit reached.' };
      callback();
      runtime.lastError = undefined;
    });
    installChrome({ runtime, windows: { create } });

    await expect(openAppPage('import', 'window')).rejects.toThrow('Window limit reached.');
    expect(popup.close).not.toHaveBeenCalled();
  });
});
