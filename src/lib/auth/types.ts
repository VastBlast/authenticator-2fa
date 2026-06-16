export type OtpType = 'totp' | 'hotp' | 'steam';

export type OtpAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-512';

export interface AuthenticatorAccount {
  id: string;
  issuer: string;
  label: string;
  secret: string;
  type: OtpType;
  algorithm: OtpAlgorithm;
  digits: number;
  period: number;
  counter: number;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDraft {
  issuer?: string;
  label: string;
  secret: string;
  type?: OtpType;
  algorithm?: OtpAlgorithm;
  digits?: number;
  period?: number;
  counter?: number;
  pinned?: boolean;
}

export interface OtpCode {
  accountId: string;
  value: string;
  remaining: number;
  progress: number;
}

export interface ImportResult {
  accounts: AuthenticatorAccount[];
  imported: number;
  skipped: number;
  errors: string[];
}

export interface VaultData {
  accounts: AuthenticatorAccount[];
  settings: AppSettings;
}

export interface AppSettings {
  language: string;
  theme: 'light' | 'dark';
}

export interface VaultEnvelope {
  version: 1;
  kdf: {
    name: 'PBKDF2';
    hash: 'SHA-256';
    iterations: number;
    salt: string;
  };
  cipher: {
    name: 'AES-GCM';
    iv: string;
    data: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PlainVaultRecord {
  version: 1;
  format: 'plain';
  data: VaultData;
  createdAt: string;
  updatedAt: string;
}

export type StoredVault = VaultEnvelope | PlainVaultRecord;

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'en',
  theme: 'light'
};

export const OTP_ALGORITHMS: OtpAlgorithm[] = ['SHA-1', 'SHA-256', 'SHA-512'];

export const OTP_TYPES: OtpType[] = ['totp', 'hotp', 'steam'];
