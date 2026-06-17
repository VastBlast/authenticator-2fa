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
});
