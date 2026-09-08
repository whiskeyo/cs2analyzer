import { describe, expect, it } from "vitest";
import { newPlaybook } from "./pages";
import { addPage } from "./pages";
import {
  booksToSaveOnImport,
  findImportConflicts,
  stratConflictLabel,
  uniqueBookTitle,
} from "./merge";

describe("playbook import merge", () => {
  it("detects the same title on a map and the same key", () => {
    const mine = newPlaybook("de_mirage", "X");
    const incoming = { ...newPlaybook("de_mirage", "X"), pages: mine.pages };
    expect(findImportConflicts([mine], [incoming])[0]).toMatchObject({
      reason: "title",
      existing: { key: mine.key },
    });
    const sameKey = { ...newPlaybook("de_mirage", "Other"), key: mine.key };
    expect(findImportConflicts([mine], [sameKey])[0]?.reason).toBe("key");
  });

  it("renames, replaces, or merges conflicting strats", () => {
    let mine = newPlaybook("de_mirage", "X");
    mine = addPage(mine, "A");
    mine = addPage(mine, "B");
    const incoming = structuredClone(mine);
    incoming.key = "incoming";
    incoming.pages[0]!.body = "theirs";
    const renamed = booksToSaveOnImport([mine], [incoming], {
      incoming: { action: "rename", title: "X (imported)" },
    });
    expect(renamed[0]?.title).toBe("X (imported)");
    expect(renamed[0]?.key).not.toBe(mine.key);

    const replaced = booksToSaveOnImport([mine], [incoming], {
      incoming: { action: "replace" },
    });
    expect(replaced[0]?.key).toBe(mine.key);
    expect(replaced[0]?.pages[0]?.body).toBe("theirs");

    const merged = booksToSaveOnImport([mine], [incoming], {
      incoming: {
        action: "merge",
        strats: {
          [incoming.pages[0]!.id]: "rename",
          [incoming.pages[1]!.id]: "replace",
          [incoming.pages[2]!.id]: "skip",
        },
      },
    });
    expect(merged[0]?.pages.some((page) => page.title.includes("copy"))).toBe(true);
  });

  it("applies merge actions per incoming page when titles collide", () => {
    let mine = newPlaybook("de_mirage", "X");
    mine = addPage(mine, "Untitled strat");
    mine.pages[0]!.body = "keep-first";
    mine.pages[1]!.body = "keep-second";
    const incoming = structuredClone(mine);
    incoming.key = "incoming";
    incoming.pages[0]!.id = "in-a";
    incoming.pages[0]!.body = "new-first";
    incoming.pages[1]!.id = "in-b";
    incoming.pages[1]!.body = "new-second";
    const merged = booksToSaveOnImport([mine], [incoming], {
      incoming: {
        action: "merge",
        strats: { "in-a": "replace", "in-b": "skip" },
      },
    });
    expect(merged[0]?.pages.map((page) => page.body)).toEqual(["new-first", "keep-second"]);
  });

  it("makes a unique title", () => {
    expect(uniqueBookTitle("X", new Set(["X", "X (2)"]))).toBe("X (3)");
    expect(
      stratConflictLabel(
        [
          { pageId: "a", title: "Untitled strat" },
          { pageId: "b", title: "Untitled strat" },
        ],
        "b",
      ),
    ).toBe("Untitled strat (2)");
  });
});
