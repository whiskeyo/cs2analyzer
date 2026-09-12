import { describe, expect, it } from "vitest";
import {
  normalizeNoteMarkup,
  parseNoteMarkup,
  parseNoteMarkupLines,
  serializeNoteMarkup,
  serializeNoteMarkupLines,
  wrapNoteMarkup,
} from "./noteMarkup";

describe("parseNoteMarkup", () => {
  it("keeps plain text", () => {
    expect(parseNoteMarkup("Smoke stairs.")).toEqual([
      { text: "Smoke stairs.", bold: false, italic: false, underline: false },
    ]);
  });

  it("parses bold, italic, and underline", () => {
    expect(parseNoteMarkup("**bold** *star* _under_ __line__")).toEqual([
      { text: "bold", bold: true, italic: false, underline: false },
      { text: " ", bold: false, italic: false, underline: false },
      { text: "star", bold: false, italic: true, underline: false },
      { text: " ", bold: false, italic: false, underline: false },
      { text: "under", bold: false, italic: true, underline: false },
      { text: " ", bold: false, italic: false, underline: false },
      { text: "line", bold: false, italic: false, underline: true },
    ]);
  });

  it("prefers ** and __ over single markers", () => {
    expect(parseNoteMarkup("**mid**")).toEqual([
      { text: "mid", bold: true, italic: false, underline: false },
    ]);
    expect(parseNoteMarkup("__mid__")).toEqual([
      { text: "mid", bold: false, italic: false, underline: true },
    ]);
  });

  it("leaves unmatched markers as literal text", () => {
    expect(parseNoteMarkup("cost * 2")).toEqual([
      { text: "cost * 2", bold: false, italic: false, underline: false },
    ]);
    expect(parseNoteMarkup("see __later")).toEqual([
      { text: "see __later", bold: false, italic: false, underline: false },
    ]);
    expect(parseNoteMarkup("see **later")).toEqual([
      { text: "see **later", bold: false, italic: false, underline: false },
    ]);
  });
});

describe("serializeNoteMarkup", () => {
  it("round-trips styled spans and keeps unmatched markers", () => {
    const input = "**bold** *star* _under_ __line__";
    const spans = parseNoteMarkup(input);
    expect(serializeNoteMarkup(spans)).toBe("**bold** *star* *under* __line__");
    expect(parseNoteMarkup(serializeNoteMarkup(spans))).toEqual(spans);
    expect(normalizeNoteMarkup("see **later")).toBe("see **later");
    expect(normalizeNoteMarkup("cost * 2")).toBe("cost * 2");
  });

  it("parses and serializes each line on its own", () => {
    const input = "hold mid\n**stairs**\n\n__late__";
    expect(parseNoteMarkupLines(input)).toHaveLength(4);
    expect(serializeNoteMarkupLines(parseNoteMarkupLines(input))).toBe(input);
    expect(normalizeNoteMarkup("a\n_b_\n")).toBe("a\n*b*\n");
  });
});

describe("wrapNoteMarkup", () => {
  it("wraps and unwraps a selection", () => {
    expect(wrapNoteMarkup("flash mid", 0, 5, "**")).toEqual({
      text: "**flash** mid",
      start: 2,
      end: 7,
    });
    expect(wrapNoteMarkup("**flash** mid", 2, 7, "**")).toEqual({
      text: "flash mid",
      start: 0,
      end: 5,
    });
    expect(wrapNoteMarkup("**flash** mid", 0, 9, "**")).toEqual({
      text: "flash mid",
      start: 0,
      end: 5,
    });
  });
});
