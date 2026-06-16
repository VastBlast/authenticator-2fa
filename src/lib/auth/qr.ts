import type { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import type { DecodeHintType } from '@zxing/library';

let qrReader: BrowserQRCodeReader | null = null;

interface CanvasRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

const CAMERA_SCAN_INTERVAL_MS = 250;
const NORMALIZED_QR_SIZES = [384, 512, 768, 320, 448, 256, 1024];
const QR_DECODE_ERROR = 'No QR code could be decoded from the selected image. Try a tighter crop or a clearer screenshot.';

export async function decodeQrFile(file: File): Promise<string> {
  const imageUrl = URL.createObjectURL(file);
  try {
    return await decodeQrDataUrl(imageUrl);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function decodeQrDataUrl(imageUrl: string): Promise<string> {
  const qrReader = await getQrReader();
  return decodeQrDataUrlWithCanvasFallback(qrReader, imageUrl);
}

export async function decodeQrFiles(files: FileList | File[]): Promise<string[]> {
  const decoded: string[] = [];
  const errors: string[] = [];

  for (const file of Array.from(files)) {
    try {
      decoded.push(await decodeQrFile(file));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'QR image could not be decoded.');
    }
  }

  if (decoded.length === 0 && errors.length > 0) {
    throw new Error(QR_DECODE_ERROR);
  }

  return decoded;
}

export async function renderQrDataUrl(text: string): Promise<string> {
  const { toDataURL } = await import('qrcode');
  return toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 2,
    scale: 6,
    color: {
      dark: '#111827',
      light: '#ffffff'
    }
  });
}

export async function startCameraQrScan(
  video: HTMLVideoElement,
  onText: (text: string) => void,
  onError: (message: string) => void
): Promise<IScannerControls> {
  const qrReader = await getQrReader();
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Camera scan is unavailable in this browser context.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  });

  let stopped = false;
  let timeoutId: number | null = null;
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  await video.play();

  const controls: IScannerControls = {
    stop: () => {
      stopped = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
      video.pause();
      video.srcObject = null;
      for (const track of stream.getTracks()) {
        track.stop();
      }
    }
  };

  const scanFrame = () => {
    if (stopped) {
      return;
    }

    try {
      const frame = drawVideoFrameToCanvas(video);
      if (frame) {
        const decoded = tryDecodeCanvasWithFallback(qrReader, frame);
        if (decoded) {
          controls.stop();
          onText(decoded);
          return;
        }
      }
    } catch (error) {
      if (!stopped && error instanceof Error) {
        onError(error.message);
      }
    }

    timeoutId = window.setTimeout(scanFrame, CAMERA_SCAN_INTERVAL_MS);
  };

  timeoutId = window.setTimeout(scanFrame, CAMERA_SCAN_INTERVAL_MS);
  return controls;
}

async function getQrReader(): Promise<BrowserQRCodeReader> {
  if (!qrReader) {
    const [{ BarcodeFormat, BrowserQRCodeReader }, { DecodeHintType }] = await Promise.all([
      import('@zxing/browser'),
      import('@zxing/library')
    ]);
    const hints = new Map<DecodeHintType, unknown>([
      [DecodeHintType.TRY_HARDER, true],
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]]
    ]);
    qrReader = new BrowserQRCodeReader(hints);
  }
  return qrReader;
}

async function decodeQrDataUrlWithCanvasFallback(
  reader: BrowserQRCodeReader,
  imageUrl: string
): Promise<string> {
  const image = await loadImage(imageUrl);
  const source = drawImageToCanvas(image);
  const decoded = tryDecodeCanvasWithFallback(reader, source);

  if (!decoded) {
    throw new Error(QR_DECODE_ERROR);
  }

  return decoded;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(QR_DECODE_ERROR));
    image.src = src;
  });
}

function drawImageToCanvas(image: HTMLImageElement): HTMLCanvasElement {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = getCanvasContext(canvas);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function getCandidateRegions(source: HTMLCanvasElement): CanvasRegion[] {
  const regions: CanvasRegion[] = [
    { x: 0, y: 0, width: source.width, height: source.height }
  ];
  const brightSquare = findBrightSquareRegion(source);
  if (brightSquare) {
    regions.push(
      brightSquare,
      padRegion(brightSquare, source, 8),
      padRegion(brightSquare, source, 16),
      padRegion(brightSquare, source, 32),
      padRegion(brightSquare, source, 48)
    );
  }
  regions.push(...getCenteredSquareRegions(source));
  return dedupeRegions(regions);
}

function tryDecodeCanvasWithFallback(
  reader: BrowserQRCodeReader,
  source: HTMLCanvasElement
): string {
  const regions = getCandidateRegions(source);

  for (const region of regions) {
    const decoded = tryDecodeRegion(reader, source, region);
    if (decoded) {
      return decoded;
    }
  }

  return '';
}

function tryDecodeRegion(
  reader: BrowserQRCodeReader,
  source: HTMLCanvasElement,
  region: CanvasRegion
): string {
  const raw = drawCanvasRegion(source, region);
  const direct = decodeCanvas(reader, raw);
  if (direct) {
    return direct;
  }

  for (const size of NORMALIZED_QR_SIZES) {
    const resized = resizeCanvas(raw, size);
    const decoded = decodeCanvas(reader, resized);
    if (decoded) {
      return decoded;
    }
  }

  return '';
}

function decodeCanvas(reader: BrowserQRCodeReader, canvas: HTMLCanvasElement): string {
  try {
    return reader.decodeFromCanvas(canvas).getText();
  } catch {
    return '';
  }
}

function drawCanvasRegion(source: HTMLCanvasElement, region: CanvasRegion): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(region.width));
  canvas.height = Math.max(1, Math.round(region.height));
  const context = getCanvasContext(canvas);
  context.drawImage(
    source,
    Math.round(region.x),
    Math.round(region.y),
    Math.round(region.width),
    Math.round(region.height),
    0,
    0,
    canvas.width,
    canvas.height
  );
  return canvas;
}

function resizeCanvas(source: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = getCanvasContext(canvas);
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, size, size);
  return canvas;
}

function drawVideoFrameToCanvas(video: HTMLVideoElement): HTMLCanvasElement | null {
  if (
    video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
    video.videoWidth < 1 ||
    video.videoHeight < 1
  ) {
    return null;
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = getCanvasContext(canvas);
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas rendering is unavailable.');
  }
  return context;
}

function findBrightSquareRegion(source: HTMLCanvasElement): CanvasRegion | null {
  const context = getCanvasContext(source);
  const data = context.getImageData(0, 0, source.width, source.height).data;
  const rowThreshold = Math.max(32, source.width * 0.25);
  const rows: number[] = [];

  for (let y = 0; y < source.height; y += 1) {
    let brightPixels = 0;
    for (let x = 0; x < source.width; x += 1) {
      if (isBrightPixel(data, source.width, x, y)) {
        brightPixels += 1;
      }
    }
    if (brightPixels >= rowThreshold) {
      rows.push(y);
    }
  }

  let best: CanvasRegion | null = null;
  const fullBrightRegion = getBrightRegionInBand(data, source.width, 0, source.height - 1);
  if (fullBrightRegion && isPlausibleQrSquare(fullBrightRegion, source)) {
    best = fullBrightRegion;
  }

  for (const band of contiguousBands(rows, Math.max(48, source.height * 0.08))) {
    const region = getBrightRegionInBand(data, source.width, band.start, band.end);
    if (!region || !isPlausibleQrSquare(region, source)) {
      continue;
    }
    if (!best || region.width * region.height > best.width * best.height) {
      best = region;
    }
  }

  return best;
}

function getBrightRegionInBand(
  data: Uint8ClampedArray,
  width: number,
  startY: number,
  endY: number
): CanvasRegion | null {
  let minX = width;
  let minY = endY;
  let maxX = 0;
  let maxY = startY;
  for (let y = startY; y <= endY; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isBrightPixel(data, width, x, y)) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX > maxX) {
    return null;
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}

function isBrightPixel(data: Uint8ClampedArray, width: number, x: number, y: number): boolean {
  const offset = (y * width + x) * 4;
  return data[offset] > 235 && data[offset + 1] > 235 && data[offset + 2] > 235;
}

function contiguousBands(rows: number[], minHeight: number): Array<{ start: number; end: number }> {
  const bands: Array<{ start: number; end: number }> = [];
  let start: number | null = null;
  let previous: number | null = null;

  for (const row of rows) {
    if (start === null) {
      start = row;
      previous = row;
      continue;
    }
    if (previous !== null && row > previous + 1) {
      if (previous - start + 1 >= minHeight) {
        bands.push({ start, end: previous });
      }
      start = row;
    }
    previous = row;
  }

  if (start !== null && previous !== null && previous - start + 1 >= minHeight) {
    bands.push({ start, end: previous });
  }

  return bands;
}

function isPlausibleQrSquare(region: CanvasRegion, source: HTMLCanvasElement): boolean {
  const ratio = region.width / region.height;
  const minSide = Math.min(source.width, source.height) * 0.2;
  const maxSide = Math.max(source.width, source.height) * 0.95;
  return (
    ratio >= 0.75 &&
    ratio <= 1.25 &&
    region.width >= minSide &&
    region.height >= minSide &&
    region.width <= maxSide &&
    region.height <= maxSide
  );
}

function getCenteredSquareRegions(source: HTMLCanvasElement): CanvasRegion[] {
  const shortSide = Math.min(source.width, source.height);
  const sizes = [0.9, 0.75, 0.6, 0.5].map((scale) => shortSide * scale);
  const centersX = [source.width * 0.5];
  const centersY = [source.height * 0.4, source.height * 0.5, source.height * 0.6, source.height * 0.7];
  const regions: CanvasRegion[] = [];

  for (const size of sizes) {
    for (const centerX of centersX) {
      for (const centerY of centersY) {
        regions.push(clampRegion({
          x: centerX - size / 2,
          y: centerY - size / 2,
          width: size,
          height: size
        }, source));
      }
    }
  }

  return regions;
}

function padRegion(region: CanvasRegion, source: HTMLCanvasElement, padding: number): CanvasRegion {
  return clampRegion({
    x: region.x - padding,
    y: region.y - padding,
    width: region.width + padding * 2,
    height: region.height + padding * 2
  }, source);
}

function clampRegion(region: CanvasRegion, source: HTMLCanvasElement): CanvasRegion {
  const x = Math.max(0, region.x);
  const y = Math.max(0, region.y);
  return {
    x,
    y,
    width: Math.min(region.width, source.width - x),
    height: Math.min(region.height, source.height - y)
  };
}

function dedupeRegions(regions: CanvasRegion[]): CanvasRegion[] {
  const seen = new Set<string>();
  return regions.filter((region) => {
    const key = [
      Math.round(region.x),
      Math.round(region.y),
      Math.round(region.width),
      Math.round(region.height)
    ].join(':');
    if (seen.has(key) || region.width < 1 || region.height < 1) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
