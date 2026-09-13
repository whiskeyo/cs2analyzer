import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import {
  activePage,
  addPage,
  commitTitle,
  copiedTitle,
  defaultPlaybookColor,
  defaultPlaybookPaletteId,
  deletePage,
  duplicatePage,
  duplicatePlaybook,
  finishRenamePage,
  finishRenamePlaybook,
  newPage,
  newPlaybook,
  renamePage,
  renamePlaybook,
  reorderPages,
  setActivePage,
  setPageBody,
  setPageFloor,
  playbookFloorLayer,
  playbookFloorNote,
  playbookPageOnFloor,
  clonedPageImageIdMap,
  pageImageIds,
  setPageLayerImages,
  setPageLayerNote,
  setPageLayerVideos,
  setPageNote,
  setPageVideos,
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
    expect(book.sort).toBe(0);
  });

  it("uses provided palette and color", () => {
    const book = newPlaybook("de_mirage", "A execs", 0, {
      paletteId: "heat",
      color: "#ff7a00",
    });
    expect(book.paletteId).toBe("heat");
    expect(book.color).toBe("#ff7a00");
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
    expect(book.pages[0]?.title).toBe("  Mid control  ");
    book = finishRenamePage(book, firstId);
    expect(book.pages[0]?.title).toBe("Mid control");
    book = renamePage(book, firstId, "A exec");
    expect(book.pages[0]?.title).toBe("A exec");
    book = renamePage(book, firstId, "");
    expect(book.pages[0]?.title).toBe("");
    book = finishRenamePage(book, firstId);
    expect(book.pages[0]?.title).toBe(UNTITLED_STRAT);
    expect(renamePage(book, "missing", "X")).toBe(book);
    expect(finishRenamePage(book, "missing")).toBe(book);

    book = setActivePage(book, firstId);
    expect(book.activePageId).toBe(firstId);
    expect(setActivePage(book, firstId)).toBe(book);
    expect(setActivePage(book, "missing")).toBe(book);
  });

  it("updates floor and note on a page", () => {
    let book = newPlaybook("de_mirage", "Defaults");
    const id = book.pages[0]?.id ?? "";
    const note = emptyNote();
    note.drawings.push({
      type: "arrow",
      color: "#fff",
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
    });
    book = setPageFloor(book, id, "upper");
    book = setPageNote(book, id, note);
    expect(book.pages[0]?.floor).toBe("upper");
    expect(book.pages[0]?.note.drawings).toHaveLength(1);
    expect(book.pages[0]?.lowerNote.drawings).toEqual([]);
    expect(note.drawings).toHaveLength(1);
    note.drawings.pop();
    expect(book.pages[0]?.note.drawings).toHaveLength(1);
  });

  it("replaces the last strat with a blank page and ignores a missing id", () => {
    const book = newPlaybook("de_mirage", "Defaults");
    const firstId = book.pages[0]?.id ?? "";
    const cleared = deletePage(book, firstId);
    expect(cleared.pages).toHaveLength(1);
    expect(cleared.pages[0]?.id).not.toBe(firstId);
    expect(cleared.pages[0]?.title).toBe(UNTITLED_STRAT);
    expect(cleared.pages[0]?.note.pieces).toEqual([]);
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
    const sparse = {
      ...book,
      pages: Object.assign([], { 1: book.pages[0], length: 2 }),
    };
    expect(reorderPages(sparse, 0, 1).pages).toEqual(sparse.pages);
  });

  it("renames the book and duplicates it with new ids", () => {
    let book = newPlaybook("de_mirage", "Defaults");
    book = addPage(book, "A exec");
    book = renamePlaybook(book, "  ");
    expect(book.title).toBe("  ");
    book = finishRenamePlaybook(book);
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
    expect(newPage().body).toBe("");
    expect(newPage().videos).toEqual([]);
    expect(newPage().lowerVideos).toEqual([]);
    expect(newPage().images).toEqual([]);
    expect(newPage().lowerImages).toEqual([]);
    expect(newPage().lowerNote.drawings).toEqual([]);
    expect(newPage().floor).toBe("auto");
    expect(newPage("Split A", "upper")).toMatchObject({
      title: "Split A",
      floor: "upper",
    });
  });
});

describe("floor layers", () => {
  it("keeps upper and lower drawings on separate notes", () => {
    let book = newPlaybook("de_nuke", "Nuke execs");
    const id = book.pages[0]?.id ?? "";
    const upper = emptyNote();
    upper.drawings.push({ type: "text", color: "#fff", x: 1, y: 2, text: "heaven" });
    const lower = emptyNote();
    lower.drawings.push({ type: "text", color: "#fff", x: 3, y: 4, text: "tuck" });
    book = setPageLayerNote(book, id, "upper", upper);
    book = setPageLayerNote(book, id, "lower", lower);
    const page = book.pages[0]!;
    expect(playbookFloorLayer(false)).toBe("upper");
    expect(playbookFloorLayer(true)).toBe("lower");
    expect(playbookFloorNote(page, "upper").drawings[0]).toMatchObject({ text: "heaven" });
    expect(playbookFloorNote(page, "lower").drawings[0]).toMatchObject({ text: "tuck" });
    expect(playbookPageOnFloor(page, "lower").note.drawings[0]).toMatchObject({ text: "tuck" });
    expect(playbookPageOnFloor(page, "lower").floor).toBe("lower");
    expect(setPageFloor(book, id, "lower").pages[0]?.note.drawings[0]).toMatchObject({
      text: "heaven",
    });
    const copied = duplicatePage(book, id);
    expect(copied.pages[1]?.lowerNote.drawings[0]).toMatchObject({ text: "tuck" });
    expect(copied.pages[1]?.lowerNote.drawings[0]).not.toBe(page.lowerNote.drawings[0]);
  });

  it("stores YouTube pins per floor", () => {
    let book = newPlaybook("de_nuke", "Nuke execs");
    const id = book.pages[0]?.id ?? "";
    const clip = {
      id: "v1",
      videoId: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Lower lineup",
      x: 1,
      y: 2,
    };
    book = setPageLayerVideos(book, id, "lower", [clip]);
    expect(book.pages[0]?.videos).toEqual([]);
    expect(book.pages[0]?.lowerVideos).toEqual([clip]);
  });

  it("stores local images per floor and remints ids on copy", () => {
    let book = newPlaybook("de_nuke", "Nuke execs");
    const id = book.pages[0]?.id ?? "";
    const image = {
      id: "i1",
      name: "lineup.png",
      mime: "image/png" as const,
      x: 4,
      y: 5,
      width: 200,
      height: 100,
    };
    book = setPageLayerImages(book, id, "lower", [image]);
    expect(book.pages[0]?.images).toEqual([]);
    expect(book.pages[0]?.lowerImages).toEqual([image]);
    expect(playbookPageOnFloor(book.pages[0]!, "lower").images).toEqual([image]);
    expect(pageImageIds(book.pages[0]!)).toEqual(["i1"]);
    const copied = duplicatePage(book, id);
    expect(copied.pages[1]?.lowerImages[0]?.name).toBe("lineup.png");
    expect(copied.pages[1]?.lowerImages[0]?.id).not.toBe("i1");
    expect(copied.pages[0]?.lowerImages[0]?.id).toBe("i1");
    const idMap = clonedPageImageIdMap(book.pages[0]!, copied.pages[1]!);
    expect(idMap.get("i1")).toBe(copied.pages[1]?.lowerImages[0]?.id);
    expect(setPageLayerImages(book, "missing", "lower", [image])).toBe(book);
  });
});

describe("commitTitle / setPageBody", () => {
  it("keeps a typed name and restores untitled only when empty", () => {
    expect(commitTitle("  A exec  ", UNTITLED_STRAT)).toBe("A exec");
    expect(commitTitle("   ", UNTITLED_STRAT)).toBe(UNTITLED_STRAT);
    let book = newPlaybook("de_mirage", "Defaults");
    const id = book.pages[0]?.id ?? "";
    book = setPageBody(book, id, "flash mid, smoke stairs");
    expect(book.pages[0]?.body).toBe("flash mid, smoke stairs");
    expect(setPageBody(book, "missing", "x")).toBe(book);
    const videos = [
      {
        id: "v1",
        videoId: "dQw4w9WgXcQ",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "A smoke",
        x: 8,
        y: 9,
      },
    ];
    book = setPageVideos(book, id, videos);
    expect(book.pages[0]?.videos).toEqual(videos);
    expect(setPageVideos(book, "missing", videos)).toBe(book);
    const copied = duplicatePage(book, id);
    expect(copied.pages[1]?.videos[0]?.videoId).toBe("dQw4w9WgXcQ");
    expect(copied.pages[1]?.videos[0]?.id).not.toBe("v1");
    expect(copied.pages[0]?.videos[0]?.id).toBe("v1");
  });
});
