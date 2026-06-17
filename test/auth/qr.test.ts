import { describe, expect, test } from 'vitest';
import { decodeQrFiles } from '../../src/lib/auth/qr';

describe('decodeQrFiles', () => {
  test('rejects excessive QR image batches before decoding', async () => {
    const files = Array.from({ length: 21 }, (_, index) => new File(['x'], `${index}.png`, {
      type: 'image/png'
    }));

    await expect(decodeQrFiles(files)).rejects.toThrow('Select 20 or fewer QR images at a time.');
  });
});
