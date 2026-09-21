import { describe, expect, it, beforeEach } from "vitest";
import { TUTORIAL_PLAYBOOK_TITLE, tutorialPlaybookKey } from "./constants";
import {
  getTutorialPlaybookForMap,
  getTutorialPlaybooksLive,
  resetTutorialPlaybookLive,
  writeTutorialSnapshot,
} from "./live";

describe("tutorial playbook live", () => {
  beforeEach(() => {
    resetTutorialPlaybookLive();
  });

  it("starts from the Mirage sample and appends snapshots to that map", () => {
    const sample = getTutorialPlaybooksLive();
    expect(sample).toHaveLength(1);
    expect(sample[0]).toMatchObject({
      key: tutorialPlaybookKey("de_mirage"),
      title: TUTORIAL_PLAYBOOK_TITLE,
      mapName: "de_mirage",
    });
    expect(sample[0]?.pages).toHaveLength(1);
    expect(sample[0]?.pages[0]?.title).toBe("Fake A Smokes, B contact");
    expect(getTutorialPlaybookForMap("de_dust2")).toBeNull();

    const { book, pageId } = writeTutorialSnapshot({
      mapName: "de_mirage",
      stratTitle: "My snapshot",
      pieces: [{ id: "p1", kind: "pawn", x: 1, y: 2, side: "CT", yaw: 0, alive: true }],
    });
    expect(book.mapName).toBe("de_mirage");
    expect(book.title).toBe(TUTORIAL_PLAYBOOK_TITLE);
    expect(book.key).toBe(tutorialPlaybookKey("de_mirage"));
    expect(book.pages.some((page) => page.title === "Fake A Smokes, B contact")).toBe(true);
    expect(book.pages.some((page) => page.title === "My snapshot")).toBe(true);
    expect(getTutorialPlaybookForMap("de_mirage")?.activePageId).toBe(pageId);
    expect(getTutorialPlaybookForMap("de_dust2")).toBeNull();
  });

  it("starts from the sample again after reset", () => {
    writeTutorialSnapshot({ mapName: "de_dust2", stratTitle: "Gone", pieces: [] });
    resetTutorialPlaybookLive();
    const books = getTutorialPlaybooksLive();
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      key: tutorialPlaybookKey("de_mirage"),
      title: TUTORIAL_PLAYBOOK_TITLE,
      mapName: "de_mirage",
    });
    expect(books[0]?.pages).toHaveLength(1);
    expect(books[0]?.pages[0]?.title).toBe("Fake A Smokes, B contact");
    expect(getTutorialPlaybookForMap("de_dust2")).toBeNull();
  });

  it("keeps Single and Aggregated snapshots on their own maps", () => {
    writeTutorialSnapshot({ mapName: "de_mirage", stratTitle: "Single", pieces: [] });
    writeTutorialSnapshot({ mapName: "de_dust2", stratTitle: "Habits", pieces: [] });
    expect(getTutorialPlaybookForMap("de_mirage")?.mapName).toBe("de_mirage");
    expect(
      getTutorialPlaybookForMap("de_mirage")?.pages.some((page) => page.title === "Single"),
    ).toBe(true);
    expect(getTutorialPlaybookForMap("de_dust2")?.mapName).toBe("de_dust2");
    expect(
      getTutorialPlaybookForMap("de_dust2")?.pages.some((page) => page.title === "Habits"),
    ).toBe(true);
    expect(getTutorialPlaybooksLive()).toHaveLength(2);
  });
});
