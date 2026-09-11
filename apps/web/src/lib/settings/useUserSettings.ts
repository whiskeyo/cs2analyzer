import { useCallback, useEffect, useState } from "react";
import { loadUserSettings, resetUserSettings, saveUserSettings } from "./userSettingsStore";
import { defaultUserSettings, type UserSettings } from "./userSettings";

export function useUserSettings() {
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadUserSettings().then((loaded) => {
      if (cancelled) {
        return;
      }
      setSettings(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch: Partial<UserSettings>) => {
    const next = await saveUserSettings(patch);
    setSettings(next);
    return next;
  }, []);

  const reset = useCallback(async () => {
    const next = await resetUserSettings();
    setSettings(next);
    return next;
  }, []);

  return { settings, ready, update, reset };
}
