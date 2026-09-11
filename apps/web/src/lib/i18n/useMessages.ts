import { catalogFor } from "./catalogs";
import { DEFAULT_LOCALE, type Locale } from "./locales";
import { t, tNodes, type Messages } from "./messages";
import { useUserSettings } from "@/lib/settings/useUserSettings";

export interface MessagesApi {
  locale: Locale;
  messages: Messages;
  t: typeof t;
  tNodes: typeof tNodes;
}

/**
 * Live catalog for `settings.locale`. Unknown codes and a missing provider
 * fall back to English so tests and first paint stay on the default locale.
 */
export function useMessages(): MessagesApi {
  const { settings } = useUserSettings();
  const locale = settings.locale ?? DEFAULT_LOCALE;
  return { locale, messages: catalogFor(locale), t, tNodes };
}
