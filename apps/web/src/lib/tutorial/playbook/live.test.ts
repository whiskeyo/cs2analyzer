import { describe, expect, it, beforeEach } from "vitest";
import { getTutorialPlaybookLive, resetTutorialPlaybookLive, writeTutorialSnapshot } from "./live";
import { TUTORIAL_PLAYBOOK_KEY, tutorialPlaybook } from "./sample";

describe("tutorial playbook live", () => {
  beforeEach(() => {
    resetTutorialPlaybookLive();
  });

  it("clones the sample until a snapshot appends a page", () => {
    const first = getTutorialPlaybookLive();
    expect(first.key).toBe(TUTORIAL_PLAYBOOK_KEY);
    expect(first.mapName).toBe("de_dust2");
    expect(first.pages).toHaveLength(tutorialPlaybook.pages.length);
    expect(first).not.toBe(tutorialPlaybook);

    const { book, pageId } = writeTutorialSnapshot({
      mapName: "de_dust2",
      stratTitle: "My snapshot",
      pieces: [{ id: "p1", kind: "pawn", x: 1, y: 2, side: "CT", yaw: 0, alive: true }],
    });
    expect(book.mapName).toBe("de_dust2");
    expect(book.pages).toHaveLength(tutorialPlaybook.pages.length + 1);
    expect(book.pages.some((page) => page.title === "My snapshot")).toBe(true);
    expect(getTutorialPlaybookLive().activePageId).toBe(pageId);
  });

  it("starts from the sample again after reset", () => {
    writeTutorialSnapshot({ mapName: "de_dust2", stratTitle: "Gone", pieces: [] });
    resetTutorialPlaybookLive();
    expect(getTutorialPlaybookLive().pages).toHaveLength(tutorialPlaybook.pages.length);
  });

  it("retags the live book to the snapshot map", () => {
    expect(getTutorialPlaybookLive().mapName).toBe("de_dust2");
    writeTutorialSnapshot({ mapName: "de_inferno", stratTitle: "Other map", pieces: [] });
    expect(getTutorialPlaybookLive().mapName).toBe("de_inferno");
  });
});
