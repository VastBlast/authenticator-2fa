import { decodeBase32, normalizeBase32 } from './base32';
import type { AccountDraft, AuthenticatorAccount, OtpAlgorithm, OtpCode } from './types';

const STEAM_ALPHABET = '23456789BCDFGHJKMNPQRTVWXY';

export function createAccount(draft: AccountDraft): AuthenticatorAccount {
  const now = new Date().toISOString();
  const type = draft.type ?? 'totp';
  const digits = type === 'steam' ? 5 : draft.digits ?? 6;
  const period = type === 'hotp' ? 30 : draft.period ?? 30;

  validateAccountDraft({ ...draft, type, digits, period });

  return {
    id: crypto.randomUUID(),
    issuer: (draft.issuer ?? '').trim(),
    label: draft.label.trim(),
    secret: normalizeBase32(draft.secret),
    type,
    algorithm: draft.algorithm ?? 'SHA-1',
    digits,
    period,
    counter: Math.max(0, Math.trunc(draft.counter ?? 0)),
    sortOrder: draft.sortOrder,
    createdAt: now,
    updatedAt: now
  };
}

export function updateAccount(
  account: AuthenticatorAccount,
  patch: Partial<AccountDraft>
): AuthenticatorAccount {
  const type = patch.type ?? account.type;
  const next: AuthenticatorAccount = {
    ...account,
    issuer: patch.issuer === undefined ? account.issuer : patch.issuer.trim(),
    label: patch.label === undefined ? account.label : patch.label.trim(),
    secret: patch.secret === undefined ? account.secret : normalizeBase32(patch.secret),
    type,
    algorithm: patch.algorithm ?? account.algorithm,
    digits: type === 'steam' ? 5 : patch.digits ?? account.digits,
    period: patch.period ?? account.period,
    counter: Math.max(0, Math.trunc(patch.counter ?? account.counter)),
    updatedAt: new Date().toISOString()
  };

  validateAccountDraft(next);
  return next;
}

export function validateAccountDraft(draft: AccountDraft): void {
  if (!draft.label?.trim()) {
    throw new Error('Account name is required.');
  }

  decodeBase32(draft.secret);

  const type = draft.type ?? 'totp';
  if (!['totp', 'hotp', 'steam'].includes(type)) {
    throw new Error('Unsupported OTP type.');
  }

  const digits = type === 'steam' ? 5 : draft.digits ?? 6;
  if (!Number.isInteger(digits) || digits < 5 || digits > 10) {
    throw new Error('Digits must be between 5 and 10.');
  }

  const period = draft.period ?? 30;
  if (type !== 'hotp' && (!Number.isInteger(period) || period < 5 || period > 300)) {
    throw new Error('Period must be between 5 and 300 seconds.');
  }

  const counter = draft.counter ?? 0;
  if (!Number.isInteger(counter) || counter < 0) {
    throw new Error('Counter must be a positive whole number.');
  }
}

export async function generateOtpCode(
  account: AuthenticatorAccount,
  now = Date.now()
): Promise<OtpCode> {
  const counter =
    account.type === 'hotp' ? account.counter : Math.floor(Math.floor(now / 1000) / account.period);
  const value =
    account.type === 'steam'
      ? await generateSteamCode(account.secret, counter)
      : await hotp(account.secret, counter, account.digits, account.algorithm);
  const remaining =
    account.type === 'hotp' ? 0 : account.period - (Math.floor(now / 1000) % account.period);

  return {
    accountId: account.id,
    value,
    remaining,
    progress: account.type === 'hotp' ? 100 : ((account.period - remaining) / account.period) * 100
  };
}

export async function hotp(
  secret: string,
  counter: number,
  digits = 6,
  algorithm: OtpAlgorithm = 'SHA-1'
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(decodeBase32(secret)),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );
  const counterBytes = new ArrayBuffer(8);
  const view = new DataView(counterBytes);
  view.setUint32(0, Math.floor(counter / 0x100000000));
  view.setUint32(4, counter >>> 0);

  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes));
  const offset = signature[signature.length - 1] & 0x0f;
  const binary =
    ((signature[offset] & 0x7f) << 24) |
    ((signature[offset + 1] & 0xff) << 16) |
    ((signature[offset + 2] & 0xff) << 8) |
    (signature[offset + 3] & 0xff);
  const modulus = 10 ** digits;

  return String(binary % modulus).padStart(digits, '0');
}

export async function generateSteamCode(secret: string, counter: number): Promise<string> {
  const numeric = Number(await hotp(secret, counter, 10, 'SHA-1'));
  let code = '';
  let value = numeric;

  for (let index = 0; index < 5; index += 1) {
    code += STEAM_ALPHABET[value % STEAM_ALPHABET.length];
    value = Math.floor(value / STEAM_ALPHABET.length);
  }

  return code;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
