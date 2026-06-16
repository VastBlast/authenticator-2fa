import { describe, expect, test } from 'vitest';
import { dataUrlToBlob } from '../../src/lib/auth/qrWorker';

describe('dataUrlToBlob', () => {
  test('converts base64 data URLs without using fetch', async () => {
    const blob = dataUrlToBlob('data:image/png;base64,SGVsbG8=');

    expect(blob.type).toBe('image/png');
    expect(await blob.text()).toBe('Hello');
  });

  test('converts percent-encoded data URLs', async () => {
    const blob = dataUrlToBlob('data:text/plain;charset=utf-8,Hello%20world');

    expect(blob.type).toBe('text/plain');
    expect(await blob.text()).toBe('Hello world');
  });

  test('rejects non-data URLs', () => {
    expect(() => dataUrlToBlob('https://example.com/qr.png')).toThrow('Page scan failed.');
  });
});
