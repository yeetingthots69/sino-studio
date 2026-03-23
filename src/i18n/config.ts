export const LOCALES = ['en', 'vi'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isValidLocale(locale: string): locale is Locale {
    return LOCALES.includes(locale as Locale);
}
