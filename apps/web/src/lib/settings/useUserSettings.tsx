import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { loadUserSettings, resetUserSettings, saveUserSettings } from "./userSettingsStore";
import { defaultUserSettings, parseUserSettings, type UserSettings } from "./userSettings";

export interface UserSettingsApi {
  settings: UserSettings;
  ready: boolean;
  update: (patch: Partial<UserSettings>) => Promise<UserSettings>;
  reset: () => Promise<UserSettings>;
}

const UserSettingsContext = createContext<UserSettingsApi | null>(null);

function useUserSettingsState(): UserSettingsApi {
  const [settings, setSettings] = useState<UserSettings>(defaultUserSettings);
  const [ready, setReady] = useState(false);
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

  const update = useCallback(async (patch: Partial<UserSettings>) => {
    dirtyRef.current = true;
    const next = await saveUserSettings(patch);
    setSettings(next);
    return next;
  }, []);

  const reset = useCallback(async () => {
    dirtyRef.current = true;
    const next = await resetUserSettings();
    setSettings(next);
    return next;
  }, []);

  return { settings, ready, update, reset };
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
    update: async (patch) => parseUserSettings({ ...defaultUserSettings(), ...patch }),
    reset: async () => defaultUserSettings(),
  };
}
