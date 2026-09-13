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
    expect(parsePlaybookPage({ id: "p2" })?.body).toBe("");
    expect(parsePlaybookPage({ id: "p5", body: "hold mid" })?.body).toBe("hold mid");
    expect(parsePlaybookPage({ id: "p2" })?.videos).toEqual([]);
    expect(parsePlaybookPage({ id: "p2" })?.lowerVideos).toEqual([]);
    expect(parsePlaybookPage({ id: "p2" })?.images).toEqual([]);
    expect(parsePlaybookPage({ id: "p2" })?.lowerImages).toEqual([]);
    expect(parsePlaybookPage({ id: "p2" })?.lowerNote.drawings).toEqual([]);
    expect(
      parsePlaybookPage({
        id: "p6",
        videos: [
          { id: "v1", videoId: "dQw4w9WgXcQ", title: "  A smoke  ", startSeconds: 30 },
          { id: "bad", videoId: "nope" },
          { videoId: "dQw4w9WgXcQ" },
        ],
      })?.videos,
    ).toEqual([
      {
        id: "v1",
        videoId: "dQw4w9WgXcQ",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30",
        title: "A smoke",
        x: 0,
        y: 0,
        startSeconds: 30,
      },
    ]);
    expect(
      parsePlaybookPage({
        id: "p7",
        videos: [{ id: "v2", videoId: "dQw4w9WgXcQ", title: "B", x: 12, y: 34 }],
      })?.videos[0],
    ).toMatchObject({ x: 12, y: 34 });
    expect(
      parsePlaybookPage({
        id: "p9",
        images: [
          {
            id: "i1",
            name: "  A smoke.png  ",
            mime: "image/jpg",
            x: 8,
            y: 9,
            width: 200,
            height: 100,
          },
          { id: "bad", mime: "image/gif" },
          { id: "no-size", mime: "image/png" },
        ],
        lowerImages: [{ id: "i2", name: "lower.webp", mime: "image/webp" }],
      }),
    ).toMatchObject({
      images: [
        {
          id: "i1",
          name: "A smoke.png",
          mime: "image/jpeg",
          x: 8,
          y: 9,
        },
        { id: "no-size", mime: "image/png", name: "image", x: 0, y: 0 },
      ],
      lowerImages: [{ id: "i2", name: "lower.webp", mime: "image/webp", x: 0, y: 0 }],
    });
    expect(parsePlaybookPage({ id: "p3", floor: "nope" })?.floor).toBe("auto");
    expect(parsePlaybookPage({ id: "  " })).toBeNull();
    expect(parsePlaybookPage(null)).toBeNull();
    expect(parsePlaybookPage({ id: "p4", note: 3 })).toBeNull();
    expect(parsePlaybookPage({ id: "p8", lowerNote: 3 })).toBeNull();
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
        {
          id: "ok2",
          note: { groups: [], drawings: [], pieces: [], bookmarks: [] },
        },
      ],
    });
    expect(parsed).toMatchObject({
      key: "k1",
      mapName: "de_inferno",
      title: UNTITLED_PLAYBOOK,
      savedAt: 0,
      sort: 0,
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
      sort: 9,
      paletteId: COLOR_PRESETS[1].id,
      color: "#abc",
      activePageId: "b",
    });
  });

  it("keeps an explicit sort instead of savedAt", () => {
    const parsed = parsePlaybook({
      schema: PLAYBOOK_SCHEMA,
      key: "k3",
      mapName: "de_mirage",
      savedAt: 99,
      sort: 2,
      pages: [{ id: "a", title: "A" }],
    });
    expect(parsed?.sort).toBe(2);
  });

  it("migrates a schema 1 book and fills videos", () => {
    const parsed = parsePlaybook({
      schema: 1,
      key: "old",
      mapName: "de_mirage",
      pages: [{ id: "p", title: "A exec" }],
    });
    expect(parsed?.schema).toBe(PLAYBOOK_SCHEMA);
    expect(parsed?.pages[0]).toMatchObject({
      title: "A exec",
      videos: [],
      lowerVideos: [],
      images: [],
      lowerImages: [],
    });
  });

  it("migrates a schema 3 book and fills empty image lists", () => {
    const parsed = parsePlaybook({
      schema: 3,
      key: "old3",
      mapName: "de_mirage",
      pages: [
        {
          id: "p",
          title: "A exec",
          videos: [{ id: "v1", videoId: "dQw4w9WgXcQ", title: "Clip" }],
        },
      ],
    });
    expect(parsed?.schema).toBe(PLAYBOOK_SCHEMA);
    expect(parsed?.pages[0]?.videos[0]?.videoId).toBe("dQw4w9WgXcQ");
    expect(parsed?.pages[0]?.images).toEqual([]);
    expect(parsed?.pages[0]?.lowerImages).toEqual([]);
  });

  it("keeps schema 2 drawings on the upper floor", () => {
    const parsed = parsePlaybook({
      schema: 2,
      key: "old2",
      mapName: "de_nuke",
      pages: [
        {
          id: "p",
          title: "A rush",
          note: {
            groups: [],
            drawings: [{ type: "text", color: "#fff", x: 1, y: 2, text: "heaven" }],
            pieces: [],
            bookmarks: [],
          },
        },
      ],
    });
    expect(parsed?.schema).toBe(PLAYBOOK_SCHEMA);
    expect(parsed?.pages[0]?.note.drawings).toHaveLength(1);
    expect(parsed?.pages[0]?.lowerNote.drawings).toEqual([]);
    expect(parsed?.pages[0]?.lowerVideos).toEqual([]);
  });

  it("rejects a bad schema, missing key, or empty pages", () => {
    expect(parsePlaybook(null)).toBeNull();
    expect(parsePlaybook({ schema: 0, key: "k", mapName: "de_mirage", pages: [] })).toBeNull();
    expect(
      parsePlaybook({
        schema: 5,
        key: "k",
        mapName: "de_mirage",
        pages: [{ id: "p" }],
      }),
    ).toBeNull();
    expect(
      parsePlaybook({
        schema: PLAYBOOK_SCHEMA,
        key: "  ",
        mapName: "de_mirage",
        pages: [{ id: "p" }],
      }),
    ).toBeNull();
    expect(
      parsePlaybook({
        schema: PLAYBOOK_SCHEMA,
        key: "k",
        mapName: "  ",
        pages: [{ id: "p" }],
      }),
    ).toBeNull();
    expect(
      parsePlaybook({
        schema: PLAYBOOK_SCHEMA,
        key: "k",
        mapName: "de_mirage",
      }),
    ).toBeNull();
    expect(
      parsePlaybook({
        schema: PLAYBOOK_SCHEMA,
        key: "k",
        mapName: "de_mirage",
        pages: [{}],
      }),
    ).toBeNull();
  });
});
