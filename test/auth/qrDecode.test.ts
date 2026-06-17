import { toBuffer } from 'qrcode';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { decodeQrImageData } from '../../src/lib/auth/qrDecode';

describe('decodeQrImageData', () => {
  test('decodes a QR embedded in a larger screenshot', async () => {
    const payload = `otpauth-migration://offline?data=${'A'.repeat(520)}`;
    const qr = await toBuffer(payload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 4,
      type: 'png'
    });
    const { data, info } = await sharp({
      create: {
        width: 1179,
        height: 2556,
        channels: 4,
        background: '#101113'
      }
    })
      .composite([{ input: qr, left: 180, top: 790 }])
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const decoded = decodeQrImageData({
      data,
      width: info.width,
      height: info.height
    });

    expect(decoded).toBe(payload);
  });

  test('decodes a dense downscaled QR in a surrounding frame', async () => {
    const payload = `otpauth-migration://offline?data=${seededText(820)}`;
    const qr = await toBuffer(payload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      scale: 8,
      type: 'png'
    });
    const image = await sharp(qr)
      .resize(199, 199, { fit: 'fill', kernel: 'lanczos3' })
      .png()
      .toBuffer();
    const { data, info } = await sharp({
      create: {
        width: 225,
        height: 234,
        channels: 4,
        background: '#111111'
      }
    })
      .composite([{ input: image, left: 13, top: 16 }])
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const decoded = decodeQrImageData({
      data,
      width: info.width,
      height: info.height
    });

    expect(decoded).toBe(payload);
  });
});

function seededText(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let seed = 987654321;
  let value = '';

  for (let index = 0; index < length; index += 1) {
    seed = (1664525 * seed + 1013904223) >>> 0;
    value += alphabet[seed % alphabet.length];
  }

  return value;
}
