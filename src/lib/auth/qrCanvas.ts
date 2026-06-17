import { decodeQrImageData } from './qrDecode';
import { getCandidateRegions as getQrCandidateRegions, type CanvasRegion } from './qrRegions';

type QrCanvas = (HTMLCanvasElement | OffscreenCanvas) & CanvasImageSource;
type QrCanvasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const NORMALIZED_QR_SIZES = [512, 768, 384, 1024, 256];

export function decodeQrFromCanvas<C extends QrCanvas>(
  source: C,
  createCanvas: (width: number, height: number) => C
): string {
  const direct = decodeCanvas(source);
  if (direct) {
    return direct;
  }

  for (const region of getCanvasCandidateRegions(source)) {
    if (isFullRegion(region, source)) {
      continue;
    }

    const decoded = decodeQrRegion(source, region, createCanvas);
    if (decoded) {
      return decoded;
    }
  }

  return '';
}

function getCanvasCandidateRegions(source: QrCanvas): CanvasRegion[] {
  const context = getCanvasContext(source);
  return getQrCandidateRegions({
    width: source.width,
    height: source.height,
    getImageData: () => context.getImageData(0, 0, source.width, source.height).data
  });
}

function decodeQrRegion<C extends QrCanvas>(
  source: C,
  region: CanvasRegion,
  createCanvas: (width: number, height: number) => C
): string {
  const raw = drawCanvasRegion(source, region, createCanvas);
  const direct = decodeCanvas(raw);
  if (direct || !isSquareLike(raw)) {
    return direct;
  }

  for (const size of NORMALIZED_QR_SIZES) {
    if (raw.width === size && raw.height === size) {
      continue;
    }

    const decoded = decodeCanvas(resizeCanvas(raw, size, createCanvas));
    if (decoded) {
      return decoded;
    }
  }

  return '';
}

function decodeCanvas(canvas: QrCanvas): string {
  const context = getCanvasContext(canvas);
  return decodeQrImageData(context.getImageData(0, 0, canvas.width, canvas.height));
}

function drawCanvasRegion<C extends QrCanvas>(
  source: C,
  region: CanvasRegion,
  createCanvas: (width: number, height: number) => C
): C {
  const canvas = createCanvas(
    Math.max(1, Math.round(region.width)),
    Math.max(1, Math.round(region.height))
  );
  const context = getCanvasContext(canvas);
  fillWhite(context, canvas);
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

function resizeCanvas<C extends QrCanvas>(
  source: C,
  size: number,
  createCanvas: (width: number, height: number) => C
): C {
  const canvas = createCanvas(size, size);
  const context = getCanvasContext(canvas);
  context.imageSmoothingEnabled = false;
  fillWhite(context, canvas);
  context.drawImage(source, 0, 0, size, size);
  return canvas;
}

function isSquareLike(canvas: QrCanvas): boolean {
  const ratio = canvas.width / canvas.height;
  return ratio >= 0.8 && ratio <= 1.25;
}

function isFullRegion(region: CanvasRegion, canvas: QrCanvas): boolean {
  return (
    Math.round(region.x) === 0 &&
    Math.round(region.y) === 0 &&
    Math.round(region.width) === canvas.width &&
    Math.round(region.height) === canvas.height
  );
}

function fillWhite(context: QrCanvasContext, canvas: QrCanvas): void {
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function getCanvasContext(canvas: QrCanvas): QrCanvasContext {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas rendering is unavailable.');
  }
  return context;
}
