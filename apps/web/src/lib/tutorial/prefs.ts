import { loadUserSettings, saveUserSettings } from "@/lib/settings/userSettingsStore";

/** Missing IndexedDB key ≡ not completed. */
export async function loadTutorialCompleted(): Promise<boolean> {
  return (await loadUserSettings()).tutorialCompleted;
}

export async function saveTutorialCompleted(completed = true): Promise<void> {
  await saveUserSettings({ tutorialCompleted: completed });
}
