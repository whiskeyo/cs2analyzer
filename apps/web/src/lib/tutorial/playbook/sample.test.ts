import { describe, expect, it } from "vitest";
import { loadTutorialPlaybook, resetTutorialLoadCache } from "../load";
import { TUTORIAL_PLAYBOOK_TITLE, tutorialPlaybookKey } from "./constants";
import { tutorialPlaybooks } from "./sample";

const SAMPLE_PAGE_TITLE = "Fake A Smokes, B contact";

describe("tutorial playbook sample", () => {
  it("ships the Mirage Tutorial book from sample.json", () => {
    expect(tutorialPlaybooks).toHaveLength(1);
    expect(tutorialPlaybooks[0]).toMatchObject({
      key: tutorialPlaybookKey("de_mirage"),
      title: TUTORIAL_PLAYBOOK_TITLE,
      mapName: "de_mirage",
    });
    expect(tutorialPlaybooks[0]?.pages).toHaveLength(1);
    expect(tutorialPlaybooks[0]?.pages[0]?.title).toBe(SAMPLE_PAGE_TITLE);
  });

  it("lazy-loads the live sample through loadTutorialPlaybook", async () => {
    resetTutorialLoadCache();
    const books = await loadTutorialPlaybook();
    expect(books).toHaveLength(1);
    expect(books[0]).toMatchObject({
      key: tutorialPlaybookKey("de_mirage"),
      title: TUTORIAL_PLAYBOOK_TITLE,
      mapName: "de_mirage",
    });
    expect(books[0]?.pages).toHaveLength(1);
    expect(books[0]?.pages[0]?.title).toBe(SAMPLE_PAGE_TITLE);
  });
});
