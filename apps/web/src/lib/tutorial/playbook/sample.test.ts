import { describe, expect, it } from "vitest";
import { parsePlaybook } from "@/lib/playbook/parse";
import { PLAYBOOK_PREFERRED_MAP, PLAYBOOK_SCHEMA } from "@/lib/playbook/types";
import { loadTutorialPlaybook } from "../load";
import { TUTORIAL_PLAYBOOK_KEY, TUTORIAL_PLAYBOOK_PAGE_ID, tutorialPlaybook } from "./sample";

describe("tutorial playbook stub", () => {
  it("is a parseable empty sample on the preferred map", () => {
    const parsed = parsePlaybook(tutorialPlaybook);
    expect(parsed).not.toBeNull();
    expect(parsed?.schema).toBe(PLAYBOOK_SCHEMA);
    expect(parsed?.key).toBe(TUTORIAL_PLAYBOOK_KEY);
    expect(parsed?.mapName).toBe(PLAYBOOK_PREFERRED_MAP);
    expect(parsed?.pages).toHaveLength(1);
    expect(parsed?.activePageId).toBe(TUTORIAL_PLAYBOOK_PAGE_ID);
    expect(parsed?.pages[0]?.note.drawings).toEqual([]);
    expect(parsed?.pages[0]?.note.pieces).toEqual([]);
  });

  it("lazy-loads through loadTutorialPlaybook", async () => {
    const book = await loadTutorialPlaybook();
    expect(book.key).toBe(TUTORIAL_PLAYBOOK_KEY);
  });
});
