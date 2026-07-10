import { readFileSync } from 'node:fs';
import { toBuffer } from 'qrcode';
import sharp from 'sharp';
import { describe, expect, test } from 'vitest';
import { prepareZXingModule } from 'zxing-wasm/reader';
import { generateOtpCode } from '../../src/lib/auth/otp';
import { parseOtpAuthUri } from '../../src/lib/auth/otpauth';
import { decodeQrImageData, QR_IMAGE_TOO_LARGE_ERROR } from '../../src/lib/auth/qrDecode';

const wasm = readFileSync(
  new URL('../../node_modules/zxing-wasm/dist/reader/zxing_reader.wasm', import.meta.url)
);

prepareZXingModule({
  overrides: {
    wasmBinary: wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength)
  }
});

describe('decodeQrImageData', () => {
  test('rejects oversized image dimensions before QR decoding', async () => {
    await expect(
      decodeQrImageData({
        data: new Uint8Array(),
        width: 5000,
        height: 5000
      })
    ).rejects.toThrow(QR_IMAGE_TOO_LARGE_ERROR);
  });

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

    const decoded = await decodeQrImageData({
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

    const decoded = await decodeQrImageData({
      data,
      width: info.width,
      height: info.height
    });

    expect(decoded).toBe(payload);
  });

  test('imports non-block-aligned Base32 secrets with or without padding', async () => {
    const unpaddedSecret = 'J3WWIV3PTGJPQV5QAICM';

    for (const secret of [unpaddedSecret, `${unpaddedSecret}====`]) {
      const payload = `otpauth://totp/Example:User?secret=${secret}&issuer=Example`;
      const qr = await toBuffer(payload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        scale: 4,
        type: 'png'
      });
      const { data, info } = await sharp(qr)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const decoded = await decodeQrImageData({
        data,
        width: info.width,
        height: info.height
      });
      const account = parseOtpAuthUri(decoded);

      expect(decoded).toBe(payload);
      expect(account.secret).toBe(unpaddedSecret);
      await expect(generateOtpCode(account, 59_000)).resolves.toMatchObject({ value: '850668' });
    }
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
