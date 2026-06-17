import {
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  QRCodeReader,
  RGBLuminanceSource,
  type Binarizer,
  type LuminanceSource
} from '@zxing/library';

export interface QrImageData {
  data: Uint8ClampedArray | Uint8Array;
  width: number;
  height: number;
}

type BinarizerConstructor = new (source: LuminanceSource) => Binarizer;

const BINARIZERS: BinarizerConstructor[] = [GlobalHistogramBinarizer, HybridBinarizer];
const DECODE_HINTS = new Map<DecodeHintType, unknown>([[DecodeHintType.TRY_HARDER, true]]);

export function decodeQrImageData(imageData: QrImageData): string {
  if (
    imageData.width < 1 ||
    imageData.height < 1 ||
    imageData.data.length < imageData.width * imageData.height * 4
  ) {
    return '';
  }

  const source = new RGBLuminanceSource(
    getLuminances(imageData),
    imageData.width,
    imageData.height
  );
  return decodeSource(source) || decodeSource(source.invert());
}

function decodeSource(source: LuminanceSource): string {
  const reader = new QRCodeReader();

  for (const Binarizer of BINARIZERS) {
    try {
      return reader.decode(new BinaryBitmap(new Binarizer(source)), DECODE_HINTS).getText();
    } catch {
      reader.reset();
    }
  }

  return '';
}

function getLuminances({ data, width, height }: QrImageData): Uint8ClampedArray {
  const luminances = new Uint8ClampedArray(width * height);

  for (let source = 0, target = 0; target < luminances.length; source += 4, target += 1) {
    const alpha = data[source + 3] ?? 255;
    let red = data[source];
    let green = data[source + 1];
    let blue = data[source + 2];

    if (alpha < 255) {
      const inverseAlpha = 255 - alpha;
      red = (red * alpha + 255 * inverseAlpha) / 255;
      green = (green * alpha + 255 * inverseAlpha) / 255;
      blue = (blue * alpha + 255 * inverseAlpha) / 255;
    }

    luminances[target] = (red + green * 2 + blue) >> 2;
  }

  return luminances;
}
