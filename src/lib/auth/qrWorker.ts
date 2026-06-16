import BinaryBitmap from '@zxing/library/esm/core/BinaryBitmap';
import DecodeHintType from '@zxing/library/esm/core/DecodeHintType';
import RGBLuminanceSource from '@zxing/library/esm/core/RGBLuminanceSource';
import HybridBinarizer from '@zxing/library/esm/core/common/HybridBinarizer';
import QRCodeReader from '@zxing/library/esm/core/qrcode/QRCodeReader';
import { getCandidateRegions as getQrCandidateRegions, type CanvasRegion } from './qrRegions';

const NORMALIZED_QR_SIZES = [384, 512, 768, 320, 448, 256, 1024];
const QR_DECODE_ERROR = 'No QR code was found in that selection.';

export async function decodeQrDataUrlInWorker(dataUrl: string): Promise<string> {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new Error('Page scan decoding is unavailable here.');
  }

  const blob = dataUrlToBlob(dataUrl);
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = getCanvasContext(canvas);
    context.drawImage(bitmap, 0, 0);

    const decoded = tryDecodeCanvasWithFallback(canvas);
    if (!decoded) {
      throw new Error(QR_DECODE_ERROR);
    }
    return decoded;
  } finally {
    bitmap.close();
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^,]*),(.*)$/s.exec(dataUrl);
  if (!match) {
    throw new Error('Page scan failed.');
  }

  const metadata = match[1] ?? '';
  const encodedData = match[2] ?? '';
  const metadataParts = metadata.split(';').filter(Boolean);
  const mimeType = metadataParts.find((part) => part.includes('/')) ?? 'application/octet-stream';
  const isBase64 = metadataParts.some((part) => part.toLowerCase() === 'base64');

  if (!isBase64) {
    return new Blob([new TextEncoder().encode(decodeURIComponent(encodedData))], {
      type: mimeType
    });
  }

  const binary = atob(encodedData);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function tryDecodeCanvasWithFallback(source: OffscreenCanvas): string {
  const regions = getCanvasCandidateRegions(source);

  for (const region of regions) {
    const decoded = tryDecodeRegion(source, region);
    if (decoded) {
      return decoded;
    }
  }

  return '';
}

function tryDecodeRegion(source: OffscreenCanvas, region: CanvasRegion): string {
  const raw = drawCanvasRegion(source, region);
  const direct = decodeCanvas(raw);
  if (direct) {
    return direct;
  }

  for (const size of NORMALIZED_QR_SIZES) {
    const resized = resizeCanvas(raw, size);
    const decoded = decodeCanvas(resized);
    if (decoded) {
      return decoded;
    }
  }

  return '';
}

function decodeCanvas(canvas: OffscreenCanvas): string {
  try {
    const context = getCanvasContext(canvas);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const luminances = getLuminances(imageData);
    const source = new RGBLuminanceSource(luminances, imageData.width, imageData.height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    const hints = new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]]);
    return new QRCodeReader().decode(bitmap, hints).getText();
  } catch {
    return '';
  }
}

function getLuminances(imageData: ImageData): Uint8ClampedArray {
  const luminances = new Uint8ClampedArray(imageData.width * imageData.height);
  const data = imageData.data;
  for (let source = 0, target = 0; source < data.length; source += 4, target += 1) {
    luminances[target] = (data[source] + data[source + 1] * 2 + data[source + 2]) >> 2;
  }
  return luminances;
}

function drawCanvasRegion(source: OffscreenCanvas, region: CanvasRegion): OffscreenCanvas {
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(region.width)),
    Math.max(1, Math.round(region.height))
  );
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

function resizeCanvas(source: OffscreenCanvas, size: number): OffscreenCanvas {
  const canvas = new OffscreenCanvas(size, size);
  const context = getCanvasContext(canvas);
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, 0, size, size);
  return canvas;
}

function getCanvasContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas rendering is unavailable.');
  }
  return context;
}

function getCanvasCandidateRegions(source: OffscreenCanvas): CanvasRegion[] {
  const context = getCanvasContext(source);
  return getQrCandidateRegions({
    width: source.width,
    height: source.height,
    getImageData: () => context.getImageData(0, 0, source.width, source.height).data
  });
}
