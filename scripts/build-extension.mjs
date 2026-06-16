import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const appDir = 'dist/app';
const targets = ['chrome', 'edge', 'firefox'];
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
    name: target === 'edge' ? 'Authenticator: 2FA Client' : 'Authenticator',
    short_name: 'Authenticator',
    version: packageJson.version,
    description: 'Encrypted two-factor authenticator codes for your browser.',
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    action: {
      default_title: 'Authenticator',
      default_popup: 'index.html',
    },
    commands: {
      'scan-page': {
        description: 'Scan a QR code from the current page',
      },
    },
    background: {
      service_worker: 'assets/background.js',
      type: 'module',
    },
    permissions: ['storage', 'activeTab', 'scripting', 'tabs'],
    optional_permissions: ['clipboardWrite'],
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; default-src 'self'",
    },
  };

  if (target === 'chrome' || target === 'edge') {
    manifest.side_panel = {
      default_path: 'index.html',
    };
    manifest.permissions.push('sidePanel');
  }

  if (target === 'firefox') {
    manifest.browser_specific_settings = {
      gecko: {
        id: 'authenticator@example.local',
        strict_min_version: '126.0',
      },
    };
    manifest.background = {
      scripts: ['assets/background.js'],
      type: 'module',
    };
  }

  return manifest;
}
