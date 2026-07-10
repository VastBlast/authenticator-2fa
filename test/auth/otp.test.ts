import { expect, test } from 'vitest';
import { encodeBase32 } from '../../src/lib/auth/base32';
import { createAccount, generateOtpCode, hotp, updateAccount } from '../../src/lib/auth/otp';
import {
  accountToOtpAuthUri,
  parseGoogleAuthenticatorMigration,
  parseOtpAuthUri
} from '../../src/lib/auth/otpauth';

const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const rfcTimestamps = [59, 1_111_111_109, 1_111_111_111, 1_234_567_890, 2_000_000_000, 20_000_000_000];
const rfcTotpCases = [
  {
    algorithm: 'SHA-1' as const,
    secret: rfcSecret,
    expected: ['94287082', '07081804', '14050471', '89005924', '69279037', '65353130']
  },
  {
    algorithm: 'SHA-256' as const,
    secret: encodeBase32(new TextEncoder().encode('12345678901234567890123456789012')),
    expected: ['46119246', '68084774', '67062674', '91819424', '90698825', '77737706']
  },
  {
    algorithm: 'SHA-512' as const,
    secret: encodeBase32(
      new TextEncoder().encode('1234567890123456789012345678901234567890123456789012345678901234')
    ),
    expected: ['90693936', '25091201', '99943326', '93441116', '38618901', '47863826']
  }
];

test('HOTP matches RFC 4226 test vectors', async () => {
  const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];

  for (let counter = 0; counter < expected.length; counter += 1) {
    expect(await hotp(rfcSecret, counter)).toBe(expected[counter]);
  }
});

test.each(rfcTotpCases)('TOTP matches every RFC 6238 $algorithm test vector', async ({
  algorithm,
  secret,
  expected
}) => {
  const account = createAccount({ label: `RFC 6238 ${algorithm}`, secret, algorithm, digits: 8 });

  for (const [index, timestamp] of rfcTimestamps.entries()) {
    const code = await generateOtpCode(account, timestamp * 1000);
    expect(code.value, `timestamp ${timestamp}`).toBe(expected[index]);
  }
});

test('TOTP rolls over exactly at a custom period boundary', async () => {
  const sha256Secret = rfcTotpCases[1].secret;
  const account = parseOtpAuthUri(
    `otpauth://totp/Example:alice?secret=${sha256Secret}&issuer=Example&algorithm=sha-256&digits=8&period=45`
  );

  expect(account).toMatchObject({ algorithm: 'SHA-256', digits: 8, period: 45 });
  await expect(generateOtpCode(account, 44_999)).resolves.toMatchObject({
    value: '18920136',
    remaining: 1
  });
  await expect(generateOtpCode(account, 45_000)).resolves.toMatchObject({
    value: '46119246',
    remaining: 45,
    progress: 0
  });
});

test('otpauth parsing normalizes URL-encoded padding and common secret formatting', async () => {
  const account = parseOtpAuthUri(
    'otpauth://totp/Example:User?secret=j3ww-iv3p%20tgjp-qv5q%20aicm%3D%3D%3D%3D&issuer=Example'
  );

  expect(account.secret).toBe('J3WWIV3PTGJPQV5QAICM');
  await expect(generateOtpCode(account, 59_000)).resolves.toMatchObject({ value: '850668' });
});

test.each([
  ['digits=0', 'Digits must be between 5 and 10.'],
  ['period=0', 'Period must be between 5 and 300 seconds.']
])('otpauth parsing rejects unsafe TOTP parameters: %s', (parameter, message) => {
  expect(() =>
    parseOtpAuthUri(`otpauth://totp/Example:alice?secret=${rfcSecret}&issuer=Example&${parameter}`)
  ).toThrow(message);
});

test.each([
  ['algorithm=MD5', 'Unsupported OTP algorithm "MD5".'],
  ['digits=abc', 'Digits must be a non-negative whole number.'],
  ['period=-30', 'Period must be a non-negative whole number.'],
  ['period=30.5', 'Period must be a non-negative whole number.']
])('otpauth parsing does not silently default malformed TOTP parameters: %s', (parameter, message) => {
  expect(() =>
    parseOtpAuthUri(`otpauth://totp/Example:alice?secret=${rfcSecret}&issuer=Example&${parameter}`)
  ).toThrow(message);
});

test('otpauth parsing preserves HOTP counters', () => {
  const account = parseOtpAuthUri(
    `otpauth://hotp/Example:alice@example.com?secret=${rfcSecret}&issuer=Example&counter=42&digits=8`
  );

  expect(account.type).toBe('hotp');
  expect(account.counter).toBe(42);
  expect(account.digits).toBe(8);
});

test('otpauth export and import preserves colons in issuer and account labels', () => {
  const withIssuer = createAccount({
    issuer: 'Team:Ops',
    label: 'alice@example.com',
    secret: rfcSecret
  });
  const parsedWithIssuer = parseOtpAuthUri(accountToOtpAuthUri(withIssuer));

  expect(parsedWithIssuer.issuer).toBe('Team:Ops');
  expect(parsedWithIssuer.label).toBe('alice@example.com');

  const withoutIssuer = createAccount({
    label: 'work:alice@example.com',
    secret: rfcSecret
  });
  const parsedWithoutIssuer = parseOtpAuthUri(accountToOtpAuthUri(withoutIssuer));

  expect(parsedWithoutIssuer.issuer).toBe('');
  expect(parsedWithoutIssuer.label).toBe('work:alice@example.com');
});

test('otpauth parsing rejects secrets that decode to zero bytes', () => {
  expect(() => parseOtpAuthUri('otpauth://totp/Example:alice?secret=A&issuer=Example')).toThrow(
    'Secret is too short.'
  );
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

test('Google Authenticator migration imports are bounded', () => {
  const accountBytes = protoMessage([
    fieldBytes(1, new TextEncoder().encode('12345678901234567890')),
    fieldBytes(2, new TextEncoder().encode('Example:alice@example.com'))
  ]);
  const payload = protoMessage(Array.from({ length: 201 }, () => fieldBytes(1, accountBytes)));
  const data = Buffer.from(payload).toString('base64');

  expect(() =>
    parseGoogleAuthenticatorMigration(`otpauth-migration://offline?data=${encodeURIComponent(data)}`)
  ).toThrow('Authenticator migration contains too many accounts.');
});

test('Google Authenticator migration rejects oversized data before protobuf parsing', () => {
  expect(() =>
    parseGoogleAuthenticatorMigration(`otpauth-migration://offline?data=${'A'.repeat(70_000)}`)
  ).toThrow('Authenticator migration import is too large.');
});

test('updating a Steam account preserves the 5 character code length', () => {
  const account = createAccount({
    label: 'Steam',
    secret: rfcSecret,
    type: 'steam'
  });

  const updated = updateAccount(account, { label: 'Steam account', digits: 8 });

  expect(updated.type).toBe('steam');
  expect(updated.digits).toBe(5);
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
