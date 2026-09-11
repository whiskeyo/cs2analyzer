export const LOCALES = ["en", "pl"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Endonyms for the Preferences picker. Adding a locale is one row here plus `translations/xx/`. */
export const LOCALE_ENDONYMS: Record<Locale, string> = {
  en: "English",
  pl: "Polski",
};

const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  pl: "pl-PL",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Unknown or missing values become English. */
export function parseLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** BCP 47 tag for `Intl` / `toLocaleString`. Unknown codes fall back to en-US. */
export function localeTag(locale: Locale): string {
  return LOCALE_TAGS[locale] ?? LOCALE_TAGS[DEFAULT_LOCALE];
}

export function localeEndonym(locale: Locale): string {
  return LOCALE_ENDONYMS[locale] ?? LOCALE_ENDONYMS[DEFAULT_LOCALE];
}
