import { toDataURL } from 'qrcode';
import { decodeQrFromCanvas } from './qrCanvas';

const QR_DECODE_ERROR = 'No QR code could be decoded from the selected image. Use a clear image with the whole QR code visible.';

export async function decodeQrFile(file: File): Promise<string> {
  const imageUrl = URL.createObjectURL(file);
  try {
    return await decodeQrDataUrl(imageUrl);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function decodeQrDataUrl(imageUrl: string): Promise<string> {
  return decodeQrDataUrlWithCanvasFallback(imageUrl);
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

async function decodeQrDataUrlWithCanvasFallback(imageUrl: string): Promise<string> {
  const image = await loadImage(imageUrl);
  const source = drawImageToCanvas(image);
  const decoded = decodeQrFromCanvas(source, createCanvas);

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
  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas rendering is unavailable.');
  }
  return context;
}
