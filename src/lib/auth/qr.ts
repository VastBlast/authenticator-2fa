import { toDataURL } from 'qrcode';
import { assertQrImageBounds, decodeQrImageData, QR_IMAGE_TOO_LARGE_ERROR } from './qrDecode';

const QR_DECODE_ERROR = 'No QR code could be decoded from the selected image. Use a clear image with the whole QR code visible.';
const MAX_QR_IMAGE_FILES = 20;
const MAX_QR_IMAGE_FILE_BYTES = 10 * 1024 * 1024;

export async function decodeQrFile(file: File) {
  if (file.size > MAX_QR_IMAGE_FILE_BYTES) {
    throw new Error(QR_IMAGE_TOO_LARGE_ERROR);
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    return await decodeQrDataUrl(imageUrl);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

export async function decodeQrDataUrl(imageUrl: string) {
  const image = new Image();
  image.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(QR_DECODE_ERROR));
    image.src = imageUrl;
  });

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  assertQrImageBounds(width, height);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas rendering is unavailable.');
  }

  context.fillStyle = '#fff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const decoded = await decodeQrImageData(context.getImageData(0, 0, width, height));
  if (!decoded) {
    throw new Error(QR_DECODE_ERROR);
  }

  return decoded;
}

export async function decodeQrFiles(files: FileList | File[]) {
  if (files.length > MAX_QR_IMAGE_FILES) {
    throw new Error(`Select ${MAX_QR_IMAGE_FILES} or fewer QR images at a time.`);
  }

  const decoded: string[] = [];
  let failed = false;

  for (const file of Array.from(files)) {
    try {
      decoded.push(await decodeQrFile(file));
    } catch (error) {
      if (error instanceof Error && error.message === QR_IMAGE_TOO_LARGE_ERROR) {
        throw error;
      }
      failed = true;
    }
  }

  if (decoded.length === 0 && failed) {
    throw new Error(QR_DECODE_ERROR);
  }

  return decoded;
}

export async function renderQrDataUrl(text: string) {
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
