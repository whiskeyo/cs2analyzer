import { describe, expect, it } from "vitest";
import { parsePlaybook } from "@/lib/playbook/parse";
import { PLAYBOOK_PREFERRED_MAP, PLAYBOOK_SCHEMA } from "@/lib/playbook/types";
import { loadTutorialPlaybook, resetTutorialLoadCache } from "../load";
import {
  TUTORIAL_PLAYBOOK_DRAWN_PAGE_ID,
  TUTORIAL_PLAYBOOK_HABITS_PAGE_ID,
  TUTORIAL_PLAYBOOK_KEY,
  tutorialPlaybook,
} from "./sample";

describe("tutorial playbook sample", () => {
  it("ships a habits snapshot and a hand-drawn execute on the preferred map", () => {
    const parsed = parsePlaybook(tutorialPlaybook);
    expect(parsed).not.toBeNull();
    expect(parsed?.schema).toBe(PLAYBOOK_SCHEMA);
    expect(parsed?.key).toBe(TUTORIAL_PLAYBOOK_KEY);
    expect(parsed?.mapName).toBe(PLAYBOOK_PREFERRED_MAP);
    expect(parsed?.pages).toHaveLength(2);
    expect(parsed?.activePageId).toBe(TUTORIAL_PLAYBOOK_HABITS_PAGE_ID);
    const habits = parsed?.pages.find((page) => page.id === TUTORIAL_PLAYBOOK_HABITS_PAGE_ID);
    const drawn = parsed?.pages.find((page) => page.id === TUTORIAL_PLAYBOOK_DRAWN_PAGE_ID);
    expect(habits?.title).toBe("Habits snapshot");
    expect(habits?.note.pieces.some((piece) => piece.kind === "pawn")).toBe(true);
    expect(habits?.note.radarFx?.trails.length).toBeGreaterThan(0);
    expect(drawn?.title).toBe("A execute (drawn)");
    expect(drawn?.note.drawings.some((row) => row.type === "pen")).toBe(true);
    expect(drawn?.note.pieces.some((piece) => piece.kind === "smoke")).toBe(true);
  });

  it("lazy-loads through loadTutorialPlaybook", async () => {
    resetTutorialLoadCache();
    const book = await loadTutorialPlaybook();
    expect(book.key).toBe(TUTORIAL_PLAYBOOK_KEY);
    expect(book.pages).toHaveLength(2);
  });
});
