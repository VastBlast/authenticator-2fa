import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { LANGUAGES, MESSAGE_KEYS, t } from '../../src/lib/i18n/messages';

const LOCALE_MESSAGES = [
  'extensionName',
  'extensionShortName',
  'extensionDescription',
  'actionTitle',
  'scanPageCommandDescription'
] as const;
const MANIFEST_LOCALE_BY_LANGUAGE: Record<string, string> = {
  en: 'en',
  es: 'es',
  hi: 'hi',
  ar: 'ar',
  bn: 'bn',
  pt: 'pt_BR',
  ru: 'ru',
  ja: 'ja',
  fr: 'fr',
  de: 'de',
  zh: 'zh_CN'
};
const BROWSER_BRAND_PATTERN = /\b(?:Chrome|Chromium|Edge|Firefox|Web Store)\b/i;

describe('localized copy', () => {
  test('every supported runtime language has non-empty values for every UI key', () => {
    for (const { code } of LANGUAGES) {
      for (const key of MESSAGE_KEYS) {
        expect(t(code, key), `${code}.${key}`).toMatch(/\S/);
      }
    }
  });

  test('runtime copy does not mention browser brands', () => {
    for (const { code } of LANGUAGES) {
      for (const key of MESSAGE_KEYS) {
        expect(t(code, key), `${code}.${key}`).not.toMatch(BROWSER_BRAND_PATTERN);
      }
    }
  });

  test('manifest locales include exported metadata', () => {
    for (const { code } of LANGUAGES) {
      const locale = MANIFEST_LOCALE_BY_LANGUAGE[code];
      const filePath = join(process.cwd(), 'public', '_locales', locale, 'messages.json');
      expect(existsSync(filePath), locale).toBe(true);

      const messages = JSON.parse(readFileSync(filePath, 'utf8')) as Record<
        string,
        { message?: unknown }
      >;
      for (const key of LOCALE_MESSAGES) {
        expect(messages[key]?.message, `${locale}.${key}`).toEqual(expect.any(String));
        expect(messages[key].message, `${locale}.${key}`).toMatch(/\S/);
        expect(messages[key].message, `${locale}.${key}`).not.toMatch(BROWSER_BRAND_PATTERN);
      }
    }
  });
});
