import { decodeQrImageData } from './qrDecode';

const QR_DECODE_ERROR = 'No QR code was found in that selection.';

export async function decodeQrDataUrlInWorker(dataUrl: string) {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') {
    throw new Error('Page scan decoding is unavailable here.');
  }

  const blob = dataUrlToBlob(dataUrl);
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Canvas rendering is unavailable.');
    }

    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0);

    const decoded = await decodeQrImageData(
      context.getImageData(0, 0, canvas.width, canvas.height)
    );
    if (!decoded) {
      throw new Error(QR_DECODE_ERROR);
    }
    return decoded;
  } finally {
    bitmap.close();
  }
}

export function dataUrlToBlob(dataUrl: string) {
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
