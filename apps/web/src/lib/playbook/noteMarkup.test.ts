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

  it("nests italic inside bold and bold inside italic", () => {
    expect(parseNoteMarkup("**bold *italic* still bold**")).toEqual([
      { text: "bold ", bold: true, italic: false, underline: false },
      { text: "italic", bold: true, italic: true, underline: false },
      { text: " still bold", bold: true, italic: false, underline: false },
    ]);
    expect(parseNoteMarkup("*italic **bold** still italic*")).toEqual([
      { text: "italic ", bold: false, italic: true, underline: false },
      { text: "bold", bold: true, italic: true, underline: false },
      { text: " still italic", bold: false, italic: true, underline: false },
    ]);
  });

  it("combines underline with italic or bold", () => {
    expect(parseNoteMarkup("__*both*__")).toEqual([
      { text: "both", bold: false, italic: true, underline: true },
    ]);
    expect(parseNoteMarkup("**__both__**")).toEqual([
      { text: "both", bold: true, italic: false, underline: true },
    ]);
    expect(parseNoteMarkup("__**both**__")).toEqual([
      { text: "both", bold: true, italic: false, underline: true },
    ]);
  });

  it("parses overlapping editor output as one combined run", () => {
    expect(parseNoteMarkup("**__*both**__*")).toEqual([
      { text: "both", bold: true, italic: true, underline: true },
    ]);
    expect(parseNoteMarkup("**__*both*__**")).toEqual([
      { text: "both", bold: true, italic: true, underline: true },
    ]);
  });

  it("does not eat the next word after sequential marks", () => {
    expect(parseNoteMarkup("**bold***italic*__under__plain")).toEqual([
      { text: "bold", bold: true, italic: false, underline: false },
      { text: "italic", bold: false, italic: true, underline: false },
      { text: "under", bold: false, italic: false, underline: true },
      { text: "plain", bold: false, italic: false, underline: false },
    ]);
    expect(parseNoteMarkup("**one**two *three* four")).toEqual([
      { text: "one", bold: true, italic: false, underline: false },
      { text: "two ", bold: false, italic: false, underline: false },
      { text: "three", bold: false, italic: true, underline: false },
      { text: " four", bold: false, italic: false, underline: false },
    ]);
  });

  it("drops closed markers from plain text and keeps style flags", () => {
    const samples = [
      "**bold**",
      "*italic*",
      "__under__",
      "**bold *italic* still bold**",
      "*italic **bold** still italic*",
      "__*both*__",
      "**__both__**",
      "__**both**__",
      "**__*both**__*",
      "**__*both*__**",
      "**bold***italic*__under__",
    ];
    for (const sample of samples) {
      const spans = parseNoteMarkup(sample);
      const plain = spans.map((span) => span.text).join("");
      expect(plain, sample).not.toContain("*");
      expect(plain, sample).not.toContain("__");
      expect(spans.some((span) => span.bold || span.italic || span.underline)).toBe(true);
    }
    const nested = parseNoteMarkup("**bold *italic* still bold**");
    expect(nested.some((span) => span.bold && span.italic && span.text === "italic")).toBe(true);
    const combo = parseNoteMarkup("__*both*__");
    expect(combo).toEqual([{ text: "both", bold: false, italic: true, underline: true }]);
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

  it("serializes combined styles as nested marks", () => {
    expect(serializeNoteMarkup([{ text: "both", bold: true, italic: true, underline: true }])).toBe(
      "**__*both*__**",
    );
    expect(normalizeNoteMarkup("**__*both**__*")).toBe("**__*both*__**");
    expect(parseNoteMarkup(normalizeNoteMarkup("**bold *italic* still bold**"))).toEqual(
      parseNoteMarkup("**bold *italic* still bold**"),
    );
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
