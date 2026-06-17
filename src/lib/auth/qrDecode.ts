import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import readerWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

export const MAX_QR_IMAGE_PIXELS = 16_000_000;
export const QR_IMAGE_TOO_LARGE_ERROR = 'Selected image is too large to scan as a QR code.';

const READER_OPTIONS = {
  formats: ['QRCode'],
  maxNumberOfSymbols: 1,
  tryHarder: true
} satisfies ReaderOptions;

prepareZXingModule({
  overrides: {
    locateFile: (path: string, prefix: string) =>
      path.endsWith('.wasm') ? readerWasmUrl : prefix + path
  }
});

export async function decodeQrImageData(imageData: {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}) {
  if (
    !Number.isSafeInteger(imageData.width) ||
    imageData.width <= 0 ||
    !Number.isSafeInteger(imageData.height) ||
    imageData.height <= 0
  ) {
    return '';
  }

  assertQrImageBounds(imageData.width, imageData.height);
  if (imageData.data.length < imageData.width * imageData.height * 4) {
    return '';
  }

  const results = await readBarcodes(imageData as ImageData, READER_OPTIONS);
  return results.find(({ text }) => text)?.text ?? '';
}

export function assertQrImageBounds(width: number, height: number): void {
  if (width * height > MAX_QR_IMAGE_PIXELS) {
    throw new Error(QR_IMAGE_TOO_LARGE_ERROR);
  }
}
