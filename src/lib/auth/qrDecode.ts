import { prepareZXingModule, readBarcodes, type ReaderOptions } from 'zxing-wasm/reader';
import readerWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

export interface QrImageData {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

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

export async function decodeQrImageData(imageData: QrImageData): Promise<string> {
  if (
    imageData.width < 1 ||
    imageData.height < 1 ||
    imageData.data.length < imageData.width * imageData.height * 4
  ) {
    return '';
  }

  const results = await readBarcodes(imageData as ImageData, READER_OPTIONS);
  return results.find(({ text }) => text)?.text ?? '';
}
