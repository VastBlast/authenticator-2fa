import { describe, expect, test } from 'vitest';
import { decodeBase32, encodeBase32, normalizeBase32 } from '../../src/lib/auth/base32';

describe('Base32 secrets', () => {
  test('round-trips every legal unpadded tail length with or without padding', () => {
    const observedTailLengths = new Set<number>();

    for (let length = 1; length <= 10; length += 1) {
      const bytes = Uint8Array.from({ length }, (_, index) => (length * 29 + index * 47) & 0xff);
      const encoded = encodeBase32(bytes);
      const padded = encoded.padEnd(Math.ceil(encoded.length / 8) * 8, '=');

      observedTailLengths.add(encoded.length % 8);
      expect(decodeBase32(encoded)).toEqual(bytes);
      expect(decodeBase32(padded)).toEqual(bytes);
    }

    expect([...observedTailLengths].sort((left, right) => left - right)).toEqual([0, 2, 4, 5, 7]);
  });

  test('normalizes lowercase secrets and common visual separators', () => {
    const canonical = 'J3WWIV3PTGJPQV5QAICM';
    const formatted = 'j3ww-iv3p tgjp-qv5q\naicm====';

    expect(normalizeBase32(formatted)).toBe(canonical);
    expect(decodeBase32(formatted)).toEqual(decodeBase32(canonical));
  });

  test.each(['JBSWY3DP!', 'JBSW=Y3DP'])(
    'rejects invalid characters or misplaced padding in %s',
    (secret) => {
      expect(() => decodeBase32(secret)).toThrow('Secret must be Base32 using A-Z and 2-7.');
    }
  );
});
