import { describe, expect, it } from "vitest";
import { NOTE_LAYER_NAME } from "@/lib/shared/constants";
import { emptyNote } from "./note";
import {
  assignToGroup,
  canGroup,
  dropItems,
  groupItems,
  nextGroupId,
  nextLayerName,
  removeItems,
  renameGroup,
  setGroupHidden,
  setItemsHidden,
  squashLooseDrawings,
  ungroup,
  type NoteItemRef,
} from "./noteGroups";
import { visibleDrawings } from "./note";
import type { Drawing, Note } from "./types";

const pen: Drawing = {
  type: "pen",
  color: "#fff",
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
};

function looseNote(count: number, extra: Partial<Note> = {}): Note {
  return {
    ...emptyNote(),
    drawings: Array.from({ length: count }, (_, i) => ({ ...pen, color: `#${i}${i}${i}` })),
    ...extra,
  };
}

describe("nextGroupId / nextLayerName", () => {
  it("increments from auto and named groups", () => {
    expect(nextGroupId(emptyNote())).toBe("Group 1");
    expect(
      nextGroupId({
        ...emptyNote(),
        groups: [{ id: "Group 1", name: "Group 1", drawings: [pen] }],
      }),
    ).toBe("Group 2");
    expect(
      nextGroupId({
        ...emptyNote(),
        groups: [{ id: "g3", name: "g3", drawings: [pen] }],
      }),
    ).toBe("Group 4");
    expect(nextLayerName(emptyNote())).toBe(NOTE_LAYER_NAME);
    const named = groupItems(looseNote(2), [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const layer = {
      ...named,
      groups: [{ ...named.groups[0], id: NOTE_LAYER_NAME, name: NOTE_LAYER_NAME }],
    };
    expect(nextLayerName(layer)).toBe(`${NOTE_LAYER_NAME} 2`);
  });
});

describe("groupItems", () => {
  it("needs two drawings and unions their windows", () => {
    const note = {
      ...emptyNote(),
      drawings: [
        { ...pen, start_tick: 100, end_tick: 200 },
        { ...pen, start_tick: 180, end_tick: 220 },
        { ...pen },
      ],
    };
    const refs: NoteItemRef[] = [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ];
    expect(canGroup(note, [{ kind: "loose", index: 0 }])).toBe(false);
    expect(canGroup(note, refs)).toBe(true);
    const next = groupItems(note, refs);
    expect(next.groups[0]).toMatchObject({ name: "Group 1", start_tick: 100, end_tick: 220 });
    expect(next.groups[0]?.drawings).toHaveLength(2);
    expect(next.drawings).toHaveLength(1);
  });
});

describe("ungroup / renameGroup", () => {
  it("moves members to loose and keeps a custom label", () => {
    const grouped = groupItems(looseNote(2), [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const named = renameGroup(grouped, 0, "A execute");
    expect(named.groups[0]?.name).toBe("A execute");
    expect(renameGroup(named, 0, "   ")).toEqual(named);
    const next = ungroup(named, 0);
    expect(next.groups).toHaveLength(0);
    expect(next.drawings).toHaveLength(2);
    expect(ungroup(named, 9)).toEqual(named);
    const hidden = setItemsHidden(named, [{ kind: "group", groupIndex: 0, drawingIndex: 0 }], true);
    const opened = ungroup(hidden, 0);
    expect(opened.drawings.filter((i) => i.hidden)).toHaveLength(1);
    const layerHidden = ungroup(setGroupHidden(named, 0, true), 0);
    expect(layerHidden.drawings.every((i) => i.hidden)).toBe(true);
  });
});

describe("dropItems", () => {
  it("drops a loose drawing onto a layer", () => {
    const grouped = groupItems(looseNote(3), [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const next = dropItems(grouped, [{ kind: "loose", index: 0 }], {
      kind: "into",
      groupIndex: 0,
    });
    expect(next.groups[0]?.drawings).toHaveLength(3);
    expect(next.drawings).toHaveLength(0);
  });

  it("drops a member out and dissolves a leftover singleton", () => {
    const grouped = groupItems(looseNote(2), [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const next = dropItems(grouped, [{ kind: "group", groupIndex: 0, drawingIndex: 0 }], {
      kind: "ungroup",
    });
    expect(next.groups).toHaveLength(0);
    expect(next.drawings).toHaveLength(2);
  });

  it("makes a new group from two loose drawings and ignores one", () => {
    const two = dropItems(
      looseNote(3),
      [
        { kind: "loose", index: 0 },
        { kind: "loose", index: 1 },
      ],
      {
        kind: "new-group",
      },
    );
    expect(two.groups[0]?.drawings).toHaveLength(2);
    expect(two.drawings).toHaveLength(1);
    const one = dropItems(looseNote(2), [{ kind: "loose", index: 0 }], { kind: "new-group" });
    expect(one.groups).toHaveLength(0);
  });

  it("does not rebuild a group from all of its members", () => {
    const grouped = groupItems(looseNote(2), [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const same = dropItems(
      grouped,
      [
        { kind: "group", groupIndex: 0, drawingIndex: 0 },
        { kind: "group", groupIndex: 0, drawingIndex: 1 },
      ],
      { kind: "new-group" },
    );
    expect(same).toEqual(grouped);
  });
});

describe("squashLooseDrawings", () => {
  it("squashes loose pens into one Drawings layer and leaves text", () => {
    const note: Note = {
      ...emptyNote(),
      drawings: [
        { ...pen },
        { ...pen, color: "#0f0" },
        { type: "text", color: "#fff", x: 0, y: 0, text: "hold" },
      ],
    };
    const next = squashLooseDrawings(note);
    expect(next.groups[0]?.name).toBe(NOTE_LAYER_NAME);
    expect(next.groups[0]?.drawings).toHaveLength(2);
    expect(next.drawings[0]?.type).toBe("text");
    expect(squashLooseDrawings(emptyNote())).toEqual(emptyNote());
  });
});

describe("removeItems / setItemsHidden", () => {
  it("removes bookmarks and drawings", () => {
    const note: Note = {
      ...emptyNote(),
      drawings: [pen],
      bookmarks: [{ color: "#fff", text: "x", tick: 1 }],
    };
    const next = removeItems(note, [
      { kind: "loose", index: 0 },
      { kind: "bookmark", index: 0 },
    ]);
    expect(next.drawings).toHaveLength(0);
    expect(next.bookmarks).toHaveLength(0);
  });

  it("hides one grouped drawing without hiding the layer", () => {
    const grouped = groupItems(looseNote(2), [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const hidden = setItemsHidden(
      grouped,
      [{ kind: "group", groupIndex: 0, drawingIndex: 0 }],
      true,
    );
    expect(visibleDrawings(hidden, 100)).toHaveLength(1);
    const shown = setItemsHidden(
      hidden,
      [{ kind: "group", groupIndex: 0, drawingIndex: 0 }],
      false,
    );
    expect(visibleDrawings(shown, 100)).toHaveLength(2);
  });

  it("hides a whole layer from the radar", () => {
    const grouped = groupItems(looseNote(2), [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const hidden = setGroupHidden(grouped, 0, true);
    expect(visibleDrawings(hidden, 100)).toHaveLength(0);
    expect(visibleDrawings(setGroupHidden(hidden, 0, false), 100)).toHaveLength(2);
  });

  it("toggles hidden on a loose item and bookmark", () => {
    const note: Note = {
      ...emptyNote(),
      drawings: [pen, { ...pen }],
      bookmarks: [{ color: "#fff", text: "x", tick: 1 }],
    };
    const next = setItemsHidden(
      note,
      [
        { kind: "loose", index: 1 },
        { kind: "bookmark", index: 0 },
      ],
      true,
    );
    expect(next.drawings[0]?.hidden).toBeUndefined();
    expect(next.drawings[1]?.hidden).toBe(true);
    expect(next.bookmarks[0]?.hidden).toBe(true);
    const shown = setItemsHidden(next, [{ kind: "bookmark", index: 0 }], false);
    expect(shown.bookmarks[0]?.hidden).toBeUndefined();
  });
});

describe("assignToGroup", () => {
  it("no-ops when the destination group is missing", () => {
    expect(assignToGroup(looseNote(1), [{ kind: "loose", index: 0 }], 3)).toEqual(looseNote(1));
  });

  it("puts drawings back on loose when the dest group dissolves", () => {
    const grouped = groupItems(looseNote(2), [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const next = assignToGroup(
      grouped,
      [
        { kind: "group", groupIndex: 0, drawingIndex: 0 },
        { kind: "group", groupIndex: 0, drawingIndex: 1 },
      ],
      0,
    );
    expect(next.groups).toHaveLength(0);
    expect(next.drawings).toHaveLength(2);
  });

  it("copies a dest window onto added members", () => {
    const grouped = groupItems(
      {
        ...emptyNote(),
        drawings: [
          { ...pen, start_tick: 10, end_tick: 20 },
          { ...pen, start_tick: 10, end_tick: 20 },
          { ...pen, start_tick: 30, end_tick: 40 },
        ],
      },
      [
        { kind: "loose", index: 0 },
        { kind: "loose", index: 1 },
      ],
    );
    const next = assignToGroup(grouped, [{ kind: "loose", index: 0 }], 0);
    expect(next.groups[0]?.drawings).toHaveLength(3);
    expect(next.groups[0]?.start_tick).toBe(10);
  });
});

describe("dropItems edges", () => {
  it("ignores empty and bookmark-only selections", () => {
    const note: Note = {
      ...emptyNote(),
      drawings: [pen],
      bookmarks: [{ color: "#fff", text: "x", tick: 1 }],
    };
    expect(dropItems(note, [], { kind: "new-group" })).toEqual(note);
    expect(dropItems(note, [{ kind: "bookmark", index: 0 }], { kind: "new-group" })).toEqual(note);
    expect(
      canGroup(note, [
        { kind: "bookmark", index: 0 },
        { kind: "loose", index: 9 },
      ]),
    ).toBe(false);
  });

  it("dedupes refs and extracts two members into a new group", () => {
    const grouped = groupItems(looseNote(3), [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
      { kind: "loose", index: 2 },
    ]);
    const next = dropItems(
      grouped,
      [
        { kind: "group", groupIndex: 0, drawingIndex: 0 },
        { kind: "group", groupIndex: 0, drawingIndex: 0 },
        { kind: "group", groupIndex: 0, drawingIndex: 1 },
      ],
      { kind: "new-group" },
    );
    expect(next.groups).toHaveLength(1);
    expect(next.groups[0]?.drawings).toHaveLength(2);
    expect(next.drawings).toHaveLength(1);
  });
});

describe("removeItems from a group", () => {
  it("dissolves a leftover singleton and skips a missing bookmark", () => {
    const grouped = groupItems(looseNote(2), [
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    const next = removeItems(grouped, [
      { kind: "group", groupIndex: 0, drawingIndex: 0 },
      { kind: "bookmark", index: 3 },
    ]);
    expect(next.groups).toHaveLength(0);
    expect(next.drawings).toHaveLength(1);
  });
});

describe("setItemsHidden misses", () => {
  it("skips missing indexes", () => {
    const note = looseNote(1);
    expect(
      setItemsHidden(
        note,
        [
          { kind: "loose", index: 9 },
          { kind: "group", groupIndex: 0, drawingIndex: 0 },
          { kind: "bookmark", index: 0 },
        ],
        true,
      ),
    ).toEqual(note);
  });
});
