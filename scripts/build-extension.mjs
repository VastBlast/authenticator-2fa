import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const appDir = 'dist/app';
const targets = ['chrome', 'edge', 'firefox'];
// Firefox 126 lets `activeTab` capture the visible tab for page scans.
const FIREFOX_MIN_VERSION = '126.0';
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));

for (const target of targets) {
  const outDir = join('dist', target);
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await cp(appDir, outDir, { recursive: true });
  await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(createManifest(target), null, 2)}\n`);
}

function createManifest(target) {
  const manifest = {
    manifest_version: 3,
    name: '__MSG_extensionName__',
    short_name: '__MSG_extensionShortName__',
    version: packageJson.version,
    description: '__MSG_extensionDescription__',
    default_locale: 'en',
    homepage_url: 'https://github.com/VastBlast/authenticator-2fa',
    icons: {
      16: 'icons/icon16.png',
      32: 'icons/icon32.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    action: {
      default_title: '__MSG_actionTitle__',
      default_popup: 'index.html',
      default_icon: {
        16: 'icons/icon16.png',
        24: 'icons/icon24.png',
        32: 'icons/icon32.png',
      },
    },
    background: {
      service_worker: 'assets/background.js',
      type: 'module',
    },
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Ctrl+Shift+2',
          mac: 'Command+Shift+2',
        },
        description: '__MSG_commandOpenPopup__',
      },
    },
    permissions: ['storage', 'activeTab', 'scripting'],
    content_security_policy: {
      extension_pages:
        "script-src 'self' 'wasm-unsafe-eval'; object-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; default-src 'self'",
    },
  };

  if (target === 'chrome' || target === 'edge') {
    manifest.side_panel = {
      default_path: 'index.html',
    };
    manifest.permissions.push('sidePanel');
  }

  if (target === 'firefox') {
    // One package serves Firefox on desktop and Android. Android ignores the
    // desktop-only `commands` key; the app checks for desktop-only APIs.
    manifest.browser_specific_settings = {
      gecko: {
        id: 'authenticator@example.local',
        strict_min_version: FIREFOX_MIN_VERSION,
        data_collection_permissions: {
          required: ['none'],
        },
      },
      gecko_android: {
        strict_min_version: FIREFOX_MIN_VERSION,
      },
    };
    manifest.background = {
      scripts: ['assets/background.js'],
      type: 'module',
    };
  }

  return manifest;
}
