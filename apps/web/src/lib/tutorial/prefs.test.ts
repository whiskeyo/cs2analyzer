/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { TUTORIAL_SEEN_STORAGE_KEY } from "@/lib/shared/storageKeys";
import { loadTutorialSeen, saveTutorialSeen } from "./prefs";

describe("tutorial seen pref", () => {
  afterEach(() => {
    localStorage.removeItem(TUTORIAL_SEEN_STORAGE_KEY);
  });

  it("defaults to unseen and persists a skip", () => {
    expect(loadTutorialSeen()).toBe(false);
    saveTutorialSeen();
    expect(localStorage.getItem(TUTORIAL_SEEN_STORAGE_KEY)).toBe("1");
    expect(loadTutorialSeen()).toBe(true);
    saveTutorialSeen(false);
    expect(loadTutorialSeen()).toBe(false);
  });
});
