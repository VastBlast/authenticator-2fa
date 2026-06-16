const RFC4648_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function normalizeBase32(value: string): string {
  return value.replace(/[\s-]/g, '').replace(/=+$/g, '').toUpperCase();
}

export function isBase32(value: string): boolean {
  const normalized = normalizeBase32(value);
  return normalized.length > 0 && /^[A-Z2-7]+$/.test(normalized);
}

export function decodeBase32(value: string): Uint8Array {
  const normalized = normalizeBase32(value);
  if (!isBase32(normalized)) {
    throw new Error('Secret must be Base32 using A-Z and 2-7.');
  }

  let bits = 0;
  let bitLength = 0;
  const bytes: number[] = [];

  for (const char of normalized) {
    const index = RFC4648_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`Invalid Base32 character "${char}".`);
    }

    bits = (bits << 5) | index;
    bitLength += 5;

    while (bitLength >= 8) {
      bytes.push((bits >> (bitLength - 8)) & 0xff);
      bitLength -= 8;
    }
  }

  return Uint8Array.from(bytes);
}

export function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let bitLength = 0;
  let output = '';

  for (const byte of bytes) {
    bits = (bits << 8) | byte;
    bitLength += 8;

    while (bitLength >= 5) {
      output += RFC4648_ALPHABET[(bits >> (bitLength - 5)) & 31];
      bitLength -= 5;
    }
  }

  if (bitLength > 0) {
    output += RFC4648_ALPHABET[(bits << (5 - bitLength)) & 31];
  }

  return output;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
