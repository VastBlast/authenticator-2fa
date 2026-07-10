import { base64ToBytes, encodeBase32, normalizeBase32 } from './base32';
import { createAccount } from './otp';
import { readProtoFields } from './protobuf';
import type { AccountDraft, AuthenticatorAccount, ImportResult, OtpAlgorithm, OtpType } from './types';

const MAX_MIGRATION_URI_LENGTH = 64_000;
const MAX_MIGRATION_PAYLOAD_BYTES = 48_000;
const MAX_MIGRATION_DATA_CHARS = 65_536;
const MAX_MIGRATION_FIELDS = 2_000;
const MAX_MIGRATION_ACCOUNT_FIELDS = 32;
const MAX_MIGRATION_FIELD_BYTES = 8_192;
const MAX_MIGRATION_ACCOUNTS = 200;
const MIGRATION_TOO_LARGE_ERROR = 'Authenticator migration import is too large.';

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
  const issuerParameter = url.searchParams.get('issuer');
  const { issuer, label } = parseOtpLabel(
    labelPart,
    url.searchParams.has('issuer') ? decodeParameter(issuerParameter) : null
  );
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
    period: parseOptionalNonNegativeInteger(url.searchParams.get('period'), 'Period') ?? 30,
    counter: parseOptionalNonNegativeInteger(url.searchParams.get('counter'), 'Counter') ?? 0
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
  if (uri.length > MAX_MIGRATION_URI_LENGTH) {
    throw new Error(MIGRATION_TOO_LARGE_ERROR);
  }

  const data = getMigrationData(uri);
  if (data.length > MAX_MIGRATION_DATA_CHARS) {
    throw new Error(MIGRATION_TOO_LARGE_ERROR);
  }

  const payload = base64ToBytes(data);
  if (payload.length > MAX_MIGRATION_PAYLOAD_BYTES) {
    throw new Error(MIGRATION_TOO_LARGE_ERROR);
  }

  const accounts: AuthenticatorAccount[] = [];

  for (const field of readProtoFields(payload, {
    maxFields: MAX_MIGRATION_FIELDS,
    maxLengthDelimitedBytes: MAX_MIGRATION_FIELD_BYTES
  })) {
    if (field.fieldNumber !== 1 || field.wireType !== 2 || !(field.value instanceof Uint8Array)) {
      continue;
    }

    const otp = parseMigrationOtp(field.value);
    if (!otp.secret || !otp.name) {
      continue;
    }

    const draft = migrationOtpToDraft(otp);
    if (accounts.length >= MAX_MIGRATION_ACCOUNTS) {
      throw new Error('Authenticator migration contains too many accounts.');
    }
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

  for (const field of readProtoFields(bytes, {
    maxFields: MAX_MIGRATION_ACCOUNT_FIELDS,
    maxLengthDelimitedBytes: MAX_MIGRATION_FIELD_BYTES
  })) {
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

function parseOtpLabel(labelPart: string, issuerParameter: string | null): { issuer: string; label: string } {
  const labelText = labelPart.trim();
  const labelFromPath = parseLabelPath(labelText);

  if (issuerParameter !== null) {
    const issuer = issuerParameter.trim();
    if (!issuer) {
      return { issuer: '', label: labelText };
    }
    return {
      issuer,
      label: labelText.startsWith(`${issuer}:`)
        ? labelText.slice(issuer.length + 1).trim() || labelFromPath.label
        : labelFromPath.label
    };
  }

  return labelFromPath;
}

function parseLabelPath(labelText: string): { issuer: string; label: string } {
  const labelPieces = labelText.split(':');
  const issuerFromLabel = labelPieces.length > 1 ? labelPieces.shift()?.trim() ?? '' : '';
  return {
    issuer: issuerFromLabel,
    label: (labelPieces.join(':') || labelText).trim()
  };
}

function parseAlgorithm(value: string | null): OtpAlgorithm {
  if (value === null) {
    return 'SHA-1';
  }

  const normalized = value.replace(/[-_\s]/g, '').toUpperCase();
  if (normalized === 'SHA1') {
    return 'SHA-1';
  }
  if (normalized === 'SHA256') {
    return 'SHA-256';
  }
  if (normalized === 'SHA512') {
    return 'SHA-512';
  }
  throw new Error(`Unsupported OTP algorithm "${value}".`);
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
  const digits = parseOptionalNonNegativeInteger(value, 'Digits');
  return digits ?? 6;
}

function parseOptionalNonNegativeInteger(value: string | null, parameter: string): number | undefined {
  if (value === null) {
    return undefined;
  }

  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error(`${parameter} must be a non-negative whole number.`);
  }

  const numeric = Number(normalized);
  if (!Number.isSafeInteger(numeric)) {
    throw new Error(`${parameter} must be a non-negative whole number.`);
  }
  return numeric;
}

function decodeParameter(value: string | null): string {
  if (!value) {
    return '';
  }
  return value.replace(/\+/g, ' ').trim();
}
