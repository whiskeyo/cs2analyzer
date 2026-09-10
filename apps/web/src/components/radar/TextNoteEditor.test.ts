import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { applyTextCommit, type TextEdit } from "./TextNoteEditor";

function edit(partial: Partial<TextEdit> = {}): TextEdit {
  return {
    ref: null,
    x: 1,
    y: 2,
    sx: 0,
    sy: 0,
    text: "hold",
    color: "#fff",
    ...partial,
  };
}

describe("applyTextCommit", () => {
  it("appends a new note", () => {
    const next = applyTextCommit(edit(), { box_w: 200, box_h: 40 }, emptyNote());
    expect(next.drawings).toHaveLength(1);
    expect(next.drawings[0]).toMatchObject({ type: "text", text: "hold", box_w: 200, x: 1, y: 2 });
  });

  it("drops an empty new note", () => {
    expect(applyTextCommit(edit({ text: "  " }), {}, emptyNote())).toEqual(emptyNote());
  });

  it("removes an existing note when cleared", () => {
    const note = {
      ...emptyNote(),
      drawings: [{ type: "text" as const, color: "#fff", x: 0, y: 0, text: "old" }],
    };
    expect(
      applyTextCommit(edit({ ref: { kind: "loose", index: 0 }, text: "" }), {}, note).drawings,
    ).toEqual([]);
  });
});
