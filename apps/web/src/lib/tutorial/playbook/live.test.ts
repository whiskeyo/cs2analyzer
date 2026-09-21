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
    expect(first.pages).toHaveLength(tutorialPlaybook.pages.length);
    expect(first).not.toBe(tutorialPlaybook);

    const { book, pageId } = writeTutorialSnapshot({
      stratTitle: "My snapshot",
      pieces: [{ id: "p1", kind: "pawn", x: 1, y: 2, side: "CT", yaw: 0, alive: true }],
    });
    expect(book.pages).toHaveLength(tutorialPlaybook.pages.length + 1);
    expect(book.pages.some((page) => page.title === "My snapshot")).toBe(true);
    expect(getTutorialPlaybookLive().activePageId).toBe(pageId);
  });

  it("starts from the sample again after reset", () => {
    writeTutorialSnapshot({ stratTitle: "Gone", pieces: [] });
    resetTutorialPlaybookLive();
    expect(getTutorialPlaybookLive().pages).toHaveLength(tutorialPlaybook.pages.length);
  });
});
