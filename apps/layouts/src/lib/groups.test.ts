import { describe, expect, it } from "vitest";
import {
  canGroupIds,
  canUngroupIds,
  clusterCallouts,
  dropCalloutsOn,
  groupCallouts,
  groupLabel,
  nudgeGroupOrder,
  renameGroup,
  syncGroupOrder,
  ungroupCallouts,
} from "./groups";
import type { LayoutCallout } from "./types";

const triangle = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
];

function callout(id: string, name = id, group?: string): LayoutCallout {
  return { id, name, floor: "default", polygon: triangle, ...(group ? { group } : {}) };
}

describe("groupCallouts", () => {
  it("needs two members and names the layer Group 1", () => {
    const list = [callout("a"), callout("b"), callout("c")];
    expect(groupCallouts(list, ["a"])).toBe(list);
    const next = groupCallouts(list, ["a", "c"]);
    expect(next[0]?.group).toBe("Group 1");
    expect(next[1]?.group).toBeUndefined();
    expect(next[2]?.group).toBe("Group 1");
  });
});

describe("dropCalloutsOn", () => {
  it("drops two loose callouts on the new-group slot", () => {
    const next = dropCalloutsOn([callout("a"), callout("b"), callout("c")], ["a", "b"], {
      kind: "new-group",
    });
    expect(next[0]?.group).toBe("Group 1");
    expect(next[1]?.group).toBe("Group 1");
    expect(next[2]?.group).toBeUndefined();
  });

  it("does not make a new group from a single callout", () => {
    const list = [callout("a"), callout("b")];
    expect(dropCalloutsOn(list, ["a"], { kind: "new-group" })).toBe(list);
  });

  it("adds a callout onto an existing group and ungroups at the top slot", () => {
    const grouped = groupCallouts([callout("a"), callout("b"), callout("c")], ["a", "b"]);
    const into = dropCalloutsOn(grouped, ["c"], { kind: "into", group: "Group 1" });
    expect(into.every((c) => c.group === "Group 1")).toBe(true);
    const out = dropCalloutsOn(into, ["a"], { kind: "ungroup" });
    expect(out.find((c) => c.id === "a")?.group).toBeUndefined();
    expect(out.find((c) => c.id === "b")?.group).toBe("Group 1");
    expect(out.find((c) => c.id === "c")?.group).toBe("Group 1");
  });

  it("extracts two members into a new group and dissolves a leftover singleton", () => {
    const grouped = groupCallouts([callout("a"), callout("b"), callout("c")], ["a", "b", "c"]);
    const next = dropCalloutsOn(grouped, ["a", "b"], { kind: "new-group" });
    expect(next[0]?.group).toBe("Group 2");
    expect(next[1]?.group).toBe("Group 2");
    expect(next[2]?.group).toBeUndefined();
  });
});

describe("renameGroup", () => {
  it("renames every member", () => {
    const grouped = groupCallouts([callout("a"), callout("b")], ["a", "b"]);
    const next = renameGroup(grouped, grouped[0]?.group ?? "", "A side");
    expect(next[0]?.group).toBe("A side");
    expect(next[1]?.group).toBe("A side");
    expect(groupLabel("g1")).toBe("Group 1");
    expect(groupLabel("A side")).toBe("A side");
  });
});

describe("ungroupCallouts", () => {
  it("clears the shared id from every member", () => {
    const grouped = groupCallouts([callout("a"), callout("b"), callout("c")], ["a", "b"]);
    const next = ungroupCallouts(grouped, ["a"]);
    expect(next.every((c) => c.group == null)).toBe(true);
  });
});

describe("clusterCallouts", () => {
  it("clusters grouped callouts under one header", () => {
    const clusters = clusterCallouts([
      callout("mid", "Mid"),
      callout("a", "A Site", "A side"),
      callout("tet", "Tetris", "A side"),
    ]);
    expect(clusters[0]).toMatchObject({ group: "A side" });
    expect(clusters[0]?.callouts.map((c) => c.id)).toEqual(["a", "tet"]);
    expect(clusters[1]?.group).toBeNull();
  });

  it("honors an explicit group order", () => {
    const list = [
      callout("a", "A Site", "A side"),
      callout("tet", "Tetris", "A side"),
      callout("b", "B Site", "B side"),
      callout("apps", "Apps", "B side"),
    ];
    expect(clusterCallouts(list, ["B side", "A side"]).map((c) => c.group)).toEqual([
      "B side",
      "A side",
    ]);
    expect(syncGroupOrder(["B side"], list)).toEqual(["B side", "A side"]);
    expect(nudgeGroupOrder(["A side", "B side"], "A side", 1)).toEqual(["B side", "A side"]);
  });

  it("requires two selected ids to group", () => {
    const list = [callout("a"), callout("b")];
    expect(canGroupIds(list, ["a"])).toBe(false);
    expect(canGroupIds(list, ["a", "b"])).toBe(true);
  });

  it("requires two selected ids to ungroup", () => {
    const grouped = groupCallouts([callout("a"), callout("b")], ["a", "b"]);
    expect(canUngroupIds(grouped, ["a"])).toBe(false);
    expect(canUngroupIds(grouped, ["a", "b"])).toBe(true);
    expect(canUngroupIds([callout("a"), callout("b")], ["a", "b"])).toBe(false);
  });
});
