import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IDB_QUOTA_MESSAGE, isQuotaExceededError } from "@/lib/storage/quota";
import { loadUserSettings, resetUserSettings, saveUserSettings } from "./userSettingsStore";
import {
  applyUserSettingsPatch,
  defaultUserSettings,
  parseUserSettings,
  type UserSettings,
  type UserSettingsPatch,
} from "./userSettings";

export interface UserSettingsApi {
  settings: UserSettings;
  ready: boolean;
  saveError: string | null;
  update: (patch: UserSettingsPatch) => Promise<UserSettings>;
  reset: () => Promise<UserSettings>;
}

const UserSettingsContext = createContext<UserSettingsApi | null>(null);

function useUserSettingsState(): UserSettingsApi {
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void loadUserSettings().then((loaded) => {
      if (cancelled) {
        return;
      }
      if (!dirtyRef.current) {
        setSettings(loaded);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(async (patch: UserSettingsPatch) => {
    dirtyRef.current = true;
    try {
      const next = await saveUserSettings(patch);
      setSaveError(null);
      setSettings(next);
      return next;
    } catch (err) {
      if (!isQuotaExceededError(err)) {
        throw err;
      }
      setSaveError(IDB_QUOTA_MESSAGE);
      const next = await loadUserSettings();
      setSettings(next);
      return next;
    }
  }, []);

  const reset = useCallback(async () => {
    dirtyRef.current = true;
    try {
      const next = await resetUserSettings();
      setSaveError(null);
      setSettings(next);
      return next;
    } catch (err) {
      if (!isQuotaExceededError(err)) {
        throw err;
      }
      setSaveError(IDB_QUOTA_MESSAGE);
      const next = await loadUserSettings();
      setSettings(next);
      return next;
    }
  }, []);

  return { settings, ready, saveError, update, reset };
}

/** Loads the IndexedDB document once at app boot and shares it with consumers. */
export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const value = useUserSettingsState();
  return <UserSettingsContext.Provider value={value}>{children}</UserSettingsContext.Provider>;
}

/**
 * Live user settings. Inside `UserSettingsProvider` this is the IndexedDB
 * document. Isolated tests without a provider get shipped defaults in memory.
 */
export function useUserSettings(): UserSettingsApi {
  const ctx = useContext(UserSettingsContext);
  if (ctx) {
    return ctx;
  }
  return {
    settings: defaultUserSettings(),
    ready: true,
    saveError: null,
    update: async (patch) => {
      const current = defaultUserSettings();
      return parseUserSettings({ ...current, ...applyUserSettingsPatch(current, patch) });
    },
    reset: async () => defaultUserSettings(),
  };
}
