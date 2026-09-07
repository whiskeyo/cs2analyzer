import { describe, expect, it } from "vitest";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { parsePlaybook, parsePlaybookPage } from "./parse";
import { newPlaybook } from "./pages";
import { PLAYBOOK_SCHEMA, UNTITLED_PLAYBOOK, UNTITLED_STRAT } from "./types";

describe("parsePlaybookPage", () => {
  it("parses a page and fills defaults", () => {
    expect(
      parsePlaybookPage({
        id: "p1",
        title: "  A exec  ",
        floor: "lower",
        note: { groups: [], drawings: [], pieces: [], bookmarks: [] },
      }),
    ).toMatchObject({ id: "p1", title: "A exec", floor: "lower" });
    expect(parsePlaybookPage({ id: "p2" })?.title).toBe(UNTITLED_STRAT);
    expect(parsePlaybookPage({ id: "p3", floor: "nope" })?.floor).toBe("auto");
    expect(parsePlaybookPage({ id: "  " })).toBeNull();
    expect(parsePlaybookPage(null)).toBeNull();
    expect(parsePlaybookPage({ id: "p4", note: 3 })).toBeNull();
  });
});

describe("parsePlaybook", () => {
  it("round-trips a created book", () => {
    const book = newPlaybook("de_mirage", "Defaults");
    expect(parsePlaybook(book)).toEqual(book);
  });

  it("drops junk pages and repairs activePageId", () => {
    const parsed = parsePlaybook({
      schema: PLAYBOOK_SCHEMA,
      key: "k1",
      mapName: "de_inferno",
      title: "  ",
      savedAt: "nope",
      paletteId: "unknown",
      color: "  ",
      activePageId: "gone",
      pages: [
        { id: "", title: "bad" },
        { id: "ok", title: "Split", floor: "upper" },
        { id: "ok2", note: { groups: [], drawings: [], pieces: [], bookmarks: [] } },
      ],
    });
    expect(parsed).toMatchObject({
      key: "k1",
      mapName: "de_inferno",
      title: UNTITLED_PLAYBOOK,
      savedAt: 0,
      paletteId: COLOR_PRESETS[0].id,
      color: COLOR_PRESETS[0].colors[0],
      activePageId: "ok",
    });
    expect(parsed?.pages).toHaveLength(2);
    expect(parsed?.pages[0]?.floor).toBe("upper");
  });

  it("keeps a known palette, color, and active page", () => {
    const parsed = parsePlaybook({
      schema: PLAYBOOK_SCHEMA,
      key: "k2",
      mapName: "de_mirage",
      title: "A execs",
      savedAt: 9,
      paletteId: COLOR_PRESETS[1].id,
      color: "#abc",
      activePageId: "b",
      pages: [
        { id: "a", title: "A" },
        { id: "b", title: "B" },
      ],
    });
    expect(parsed).toMatchObject({
      title: "A execs",
      savedAt: 9,
      paletteId: COLOR_PRESETS[1].id,
      color: "#abc",
      activePageId: "b",
    });
  });

  it("rejects a bad schema, missing key, or empty pages", () => {
    expect(parsePlaybook(null)).toBeNull();
    expect(parsePlaybook({ schema: 0, key: "k", mapName: "de_mirage", pages: [] })).toBeNull();
    expect(
      parsePlaybook({
        schema: PLAYBOOK_SCHEMA,
        key: "  ",
        mapName: "de_mirage",
        pages: [{ id: "p" }],
      }),
    ).toBeNull();
    expect(
      parsePlaybook({ schema: PLAYBOOK_SCHEMA, key: "k", mapName: "  ", pages: [{ id: "p" }] }),
    ).toBeNull();
    expect(parsePlaybook({ schema: PLAYBOOK_SCHEMA, key: "k", mapName: "de_mirage" })).toBeNull();
    expect(
      parsePlaybook({ schema: PLAYBOOK_SCHEMA, key: "k", mapName: "de_mirage", pages: [{}] }),
    ).toBeNull();
  });
});
