import { describe, expect, it } from "vitest";
import { STORAGE_KEYS } from "./storageKeys";

describe("STORAGE_KEYS", () => {
  it("keeps the localStorage strings USER-SETTINGS will migrate", () => {
    expect(STORAGE_KEYS).toEqual({
      sidebarWidth: "cs2analyzer.sidebarWidth",
      eventLeadInSec: "cs2analyzer.eventLeadInSec",
      seriesTrailWindowSec: "cs2analyzer.seriesTrailWindowSec",
      roundAutoplay: "cs2analyzer.roundAutoplay",
      playbookTreeWidth: "cs2analyzer.playbookTreeWidth",
      playbookDetailWidth: "cs2analyzer.playbookDetailWidth",
      layoutsSidebarWidth: "cs2analyzer.layoutsSidebarWidth",
      playbookFocus: "cs2analyzer.playbook.focus",
      snapshotRecentBooks: "cs2analyzer.snapshotRecentBooks",
    });
  });
});
