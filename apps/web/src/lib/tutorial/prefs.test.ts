/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearUserSettingsForTests } from "@/lib/settings/userSettingsStore";
import { loadTutorialCompleted, saveTutorialCompleted } from "./prefs";

describe("tutorialCompleted pref", () => {
  beforeEach(async () => {
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
    await clearUserSettingsForTests();
  });

  it("defaults to not completed and persists a skip", async () => {
    expect(await loadTutorialCompleted()).toBe(false);
    await saveTutorialCompleted();
    expect(await loadTutorialCompleted()).toBe(true);
    await saveTutorialCompleted(false);
    expect(await loadTutorialCompleted()).toBe(false);
  });
});
