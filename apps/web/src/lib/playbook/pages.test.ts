import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import {
  activePage,
  addPage,
  copiedTitle,
  defaultPlaybookColor,
  defaultPlaybookPaletteId,
  deletePage,
  duplicatePage,
  duplicatePlaybook,
  newPage,
  newPlaybook,
  renamePage,
  renamePlaybook,
  reorderPages,
  setActivePage,
  setPageFloor,
  setPageNote,
} from "./pages";
import { COPY_SUFFIX, PLAYBOOK_SCHEMA, UNTITLED_PLAYBOOK, UNTITLED_STRAT } from "./types";

describe("newPlaybook", () => {
  it("creates one untitled strat and default colors", () => {
    const book = newPlaybook("de_mirage", "  ");
    expect(book.schema).toBe(PLAYBOOK_SCHEMA);
    expect(book.mapName).toBe("de_mirage");
    expect(book.title).toBe(UNTITLED_PLAYBOOK);
    expect(book.pages).toHaveLength(1);
    expect(book.pages[0]?.title).toBe(UNTITLED_STRAT);
    expect(book.activePageId).toBe(book.pages[0]?.id);
    expect(book.paletteId).toBe(defaultPlaybookPaletteId());
    expect(book.color).toBe(defaultPlaybookColor());
  });

  it("keeps a provided title", () => {
    expect(newPlaybook("de_inferno", " A execs ").title).toBe("A execs");
  });
});

describe("pages", () => {
  it("adds, renames, and switches strats", () => {
    let book = newPlaybook("de_mirage", "Defaults");
    const firstId = book.pages[0]?.id ?? "";
    book = addPage(book, "B default", "lower");
    expect(book.pages).toHaveLength(2);
    expect(book.pages[1]).toMatchObject({ title: "B default", floor: "lower" });
    expect(book.activePageId).toBe(book.pages[1]?.id);

    book = renamePage(book, firstId, "  Mid control  ");
    expect(book.pages[0]?.title).toBe("Mid control");
    book = renamePage(book, firstId, "   ");
    expect(book.pages[0]?.title).toBe(UNTITLED_STRAT);
    expect(renamePage(book, "missing", "X")).toBe(book);

    book = setActivePage(book, firstId);
    expect(book.activePageId).toBe(firstId);
    expect(setActivePage(book, firstId)).toBe(book);
    expect(setActivePage(book, "missing")).toBe(book);
  });

  it("updates floor and note on a page", () => {
    let book = newPlaybook("de_mirage", "Defaults");
    const id = book.pages[0]?.id ?? "";
    const note = emptyNote();
    note.loose.push({
      drawing: { type: "arrow", color: "#fff", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
    });
    book = setPageFloor(book, id, "upper");
    book = setPageNote(book, id, note);
    expect(book.pages[0]?.floor).toBe("upper");
    expect(book.pages[0]?.note.loose).toHaveLength(1);
    expect(note.loose).toHaveLength(1);
    note.loose.pop();
    expect(book.pages[0]?.note.loose).toHaveLength(1);
  });

  it("refuses to delete the last strat and ignores a missing id", () => {
    const book = newPlaybook("de_mirage", "Defaults");
    expect(deletePage(book, book.pages[0]?.id ?? "")).toBe(book);
    expect(deletePage(book, "missing")).toBe(book);
    const two = addPage(book, "A exec");
    expect(deletePage(two, "missing")).toBe(two);
  });

  it("deletes a strat and moves the active page", () => {
    let book = newPlaybook("de_mirage", "Defaults");
    const firstId = book.pages[0]?.id ?? "";
    book = addPage(book, "A exec");
    const secondId = book.activePageId;
    book = deletePage(book, secondId);
    expect(book.pages).toHaveLength(1);
    expect(book.activePageId).toBe(firstId);
  });

  it("duplicates a strat after the original", () => {
    let book = newPlaybook("de_mirage", "Defaults");
    book = addPage(book, "A exec");
    const sourceId = book.pages[0]?.id ?? "";
    book = duplicatePage(book, sourceId);
    expect(book.pages).toHaveLength(3);
    expect(book.pages[1]?.title).toBe(copiedTitle(UNTITLED_STRAT));
    expect(book.pages[1]?.id).not.toBe(sourceId);
    expect(book.activePageId).toBe(book.pages[1]?.id);
    expect(duplicatePage(book, "missing")).toEqual(book);
  });

  it("reorders strats and ignores bad indexes", () => {
    let book = newPlaybook("de_mirage", "Defaults");
    book = addPage(book, "A");
    book = addPage(book, "B");
    const ids = book.pages.map((p) => p.id);
    book = reorderPages(book, 2, 0);
    expect(book.pages.map((p) => p.id)).toEqual([ids[2], ids[0], ids[1]]);
    expect(reorderPages(book, 0, 0)).toBe(book);
    expect(reorderPages(book, -1, 0)).toBe(book);
    expect(reorderPages(book, 0, 9)).toBe(book);
    const sparse = { ...book, pages: Object.assign([], { 1: book.pages[0], length: 2 }) };
    expect(reorderPages(sparse, 0, 1).pages).toEqual(sparse.pages);
  });

  it("renames the book and duplicates it with new ids", () => {
    let book = newPlaybook("de_mirage", "Defaults");
    book = addPage(book, "A exec");
    book = renamePlaybook(book, "  ");
    expect(book.title).toBe(UNTITLED_PLAYBOOK);
    book = renamePlaybook(book, "Anti-strats");
    const copy = duplicatePlaybook(book);
    expect(copy.key).not.toBe(book.key);
    expect(copy.title).toBe(`Anti-strats${COPY_SUFFIX}`);
    expect(copy.pages).toHaveLength(2);
    expect(copy.pages[0]?.id).not.toBe(book.pages[0]?.id);
    expect(copy.activePageId).toBe(copy.pages[1]?.id);
    expect(copy.savedAt).toBe(0);
    const emptyCopy = duplicatePlaybook({ ...book, pages: [] });
    expect(emptyCopy.pages).toEqual([]);
    expect(emptyCopy.key).not.toBe(book.key);
  });

  it("resolves the active page and throws when empty", () => {
    const book = newPlaybook("de_mirage", "Defaults");
    expect(activePage(book).id).toBe(book.activePageId);
    const drifted = { ...book, activePageId: "gone" };
    expect(activePage(drifted).id).toBe(book.pages[0]?.id);
    expect(() => activePage({ ...book, pages: [] })).toThrow("playbook has no pages");
  });
});

describe("newPage", () => {
  it("defaults title and floor", () => {
    expect(newPage().title).toBe(UNTITLED_STRAT);
    expect(newPage().floor).toBe("auto");
    expect(newPage("Split A", "upper")).toMatchObject({ title: "Split A", floor: "upper" });
  });
});
