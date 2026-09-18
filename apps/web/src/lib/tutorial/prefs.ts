import { TUTORIAL_SEEN_STORAGE_KEY } from "@/lib/shared/storageKeys";

export function loadTutorialSeen(): boolean {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveTutorialSeen(seen = true): void {
  try {
    localStorage.setItem(TUTORIAL_SEEN_STORAGE_KEY, seen ? "1" : "0");
  } catch {
    /* ignore quota / private mode */
  }
}
