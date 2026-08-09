export const LANGUAGES = [
  { code: 'en', locale: 'en', label: 'English' },
  { code: 'es', locale: 'es', label: 'Español' },
  { code: 'hi', locale: 'hi', label: 'हिन्दी' },
  { code: 'ar', locale: 'ar', label: 'العربية' },
  { code: 'bn', locale: 'bn', label: 'বাংলা' },
  { code: 'pt', locale: 'pt-BR', label: 'Português' },
  { code: 'ru', locale: 'ru', label: 'Русский' },
  { code: 'ja', locale: 'ja', label: '日本語' },
  { code: 'fr', locale: 'fr', label: 'Français' },
  { code: 'de', locale: 'de', label: 'Deutsch' },
  { code: 'zh', locale: 'zh-CN', label: '简体中文' }
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]['code'];

export function getPreferredLanguage(
  locales: readonly unknown[] = getBrowserLocales()
): LanguageCode {
  for (const locale of locales) {
    if (typeof locale !== 'string') {
      continue;
    }

    const normalized = locale.trim().replaceAll('_', '-').toLowerCase();
    if (!normalized) {
      continue;
    }

    const language = LANGUAGES.find(({ code, locale: supportedLocale }) => {
      const normalizedSupportedLocale = supportedLocale.toLowerCase();
      return (
        normalized === code ||
        normalized === normalizedSupportedLocale ||
        normalized.startsWith(`${normalizedSupportedLocale}-`)
      );
    });
    if (language) {
      return language.code;
    }
  }

  return 'en';
}

function getBrowserLocales(): readonly unknown[] {
  try {
    const uiLanguage =
      typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage
        ? chrome.i18n.getUILanguage()
        : undefined;
    if (typeof uiLanguage === 'string' && uiLanguage.trim()) {
      return [uiLanguage];
    }
  } catch {
    // Browser globals may be unavailable in development and non-extension contexts.
  }

  try {
    if (typeof navigator !== 'undefined') {
      return [...(navigator.languages ?? []), navigator.language];
    }
  } catch {
    // English is the safe fallback when locale detection is unavailable.
  }

  return [];
}
