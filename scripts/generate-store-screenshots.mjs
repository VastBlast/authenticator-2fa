import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { extname, join, normalize, relative, resolve } from 'node:path';
import sharp from 'sharp';

const appDir = resolve('dist/app');
const screenshotDir = resolve('assets/store/screenshots');
const promoDir = resolve('assets/store/promotional');
const storeIconDir = resolve('assets/store/icons');
const screenshotViewport = { width: 1280, height: 800 };
const vaultKey = 'vastblast.2fa-authenticator.vault';

const accounts = [
  demoAccount('Workspace', 'alex@example.com', 'JBSWY3DPEHPK3PXP', 0),
  demoAccount('Admin Portal', 'operations@example.com', 'KRSXG5DSN5SGK3TPOJQXGZJT', 1),
  demoAccount('Cloud Console', 'deploy@example.com', 'MFRGGZDFMZTWQ2LK', 2),
  demoAccount('Payments', 'billing@example.com', 'NBSWY3DPEB3W64TMMQ', 3),
  demoAccount('Support Desk', 'help@example.com', 'ORSXG5AON5XGC3LQ', 4),
];

const scenarios = [
  {
    id: '01-codes-overview',
    title: 'Fast 2FA codes, organized',
    body: 'Keep one-time codes readable, searchable, and ready without leaving your current workflow.',
    action: 'none',
    theme: 'light',
    chips: ['Open source', 'QR import', 'Manual order'],
  },
  {
    id: '02-add-account',
    title: 'Add accounts by QR or text',
    body: 'Import a QR image, select a QR code from the current page, paste transfer text, or enter a code manually.',
    action: 'add-qr',
    theme: 'light',
  },
  {
    id: '03-import-export',
    title: 'Move accounts when needed',
    body: 'Import and export otpauth text or encrypted backups from a single focused settings screen.',
    action: 'import-export',
    theme: 'light',
    frameHeight: 640,
  },
  {
    id: '04-security-settings',
    title: 'Optional vault protection',
    body: 'Use a local vault, then add password protection when you want another layer of control.',
    action: 'settings',
    theme: 'dark',
  },
];

const promoTiles = [
  {
    id: 'small-promo-tile',
    width: 440,
    height: 280,
    title: 'Authenticator - 2FA',
    body: 'Generate 2FA codes in your browser',
  },
  {
    id: 'marquee-promo-tile',
    width: 1400,
    height: 560,
    title: 'Authenticator - 2FA',
    body: 'Clean, local two-factor codes with QR import, backups, and manual ordering.',
  },
];

await ensureBuiltApp();
await rm(screenshotDir, { recursive: true, force: true });
await rm(promoDir, { recursive: true, force: true });
await mkdir(screenshotDir, { recursive: true });
await mkdir(promoDir, { recursive: true });

const server = createServer((request, response) => {
  void handleRequest(request.url ?? '/', response);
});

await new Promise((resolveReady, rejectReady) => {
  server.once('error', rejectReady);
  server.listen(0, '127.0.0.1', () => {
    server.off('error', rejectReady);
    resolveReady();
  });
});

try {
  const { port } = server.address();
  const chrome = findChrome();

  for (const scenario of scenarios) {
    const output = join(screenshotDir, `${scenario.id}.png`);
    await captureChromeScreenshot(chrome, `http://127.0.0.1:${port}/demo/${scenario.id}`, output, screenshotViewport);
    await assertScreenshotSize(output, screenshotViewport);
    console.log(`Created ${relative(process.cwd(), output)}`);
  }

  for (const tile of promoTiles) {
    const output = join(promoDir, `${tile.id}.png`);
    await captureChromeScreenshot(chrome, `http://127.0.0.1:${port}/promo/${tile.id}`, output, {
      width: tile.width,
      height: tile.height,
    });
    await assertScreenshotSize(output, tile);
    console.log(`Created ${relative(process.cwd(), output)}`);
  }
} finally {
  await new Promise((resolveClose) => server.close(resolveClose));
}

async function ensureBuiltApp() {
  try {
    await stat(join(appDir, 'index.html'));
  } catch {
    throw new Error('Build the app before generating screenshots: npm run build');
  }
}

async function handleRequest(url, response) {
  const path = new URL(url, 'http://127.0.0.1').pathname;

  if (path.startsWith('/demo/')) {
    const scenario = scenarios.find((item) => path === `/demo/${item.id}`);
    if (!scenario) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(renderDemoPage(scenario));
    return;
  }

  if (path.startsWith('/promo/')) {
    const tile = promoTiles.find((item) => path === `/promo/${item.id}`);
    if (!tile) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }

    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(renderPromoPage(tile));
    return;
  }

  if (path.startsWith('/store-icons/')) {
    const filePath = resolve(storeIconDir, `.${decodeURIComponent(path.replace('/store-icons', ''))}`);
    if (!filePath.startsWith(`${storeIconDir}/`)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, { 'content-type': getContentType(filePath) });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
    return;
  }

  if (path.startsWith('/store-screenshots/')) {
    const filePath = resolve(screenshotDir, `.${decodeURIComponent(path.replace('/store-screenshots', ''))}`);
    if (!filePath.startsWith(`${screenshotDir}/`)) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    try {
      const body = await readFile(filePath);
      response.writeHead(200, { 'content-type': getContentType(filePath) });
      response.end(body);
    } catch {
      response.writeHead(404);
      response.end('Not found');
    }
    return;
  }

  const filePath = resolve(appDir, `.${decodeURIComponent(path === '/' ? '/index.html' : path)}`);
  if (!filePath.startsWith(`${appDir}/`) && filePath !== join(appDir, 'index.html')) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, { 'content-type': getContentType(filePath) });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

function renderDemoPage(scenario) {
  const vault = {
    version: 1,
    format: 'plain',
    data: {
      accounts,
      settings: {
        language: 'en',
        theme: scenario.theme,
      },
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=1280, height=800, initial-scale=1" />
    <title>${escapeHtml(scenario.title)}</title>
    <style>
      :root {
        color-scheme: light;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: 1280px;
        height: 800px;
        margin: 0;
        overflow: hidden;
      }

      body {
        display: grid;
        grid-template-columns: 1fr 560px;
        gap: 56px;
        align-items: center;
        padding: 64px 86px;
        background:
          radial-gradient(circle at 18% 18%, rgba(40, 88, 200, 0.16), transparent 28%),
          radial-gradient(circle at 88% 12%, rgba(176, 200, 248, 0.28), transparent 24%),
          linear-gradient(135deg, #f8fbff 0%, #eef3ff 56%, #f7fbff 100%);
        color: #202124;
      }

      body.tall-frame {
        padding-top: 32px;
        padding-bottom: 32px;
      }

      .copy {
        display: grid;
        align-content: center;
        gap: 24px;
        min-width: 0;
      }

      .brand {
        display: flex;
        align-items: center;
        gap: 16px;
        color: #2858c8;
        font-size: 22px;
        font-weight: 760;
      }

      .brand img {
        width: 64px;
        height: 64px;
        border-radius: 18px;
        box-shadow: 0 14px 34px rgba(31, 58, 124, 0.14);
      }

      h1 {
        max-width: 560px;
        margin: 0;
        color: #202124;
        font-size: 64px;
        line-height: 0.96;
        font-weight: 820;
      }

      p {
        max-width: 540px;
        margin: 0;
        color: #475569;
        font-size: 24px;
        line-height: 1.35;
        font-weight: 500;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding-top: 8px;
      }

      .chip {
        border: 1px solid rgba(40, 88, 200, 0.18);
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.74);
        color: #2858c8;
        padding: 10px 15px;
        font-size: 16px;
        font-weight: 700;
        box-shadow: 0 12px 30px rgba(31, 58, 124, 0.08);
      }

      .visual {
        display: grid;
        justify-items: center;
      }

      .browser {
        width: 520px;
        border: 1px solid rgba(25, 39, 46, 0.12);
        border-radius: 28px;
        overflow: hidden;
        background: rgba(255, 255, 255, 0.78);
        box-shadow: 0 28px 78px rgba(31, 58, 124, 0.18);
      }

      .bar {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 54px;
        padding: 0 18px;
        border-bottom: 1px solid rgba(25, 39, 46, 0.1);
      }

      .dot {
        width: 12px;
        height: 12px;
        border-radius: 999px;
        background: #d8dee9;
      }

      .window-title {
        margin-left: 10px;
        color: #64748b;
        font-size: 15px;
        font-weight: 700;
      }

      .stage {
        display: grid;
        place-items: center;
        padding: 16px 0 18px;
        background: linear-gradient(180deg, rgba(255,255,255,0.78), rgba(239,244,255,0.9));
      }

      iframe {
        width: 400px;
        height: ${scenario.frameHeight ?? 532}px;
        border: 0;
        border-radius: 20px;
        background: white;
        box-shadow: 0 18px 44px rgba(31, 58, 124, 0.16);
      }
    </style>
  </head>
  <body class="${scenario.frameHeight ? 'tall-frame' : ''}">
    <section class="copy">
      <div class="brand">
        <img src="/store-icons/store-icon128.png" alt="" />
        <span>Authenticator - 2FA</span>
      </div>
      <h1>${escapeHtml(scenario.title)}</h1>
      <p>${escapeHtml(scenario.body)}</p>
      <div class="chips" aria-hidden="true">
        ${getScenarioChips(scenario).map((chip) => `<span class="chip">${escapeHtml(chip)}</span>`).join('')}
      </div>
    </section>

    <section class="visual" aria-label="Product screenshot">
      <div class="browser">
        <div class="bar">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="window-title">Authenticator - 2FA</span>
        </div>
        <div class="stage">
          <iframe id="app-frame" title="Authenticator - 2FA demo"></iframe>
        </div>
      </div>
    </section>

    <script>
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(${JSON.stringify(vaultKey)}, ${JSON.stringify(JSON.stringify(vault))});

      const frame = document.getElementById('app-frame');
      frame.addEventListener('load', async () => {
        applyFrameHeight(${scenario.frameHeight ?? 532});
        await delay(700);
        await runScenario(${JSON.stringify(scenario.action)});
      });
      frame.src = '/index.html';

      async function runScenario(action) {
        const doc = frame.contentDocument;
        if (action === 'add-qr') {
          clickSelector(doc, '[aria-label="Add account"]');
        } else if (action === 'settings') {
          clickSelector(doc, '[aria-label="Settings"]');
        } else if (action === 'import-export') {
          clickSelector(doc, '[aria-label="Settings"]');
          await delay(350);
          clickByText(doc, 'button', 'Import/export');
        }
      }

      function clickSelector(doc, selector) {
        const element = doc.querySelector(selector);
        if (element) {
          element.click();
        }
      }

      function clickByText(doc, selector, text) {
        const element = [...doc.querySelectorAll(selector)].find((item) => item.textContent.includes(text));
        if (element) {
          element.click();
        }
      }

      function applyFrameHeight(height) {
        const doc = frame.contentDocument;
        const style = doc.createElement('style');
        style.textContent = ':root{--auth-popup-height:' + height + 'px;}html,body,#app{height:' + height + 'px!important;min-height:' + height + 'px!important;max-height:' + height + 'px!important;}';
        doc.head.append(style);
      }

      function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
      }
    </script>
  </body>
</html>`;
}

function getScenarioChips(scenario) {
  return scenario.chips ?? ['Local vault', 'QR import', 'Manual order'];
}

function renderPromoPage(tile) {
  const isMarquee = tile.width > 1000;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=${tile.width}, height=${tile.height}, initial-scale=1" />
    <title>${escapeHtml(tile.title)}</title>
    <style>
      :root {
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        width: ${tile.width}px;
        height: ${tile.height}px;
        margin: 0;
        overflow: hidden;
      }

      body {
        display: grid;
        grid-template-columns: ${isMarquee ? 'auto minmax(0, 1fr) 360px' : '1fr'};
        align-items: center;
        gap: ${isMarquee ? '44px' : '16px'};
        padding: ${isMarquee ? '64px 92px' : '26px'};
        background:
          radial-gradient(circle at 18% 20%, rgba(40, 88, 200, 0.2), transparent 29%),
          radial-gradient(circle at 82% 14%, rgba(176, 200, 248, 0.28), transparent 24%),
          radial-gradient(circle at 72% 86%, rgba(251, 188, 4, 0.1), transparent 26%),
          linear-gradient(135deg, #f8fbff 0%, #eef3ff 56%, #f7fbff 100%);
        color: #202124;
      }

      img {
        width: ${isMarquee ? '128px' : '76px'};
        height: ${isMarquee ? '128px' : '76px'};
        border-radius: ${isMarquee ? '32px' : '22px'};
        box-shadow: 0 ${isMarquee ? '24px 54px' : '16px 34px'} rgba(31, 58, 124, 0.16);
      }

      .copy {
        display: grid;
        gap: ${isMarquee ? '18px' : '10px'};
        min-width: 0;
      }

      h1 {
        margin: 0;
        font-size: ${isMarquee ? '62px' : '34px'};
        line-height: ${isMarquee ? '0.98' : '0.96'};
        font-weight: 840;
        letter-spacing: 0;
        white-space: ${isMarquee ? 'nowrap' : 'normal'};
      }

      p {
        max-width: ${isMarquee ? '760px' : '340px'};
        margin: 0;
        color: #475569;
        font-size: ${isMarquee ? '29px' : '18px'};
        line-height: 1.28;
        font-weight: 650;
      }

      .preview-screenshot {
        display: ${isMarquee ? 'grid' : 'none'};
        width: 300px;
        height: 398px;
        justify-self: center;
        border-radius: 20px;
        overflow: hidden;
        background-image: url("/store-screenshots/01-codes-overview.png");
        background-position: -536px -122px;
        background-size: 960px 600px;
        box-shadow: 0 24px 58px rgba(31, 58, 124, 0.18);
      }
    </style>
  </head>
  <body>
    ${isMarquee ? '<img src="/store-icons/store-icon128.png" alt="" />' : ''}
    <section class="copy">
      ${isMarquee ? '' : '<img src="/store-icons/store-icon128.png" alt="" />'}
      <h1>${escapeHtml(tile.title)}</h1>
      <p>${escapeHtml(tile.body)}</p>
    </section>
    ${
      isMarquee
        ? '<div class="preview-screenshot" aria-hidden="true"></div>'
        : ''
    }
  </body>
</html>`;
}

function demoAccount(issuer, label, secret, sortOrder) {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: `demo-${sortOrder + 1}`,
    issuer,
    label,
    secret,
    type: 'totp',
    algorithm: 'SHA-1',
    digits: 6,
    period: 30,
    counter: 0,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };
}

function findChrome() {
  const candidates = [
    process.env.CHROME_BIN,
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ].filter(Boolean);

  for (const candidate of candidates) {
    const result = spawnSync('which', [candidate], { encoding: 'utf8' });
    if (result.status === 0) {
      return result.stdout.trim();
    }
  }

  throw new Error('No Chrome or Chromium binary found. Set CHROME_BIN to generate screenshots.');
}

function captureChromeScreenshot(chrome, url, output, viewport) {
  return new Promise((resolveScreenshot, rejectScreenshot) => {
    const args = [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      '--run-all-compositor-stages-before-draw',
      '--force-device-scale-factor=1',
      `--window-size=${viewport.width},${viewport.height}`,
      '--virtual-time-budget=4500',
      `--screenshot=${output}`,
      url,
    ];
    const child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', rejectScreenshot);
    child.on('close', (code) => {
      if (code === 0) {
        resolveScreenshot();
      } else {
        rejectScreenshot(new Error(`Chrome screenshot failed (${code}): ${stderr}`));
      }
    });
  });
}

async function assertScreenshotSize(file, viewport) {
  const metadata = await sharp(file).metadata();
  if (metadata.width !== viewport.width || metadata.height !== viewport.height) {
    throw new Error(`${normalize(file)} is ${metadata.width}x${metadata.height}, expected ${viewport.width}x${viewport.height}`);
  }
}

function getContentType(filePath) {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return character;
    }
  });
}
