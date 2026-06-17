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
const QUIET_ZONE_LUMINANCES = [255, 0];

export function decodeQrImageData(imageData: QrImageData): string {
  if (
    imageData.width < 1 ||
    imageData.height < 1 ||
    imageData.data.length < imageData.width * imageData.height * 4
  ) {
    return '';
  }

  const luminances = getLuminances(imageData);
  const source = createSource(luminances, imageData.width, imageData.height);
  const direct = decodeSource(source) || decodeSource(source.invert());
  if (direct) {
    return direct;
  }

  const padding = getQuietZonePadding(imageData.width, imageData.height);
  for (const value of QUIET_ZONE_LUMINANCES) {
    const padded = createSource(
      addQuietZone(luminances, imageData.width, imageData.height, padding, value),
      imageData.width + padding * 2,
      imageData.height + padding * 2
    );
    const decoded = decodeSource(padded) || decodeSource(padded.invert());
    if (decoded) {
      return decoded;
    }
  }

  return '';
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

function createSource(
  luminances: Uint8ClampedArray,
  width: number,
  height: number
): RGBLuminanceSource {
  return new RGBLuminanceSource(luminances, width, height);
}

function getQuietZonePadding(width: number, height: number): number {
  return Math.min(96, Math.max(24, Math.round(Math.min(width, height) * 0.1)));
}

function addQuietZone(
  luminances: Uint8ClampedArray,
  width: number,
  height: number,
  padding: number,
  value: number
): Uint8ClampedArray {
  const paddedWidth = width + padding * 2;
  const padded = new Uint8ClampedArray(paddedWidth * (height + padding * 2));
  padded.fill(value);

  for (let y = 0; y < height; y += 1) {
    padded.set(
      luminances.subarray(y * width, (y + 1) * width),
      (y + padding) * paddedWidth + padding
    );
  }

  return padded;
}
