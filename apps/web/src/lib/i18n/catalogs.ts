import { DEFAULT_LOCALE, type Locale } from "./locales";
import type { Messages } from "./messages";
import { en } from "./translations/en";
import { pl } from "./translations/pl";

/** Live catalogs. Adding a locale is `translations/xx/` + one `LOCALES` entry. */

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
