import { normalizeImportedAccounts } from './otp';
import { parseImportText } from './otpauth';
import type { ImportResult, VaultData } from './types';

export function importAnyText(text: string): ImportResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { accounts: [], imported: 0, skipped: 0, errors: [] };
  }

  if (trimmed.startsWith('{')) {
    const raw = JSON.parse(trimmed) as Partial<VaultData> | Record<string, unknown>;
    if (Array.isArray((raw as Partial<VaultData>).accounts)) {
      const accounts = normalizeImportedAccounts((raw as Partial<VaultData>).accounts);
      return { accounts, imported: accounts.length, skipped: 0, errors: [] };
    }
  }

  return parseImportText(text);
}
