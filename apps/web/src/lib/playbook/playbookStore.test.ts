import { describe, expect, it } from "vitest";
import {
  countPlaybooks,
  createPlaybook,
  deleteAllPlaybooks,
  deletePlaybook,
  listPlaybooksForMap,
  loadAllPlaybooks,
  loadPlaybook,
  savePlaybook,
} from "./playbookStore";
import { newPlaybook } from "./pages";

describe("playbookStore without indexedDB", () => {
  it("stamps savedAt on save and no-ops the rest", async () => {
    const book = newPlaybook("de_mirage", "Defaults");
    const saved = await savePlaybook(book);
    expect(saved.savedAt).toBeGreaterThan(0);
    expect(await loadPlaybook(book.key)).toBeNull();
    expect(await loadAllPlaybooks()).toEqual([]);
    expect(await listPlaybooksForMap("de_mirage")).toEqual([]);
    expect(await countPlaybooks()).toBe(0);
    await deletePlaybook(book.key);
    expect(await deleteAllPlaybooks()).toBe(0);
    const created = await createPlaybook("de_inferno", "Execs");
    expect(created.mapName).toBe("de_inferno");
    expect(created.savedAt).toBeGreaterThan(0);
  });
});
