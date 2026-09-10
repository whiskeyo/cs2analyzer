/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import {
  eventElement,
  refsForDrag,
  isDragControl,
  lockNoteDrag,
  parseDrag,
  unlockNoteDrag,
} from "./drag";

describe("refsForDrag", () => {
  it("drags the whole round selection when the row is selected", () => {
    const selected = [
      { round: 1, ref: { kind: "loose" as const, index: 0 } },
      { round: 1, ref: { kind: "loose" as const, index: 1 } },
      { round: 2, ref: { kind: "loose" as const, index: 0 } },
    ];
    expect(refsForDrag({ kind: "loose", index: 0 }, selected, 1)).toEqual([
      { kind: "loose", index: 0 },
      { kind: "loose", index: 1 },
    ]);
    expect(refsForDrag({ kind: "loose", index: 0 }, selected, 2)).toEqual([
      { kind: "loose", index: 0 },
    ]);
  });
});

describe("parseDrag", () => {
  it("round-trips a drag payload", () => {
    const payload = { round: 3, refs: [{ kind: "loose", index: 1 }] };
    expect(parseDrag(JSON.stringify(payload))).toEqual(payload);
  });

  it("rejects malformed payloads", () => {
    expect(parseDrag("not json")).toBeNull();
    expect(parseDrag(JSON.stringify({ round: "1", refs: [] }))).toBeNull();
    expect(parseDrag(JSON.stringify({ round: 1, indexes: [0] }))).toBeNull();
  });
});

describe("eventElement", () => {
  it("returns an element target as-is", () => {
    const el = document.createElement("div");
    expect(eventElement(el)).toBe(el);
  });

  it("returns the parent element for a text node", () => {
    const parent = document.createElement("span");
    const text = document.createTextNode("note");
    parent.appendChild(text);
    expect(eventElement(text)).toBe(parent);
  });

  it("returns null for non-node targets", () => {
    expect(eventElement(null)).toBeNull();
  });
});

describe("isDragControl", () => {
  it("detects interactive note controls", () => {
    const input = document.createElement("input");
    expect(isDragControl(input)).toBe(true);

    const textarea = document.createElement("textarea");
    expect(isDragControl(textarea)).toBe(true);

    const label = document.createElement("label");
    label.className = "note-pick";
    expect(isDragControl(label)).toBe(true);

    const io = document.createElement("button");
    io.className = "note-io";
    expect(isDragControl(io)).toBe(true);
  });

  it("returns false for plain rows and null targets", () => {
    const row = document.createElement("div");
    row.className = "note-row";
    expect(isDragControl(row)).toBe(false);
    expect(isDragControl(null)).toBe(false);
  });
});

describe("lockNoteDrag / unlockNoteDrag", () => {
  function clusterWithRows(folder = false) {
    const cluster = document.createElement("div");
    cluster.className = "note-cluster";
    cluster.draggable = folder;
    const row = document.createElement("div");
    row.className = "note-row";
    row.draggable = true;
    cluster.appendChild(row);
    return { cluster, row };
  }

  it("enables only the grabbed row inside the cluster", () => {
    const { cluster, row } = clusterWithRows();
    lockNoteDrag(cluster, row, false);
    expect(cluster.draggable).toBe(false);
    expect(row.draggable).toBe(true);
    unlockNoteDrag(cluster, false);
    expect(cluster.draggable).toBe(false);
    expect(row.draggable).toBe(true);
  });

  it("makes the folder draggable when grabbing outside a row", () => {
    const { cluster } = clusterWithRows(true);
    const grip = document.createElement("span");
    cluster.appendChild(grip);
    lockNoteDrag(cluster, grip, true);
    expect(cluster.draggable).toBe(true);
    unlockNoteDrag(cluster, true);
    expect(cluster.draggable).toBe(true);
  });

  it("ignores drag controls", () => {
    const { cluster, row } = clusterWithRows(true);
    const input = document.createElement("input");
    row.appendChild(input);
    lockNoteDrag(cluster, input, true);
    expect(cluster.draggable).toBe(true);
    expect(row.draggable).toBe(true);
  });
});
