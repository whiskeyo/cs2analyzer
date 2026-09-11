import { en } from "./en";
import { DEFAULT_LOCALE, type Locale } from "./locales";
import type { Messages } from "./messages";
import { pl } from "./pl";

export const catalogs: Record<Locale, Messages> = {
  en,
  pl,
};

export function catalogFor(locale: Locale): Messages {
  switch (locale) {
    case "pl":
      return catalogs.pl;
    case "en":
    default:
      return catalogs[DEFAULT_LOCALE];
  }
}
