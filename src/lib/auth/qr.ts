import type { BrowserQRCodeReader } from '@zxing/browser';
import type { DecodeHintType } from '@zxing/library';
import { getCandidateRegions as getQrCandidateRegions, type CanvasRegion } from './qrRegions';

let qrReader: BrowserQRCodeReader | null = null;

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

function getCanvasCandidateRegions(source: HTMLCanvasElement): CanvasRegion[] {
  const context = getCanvasContext(source);
  return getQrCandidateRegions({
    width: source.width,
    height: source.height,
    getImageData: () => context.getImageData(0, 0, source.width, source.height).data
  });
}

function tryDecodeCanvasWithFallback(
  reader: BrowserQRCodeReader,
  source: HTMLCanvasElement
): string {
  const regions = getCanvasCandidateRegions(source);

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

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas rendering is unavailable.');
  }
  return context;
}
