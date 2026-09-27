import { useUserSettings } from "@/lib/settings/useUserSettings";
import { messagesFor } from "./catalogs";
import { translate } from "./translate";

export function useMessages() {
  const { settings } = useUserSettings();
  return { locale: settings.locale, messages: messagesFor(settings.locale), translate };
}
