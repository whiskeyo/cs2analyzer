import { en } from "./en";
import type { Locale } from "./locales";
import type { Messages } from "./messages";
import { pl } from "./pl";

export const CATALOGS: Record<Locale, Messages> = { en, pl };

export function messagesFor(locale: Locale): Messages {
  return CATALOGS[locale];
}
