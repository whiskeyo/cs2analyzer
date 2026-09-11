export const LOCALES = ["en", "pl"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "pl";
}

/** Unknown or missing values become English. */
export function parseLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** BCP 47 tag for `Intl` / `toLocaleString`. */
export function localeTag(locale: Locale): string {
  return locale === "pl" ? "pl-PL" : "en-US";
}
