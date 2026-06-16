import { base64ToBytes, encodeBase32, normalizeBase32 } from './base32';
import { createAccount } from './otp';
import { readProtoFields } from './protobuf';
import type { AccountDraft, AuthenticatorAccount, ImportResult, OtpAlgorithm, OtpType } from './types';

interface MigrationOtpParameters {
  secret?: Uint8Array;
  name?: string;
  issuer?: string;
  algorithm?: number;
  digits?: number;
  type?: number;
  counter?: number;
}

export function parseImportText(input: string): ImportResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const result: ImportResult = { accounts: [], imported: 0, skipped: 0, errors: [] };

  for (const line of lines) {
    try {
      const accounts = line.startsWith('otpauth-migration:')
        ? parseGoogleAuthenticatorMigration(line)
        : [parseOtpAuthUri(line)];

      result.accounts.push(...accounts);
      result.imported += accounts.length;
    } catch (error) {
      result.skipped += 1;
      result.errors.push(error instanceof Error ? error.message : 'Unable to parse import line.');
    }
  }

  return result;
}

export function parseOtpAuthUri(uri: string): AuthenticatorAccount {
  const url = new URL(uri);
  if (url.protocol !== 'otpauth:') {
    throw new Error('Only otpauth:// URIs are supported.');
  }

  const type =
    url.searchParams.get('otp_type')?.toLowerCase() === 'steam'
      ? 'steam'
      : parseOtpType(url.hostname.toLowerCase());
  const labelPart = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  const labelPieces = labelPart.split(':');
  const issuerFromLabel = labelPieces.length > 1 ? labelPieces.shift()?.trim() : '';
  const label = (labelPieces.join(':') || labelPart).trim();
  const issuer = decodeParameter(url.searchParams.get('issuer')) || issuerFromLabel || '';
  const secret = url.searchParams.get('secret');

  if (!secret) {
    throw new Error('otpauth URI is missing a secret.');
  }

  return createAccount({
    issuer,
    label,
    secret,
    type,
    algorithm: parseAlgorithm(url.searchParams.get('algorithm')),
    digits: parseDigits(url.searchParams.get('digits'), type),
    period: parsePositiveInt(url.searchParams.get('period')) ?? 30,
    counter: parsePositiveInt(url.searchParams.get('counter')) ?? 0
  });
}

export function accountToOtpAuthUri(account: AuthenticatorAccount): string {
  const uriType = account.type === 'hotp' ? 'hotp' : 'totp';
  const label = account.issuer ? `${account.issuer}:${account.label}` : account.label;
  const params = new URLSearchParams({
    secret: normalizeBase32(account.secret),
    issuer: account.issuer,
    algorithm: account.algorithm.replace('-', ''),
    digits: String(account.digits)
  });

  if (account.type === 'hotp') {
    params.set('counter', String(account.counter));
  } else {
    params.set('period', String(account.period));
  }

  if (account.type === 'steam') {
    params.set('otp_type', 'steam');
  }

  return `otpauth://${uriType}/${encodeURIComponent(label)}?${params.toString()}`;
}

export function exportOtpAuthText(accounts: AuthenticatorAccount[]): string {
  return accounts.map(accountToOtpAuthUri).join('\r\n');
}

export function parseGoogleAuthenticatorMigration(uri: string): AuthenticatorAccount[] {
  const data = getMigrationData(uri);
  const payload = base64ToBytes(data);
  const accounts: AuthenticatorAccount[] = [];

  for (const field of readProtoFields(payload)) {
    if (field.fieldNumber !== 1 || field.wireType !== 2 || !(field.value instanceof Uint8Array)) {
      continue;
    }

    const otp = parseMigrationOtp(field.value);
    if (!otp.secret || !otp.name) {
      continue;
    }

    const draft = migrationOtpToDraft(otp);
    accounts.push(createAccount(draft));
  }

  if (accounts.length === 0) {
    throw new Error('Authenticator migration QR contained no accounts.');
  }

  return accounts;
}

function getMigrationData(uri: string): string {
  const marker = 'data=';
  const markerIndex = uri.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error('Migration URI is missing data.');
  }

  const raw = uri.slice(markerIndex + marker.length).split('&')[0];
  return decodeURIComponent(raw.replace(/\s/g, ''));
}

function parseMigrationOtp(bytes: Uint8Array): MigrationOtpParameters {
  const decoder = new TextDecoder();
  const otp: MigrationOtpParameters = {};

  for (const field of readProtoFields(bytes)) {
    if (field.wireType === 2 && field.value instanceof Uint8Array) {
      if (field.fieldNumber === 1) {
        otp.secret = field.value;
      } else if (field.fieldNumber === 2) {
        otp.name = decoder.decode(field.value);
      } else if (field.fieldNumber === 3) {
        otp.issuer = decoder.decode(field.value);
      }
      continue;
    }

    if (field.wireType === 0 && typeof field.value === 'bigint') {
      const numeric = Number(field.value);
      if (field.fieldNumber === 4) {
        otp.algorithm = numeric;
      } else if (field.fieldNumber === 5) {
        otp.digits = numeric;
      } else if (field.fieldNumber === 6) {
        otp.type = numeric;
      } else if (field.fieldNumber === 7) {
        otp.counter = numeric;
      }
    }
  }

  return otp;
}

function migrationOtpToDraft(otp: MigrationOtpParameters): AccountDraft {
  const name = otp.name ?? '';
  const issuer = otp.issuer || (name.includes(':') ? name.split(':')[0] : '');
  const label = name.includes(':') ? name.split(':').slice(1).join(':') : name;

  return {
    issuer,
    label: label || issuer || 'Imported account',
    secret: encodeBase32(otp.secret ?? new Uint8Array()),
    type: otp.type === 1 ? 'hotp' : 'totp',
    algorithm: migrationAlgorithm(otp.algorithm),
    digits: otp.digits === 2 ? 8 : 6,
    period: 30,
    counter: otp.counter ?? 0
  };
}

function parseOtpType(value: string): OtpType {
  if (value === 'totp' || value === 'hotp' || value === 'steam') {
    return value;
  }
  throw new Error(`Unsupported OTP type "${value}".`);
}

function parseAlgorithm(value: string | null): OtpAlgorithm {
  const normalized = (value ?? 'SHA1').replace(/[-_\s]/g, '').toUpperCase();
  if (normalized === 'SHA256') {
    return 'SHA-256';
  }
  if (normalized === 'SHA512') {
    return 'SHA-512';
  }
  return 'SHA-1';
}

function migrationAlgorithm(value: number | undefined): OtpAlgorithm {
  if (value === 2) {
    return 'SHA-256';
  }
  if (value === 3) {
    return 'SHA-512';
  }
  return 'SHA-1';
}

function parseDigits(value: string | null, type: OtpType): number {
  if (type === 'steam') {
    return 5;
  }
  const digits = parsePositiveInt(value);
  return digits ?? 6;
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : undefined;
}

function decodeParameter(value: string | null): string {
  if (!value) {
    return '';
  }
  return value.replace(/\+/g, ' ').trim();
}
