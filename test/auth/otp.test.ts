import { expect, test } from 'vitest';
import { encodeBase32 } from '../../src/lib/auth/base32';
import { hotp } from '../../src/lib/auth/otp';
import { parseGoogleAuthenticatorMigration, parseOtpAuthUri } from '../../src/lib/auth/otpauth';

const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('HOTP matches RFC 4226 test vectors', async () => {
  const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];

  for (let counter = 0; counter < expected.length; counter += 1) {
    expect(await hotp(rfcSecret, counter)).toBe(expected[counter]);
  }
});

test('TOTP matches RFC 6238 SHA-1 test vector at 59 seconds', async () => {
  expect(await hotp(rfcSecret, 1, 8, 'SHA-1')).toBe('94287082');
});

test('TOTP supports SHA-256 and SHA-512 secrets', async () => {
  const sha256Secret = encodeBase32(new TextEncoder().encode('12345678901234567890123456789012'));
  const sha512Secret = encodeBase32(
    new TextEncoder().encode('1234567890123456789012345678901234567890123456789012345678901234')
  );

  expect(await hotp(sha256Secret, 1, 8, 'SHA-256')).toBe('46119246');
  expect(await hotp(sha512Secret, 1, 8, 'SHA-512')).toBe('90693936');
});

test('otpauth parsing preserves HOTP counters', () => {
  const account = parseOtpAuthUri(
    `otpauth://hotp/Example:alice@example.com?secret=${rfcSecret}&issuer=Example&counter=42&digits=8`
  );

  expect(account.type).toBe('hotp');
  expect(account.counter).toBe(42);
  expect(account.digits).toBe(8);
});

test('Google Authenticator migration protobuf payloads are decoded', () => {
  const accountBytes = protoMessage([
    fieldBytes(1, new TextEncoder().encode('12345678901234567890')),
    fieldBytes(2, new TextEncoder().encode('Example:alice@example.com')),
    fieldBytes(3, new TextEncoder().encode('Example')),
    fieldVarint(4, 2),
    fieldVarint(5, 2),
    fieldVarint(6, 1),
    fieldVarint(7, 42)
  ]);
  const payload = protoMessage([fieldBytes(1, accountBytes)]);
  const data = Buffer.from(payload).toString('base64');
  const [account] = parseGoogleAuthenticatorMigration(`otpauth-migration://offline?data=${encodeURIComponent(data)}`);

  expect(account.type).toBe('hotp');
  expect(account.algorithm).toBe('SHA-256');
  expect(account.digits).toBe(8);
  expect(account.counter).toBe(42);
  expect(account.issuer).toBe('Example');
  expect(account.label).toBe('alice@example.com');
  expect(account.secret).toBe(rfcSecret);
});

function protoMessage(parts: Uint8Array[]): Uint8Array {
  return concat(parts);
}

function fieldVarint(fieldNumber: number, value: number): Uint8Array {
  return concat([encodeVarint((fieldNumber << 3) | 0), encodeVarint(value)]);
}

function fieldBytes(fieldNumber: number, value: Uint8Array): Uint8Array {
  return concat([encodeVarint((fieldNumber << 3) | 2), encodeVarint(value.length), value]);
}

function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  let current = value;

  while (current >= 0x80) {
    bytes.push((current & 0x7f) | 0x80);
    current >>>= 7;
  }
  bytes.push(current);

  return Uint8Array.from(bytes);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}
