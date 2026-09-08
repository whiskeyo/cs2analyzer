import { describe, expect, it } from "vitest";
import { newPlaybook } from "./pages";
import {
  booksWithDraft,
  comparePlaybooks,
  groupPlaybooksByMap,
  mapsForTree,
  movePlaybookInMap,
  nextPlaybookSort,
  treeGuide,
} from "./tree";

describe("playbook tree grouping", () => {
  it("groups books by map and lists calibration maps first", () => {
    const mirage = newPlaybook("de_mirage", "A");
    const inferno = newPlaybook("de_inferno", "B");
    const extra = newPlaybook("de_vertigo", "C");
    const grouped = groupPlaybooksByMap([mirage, inferno, extra, newPlaybook("de_mirage", "D")]);
    expect(grouped.get("de_mirage")?.map((book) => book.title)).toEqual(["A", "D"]);
    expect(grouped.get("de_inferno")).toHaveLength(1);
    expect(mapsForTree(["de_mirage", "de_inferno"], [mirage, extra, inferno])).toEqual([
      "de_mirage",
      "de_inferno",
      "de_vertigo",
    ]);
    expect(mapsForTree(["de_nuke"], [])).toEqual(["de_nuke"]);
    expect(groupPlaybooksByMap([]).size).toBe(0);
  });

  it("orders books by sort, not recency or the active draft", () => {
    const late = { ...newPlaybook("de_mirage", "Late"), sort: 1, savedAt: 90 };
    const early = { ...newPlaybook("de_mirage", "Early"), sort: 0, savedAt: 10 };
    expect([late, early].sort(comparePlaybooks).map((book) => book.title)).toEqual([
      "Early",
      "Late",
    ]);
    expect(nextPlaybookSort([early, late], "de_mirage")).toBe(2);
    expect(nextPlaybookSort([early, late], "de_inferno")).toBe(0);
    const moved = movePlaybookInMap([early, late], "de_mirage", early.key, 1);
    expect(moved.map((book) => `${book.title}:${book.sort}`)).toEqual(["Late:0", "Early:1"]);
    expect(movePlaybookInMap([early, late], "de_mirage", early.key, -1)).toEqual([]);
    const renamed = { ...late, title: "Renamed" };
    expect(booksWithDraft([early, late], renamed).map((book) => book.title)).toEqual([
      "Early",
      "Renamed",
    ]);
  });
});

describe("treeGuide", () => {
  it("prints linux tree prefixes", () => {
    expect(treeGuide(false)).toBe("├── ");
    expect(treeGuide(true)).toBe("└── ");
    expect(treeGuide(false, [false])).toBe("│   ├── ");
    expect(treeGuide(true, [false])).toBe("│   └── ");
    expect(treeGuide(true, [true])).toBe("    └── ");
  });
});
