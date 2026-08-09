export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ar', label: 'العربية' },
  { code: 'bn', label: 'বাংলা' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'ja', label: '日本語' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'zh', label: '简体中文' }
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

const SUPPORTED_LANGUAGES = new Set<LanguageCode>(LANGUAGES.map(({ code }) => code));

export function detectBrowserLanguage(): LanguageCode {
  const locales: unknown[] = [];

  try {
    if (typeof chrome !== 'undefined' && typeof chrome.i18n?.getUILanguage === 'function') {
      locales.push(chrome.i18n.getUILanguage());
    }
  } catch {
    // The navigator preferences below are available outside extension pages too.
  }

  try {
    if (typeof navigator !== 'undefined') {
      if (Array.isArray(navigator.languages)) {
        locales.push(...navigator.languages);
      }
      locales.push(navigator.language);
    }
  } catch {
    // English remains the safe fallback when browser locale APIs are unavailable.
  }

  return resolveSupportedLanguage(locales);
}

export function resolveSupportedLanguage(locales: readonly unknown[]): LanguageCode {
  for (const locale of locales) {
    if (typeof locale !== 'string') {
      continue;
    }
    const language = locale.trim().toLowerCase().split(/[-_]/, 1)[0];
    if (isSupportedLanguage(language)) {
      return language;
    }
  }

  return DEFAULT_LANGUAGE;
}

function isSupportedLanguage(language: string): language is LanguageCode {
  return SUPPORTED_LANGUAGES.has(language as LanguageCode);
}
