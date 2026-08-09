import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { LANGUAGES, MESSAGE_KEYS, t } from '../../src/lib/i18n/messages';
import { getPreferredLanguage } from '../../src/lib/i18n/language';

const LOCALE_MESSAGES = [
  'extensionName',
  'extensionShortName',
  'extensionDescription',
  'actionTitle'
] as const;
const BROWSER_BRAND_PATTERN = /\b(?:Chrome|Chromium|Edge|Firefox|Web Store)\b/i;
const MANIFEST_LOCALES_DIR = join(process.cwd(), 'assets', 'extension', '_locales');
const CHARACTER_SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function characterLength(value: string): number {
  return Array.from(CHARACTER_SEGMENTER.segment(value)).length;
}

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
    for (const { locale } of LANGUAGES) {
      const manifestLocale = locale.replaceAll('-', '_');
      const filePath = join(MANIFEST_LOCALES_DIR, manifestLocale, 'messages.json');
      expect(existsSync(filePath), manifestLocale).toBe(true);

      const messages = JSON.parse(readFileSync(filePath, 'utf8')) as Record<
        string,
        { message?: unknown }
      >;
      for (const key of LOCALE_MESSAGES) {
        expect(messages[key]?.message, `${manifestLocale}.${key}`).toEqual(expect.any(String));
        expect(messages[key].message, `${manifestLocale}.${key}`).toMatch(/\S/);
        expect(messages[key].message, `${manifestLocale}.${key}`).not.toMatch(BROWSER_BRAND_PATTERN);
      }
    }
  });

  test('manifest short names stay within extension package limits', () => {
    for (const { locale } of LANGUAGES) {
      const manifestLocale = locale.replaceAll('-', '_');
      const filePath = join(MANIFEST_LOCALES_DIR, manifestLocale, 'messages.json');
      const messages = JSON.parse(readFileSync(filePath, 'utf8')) as Record<
        string,
        { message?: unknown }
      >;
      const shortName = messages.extensionShortName?.message;

      expect(shortName, `${manifestLocale}.extensionShortName`).toEqual(expect.any(String));
      expect(
        characterLength(String(shortName)),
        `${manifestLocale}.extensionShortName`
      ).toBeLessThanOrEqual(12);
    }
  });
});

describe('preferred language selection', () => {
  test('matches generic translations across regional locale variants', () => {
    expect(getPreferredLanguage(['fr-CA'])).toBe('fr');
    expect(getPreferredLanguage(['ES_mx'])).toBe('es');
  });

  test('matches region-specific translations without assuming a different variant', () => {
    expect(getPreferredLanguage(['pt-BR'])).toBe('pt');
    expect(getPreferredLanguage(['pt-PT'])).toBe('en');
    expect(getPreferredLanguage(['zh-CN'])).toBe('zh');
    expect(getPreferredLanguage(['zh-TW'])).toBe('en');
  });

  test('uses the first supported preference and falls back to English', () => {
    expect(getPreferredLanguage(['it-IT', '', 'bn-BD'])).toBe('bn');
    expect(getPreferredLanguage([undefined, 'it-IT'])).toBe('en');
  });
});
