import { describe, expect, it } from "vitest";
import { loadTutorialPlaybook, resetTutorialLoadCache } from "../load";
import { tutorialPlaybooks } from "./sample";

describe("tutorial playbook sample", () => {
  it("ships no hand-authored strats", () => {
    expect(tutorialPlaybooks).toEqual([]);
  });

  it("lazy-loads an empty live set through loadTutorialPlaybook", async () => {
    resetTutorialLoadCache();
    const books = await loadTutorialPlaybook();
    expect(books).toEqual([]);
  });
});
