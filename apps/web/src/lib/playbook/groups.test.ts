import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { makePiece } from "./pieces";
import {
  groupOverlayItems,
  renamePlaybookGroup,
  setGroupHidden,
  ungroupPlaybookGroup,
} from "./groups";

describe("playbook grouping", () => {
  it("groups pieces, hides them with the group, and ungroups", () => {
    const note = emptyNote();
    note.pieces.push(makePiece("pawn", 0, 0, { id: "a" }), makePiece("smoke", 1, 1, { id: "b" }));
    const grouped = groupOverlayItems(note, ["piece:a", "piece:b"]);
    expect(grouped.groups).toHaveLength(1);
    const groupId = grouped.groups[0]!.id;
    expect(grouped.pieces.every((piece) => piece.groupId === groupId)).toBe(true);
    grouped.radarFx = {
      deaths: [],
      opening: null,
      tracers: [],
      trails: [{ points: [{ x: 0, y: 0 }], color: "#fff", groupId }],
      heatmap: [],
      summary: [],
      cone: null,
      hits: [],
      flashes: [],
    };
    const hidden = setGroupHidden(grouped, groupId, true);
    expect(hidden.groups[0]?.hidden).toBe(true);
    const renamed = renamePlaybookGroup(hidden, groupId, "A exec");
    expect(renamed.groups[0]?.name).toBe("A exec");
    const loose = ungroupPlaybookGroup(renamed, groupId);
    expect(loose.groups).toHaveLength(0);
    expect(loose.pieces.every((piece) => piece.groupId == null)).toBe(true);
    expect(loose.radarFx?.trails[0]?.groupId).toBeUndefined();
  });

  it("needs at least two items", () => {
    const note = emptyNote();
    note.pieces.push(makePiece("pawn", 0, 0, { id: "a" }));
    expect(groupOverlayItems(note, ["piece:a"])).toBe(note);
  });
});
