/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import {
  deleteAllProjects,
  PROJECT_SCHEMA,
  saveProject,
  type ReviewProject,
} from "@/lib/notes/projectStore";
import { DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { createPlaybook, deleteAllPlaybooks } from "@/lib/playbook/playbookStore";
import {
  putPlaybookImageBlob,
  clearPlaybookImageBlobs,
  getPlaybookImageBlob,
} from "@/lib/playbook/playbookImageStore";
import { clearUserSettingsForTests, saveUserSettings } from "@/lib/settings/userSettingsStore";
import { HANDLE_STORE, openCs2Db, requestOf } from "./idb";
import { measureCs2DatabaseUsage } from "./usage";

function project(): ReviewProject {
  return {
    schema: PROJECT_SCHEMA,
    key: "de_mirage|1|50,100|a.dem",
    savedAt: 1,
    fileName: "a.dem",
    mapName: "de_mirage",
    tick: 120,
    notes: [
      {
        round: 1,
        note: { groups: [], drawings: [], pieces: [], bookmarks: [] },
      },
    ],
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    floorMode: "auto",
    paletteId: COLOR_PRESETS[0].id,
    color: COLOR_PRESETS[0].colors[0],
  };
}

describe("measureCs2DatabaseUsage", () => {
  beforeEach(async () => {
    await deleteAllPlaybooks();
    await deleteAllProjects();
    await clearPlaybookImageBlobs();
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
    await deleteAllPlaybooks();
    await deleteAllProjects();
    await clearPlaybookImageBlobs();
    await clearUserSettingsForTests();
  });

  it("breaks usage down by IndexedDB store", async () => {
    const photo = new Blob([new Uint8Array(2048)], { type: "image/png" });
    await saveProject(project());
    await createPlaybook("de_mirage", "Defaults");
    await putPlaybookImageBlob("img-1", photo);
    const storedPhoto = await getPlaybookImageBlob("img-1");
    expect(storedPhoto?.size).toBe(photo.size);
    await saveUserSettings({ savedNotesPageSize: 8 });
    const db = await openCs2Db();
    try {
      const tx = db.transaction(HANDLE_STORE, "readwrite");
      await requestOf(tx.objectStore(HANDLE_STORE).put({ key: "demo", name: "match.dem" }));
    } finally {
      db.close();
    }

    const usage = await measureCs2DatabaseUsage();
    const byId = Object.fromEntries(usage.categories.map((row) => [row.id, row.bytes]));
    expect(byId.notes).toBeGreaterThan(0);
    expect(byId.playbooks).toBeGreaterThan(0);
    expect(byId.photos).toBeGreaterThanOrEqual(photo.size);
    expect(byId.settings).toBeGreaterThan(0);
    expect(byId.other).toBeGreaterThan(0);
    expect(usage.totalBytes).toBe(usage.categories.reduce((sum, row) => sum + row.bytes, 0));
  });
});
