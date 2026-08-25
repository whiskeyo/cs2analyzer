import { describe, expect, it } from "vitest";
import { applyTextCommit, type TextEdit } from "./TextNoteEditor";

function edit(partial: Partial<TextEdit> = {}): TextEdit {
  return {
    index: null,
    x: 1,
    y: 2,
    sx: 0,
    sy: 0,
    text: "hold",
    color: "#fff",
    round: 1,
    ...partial,
  };
}

describe("applyTextCommit", () => {
  it("appends a new note", () => {
    const next = applyTextCommit(edit(), { box_w: 200, box_h: 40 }, []);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ type: "text", text: "hold", box_w: 200, x: 1, y: 2 });
  });

  it("drops an empty new note", () => {
    expect(applyTextCommit(edit({ text: "  " }), {}, [])).toEqual([]);
  });

  it("removes an existing note when cleared", () => {
    const list = [{ type: "text" as const, round: 1, color: "#fff", x: 0, y: 0, text: "old" }];
    expect(applyTextCommit(edit({ index: 0, text: "" }), {}, list)).toEqual([]);
  });
});
