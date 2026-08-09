import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  detectBrowserLanguage,
  resolveSupportedLanguage
} from '../../src/lib/i18n/languages';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveSupportedLanguage', () => {
  test.each([
    [['es-MX'], 'es'],
    [['PT_br'], 'pt'],
    [[' zh-Hant-TW '], 'zh'],
    [['nl-NL', 'DE-de'], 'de']
  ])('matches supported base languages from %j', (locales, expected) => {
    expect(resolveSupportedLanguage(locales)).toBe(expected);
  });

  test('falls back to English when no preferred locale is supported', () => {
    expect(resolveSupportedLanguage(['nl-NL', '', null, 42, 'invalid'])).toBe('en');
  });
});

describe('detectBrowserLanguage', () => {
  test('prefers the extension UI language', () => {
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'ja-JP' } });
    vi.stubGlobal('navigator', { languages: ['fr-FR'], language: 'fr-FR' });

    expect(detectBrowserLanguage()).toBe('ja');
  });

  test('uses a supported browser preference when the UI language is unsupported', () => {
    vi.stubGlobal('chrome', { i18n: { getUILanguage: () => 'nl-NL' } });
    vi.stubGlobal('navigator', {
      languages: ['nl-NL', 'fr-CA'],
      language: 'nl-NL'
    });

    expect(detectBrowserLanguage()).toBe('fr');
  });

  test('uses browser preferences when the extension locale API fails', () => {
    vi.stubGlobal('chrome', {
      i18n: {
        getUILanguage: () => {
          throw new Error('locale unavailable');
        }
      }
    });
    vi.stubGlobal('navigator', { languages: ['es-419'], language: 'es-419' });

    expect(detectBrowserLanguage()).toBe('es');
  });

  test('falls back safely when locale APIs are unavailable', () => {
    vi.stubGlobal('chrome', undefined);
    vi.stubGlobal('navigator', undefined);

    expect(detectBrowserLanguage()).toBe('en');
  });
});
