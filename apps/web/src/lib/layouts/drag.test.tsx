import { describe, expect, it } from "vitest";
import { eventElement, isDragControl, lockCalloutDrag, parseDrag, unlockCalloutDrag } from "./drag";

describe("parseDrag", () => {
  it("reads a list of ids and rejects junk", () => {
    expect(parseDrag('{"ids":["a","b"]}')).toEqual({ ids: ["a", "b"] });
    expect(parseDrag("{")).toBeNull();
    expect(parseDrag('{"ids":[1]}')).toBeNull();
    expect(parseDrag("{}")).toBeNull();
  });
});

describe("eventElement", () => {
  it("unwraps a node to its element", () => {
    const el = document.createElement("div");
    const text = document.createTextNode("x");
    el.append(text);
    expect(eventElement(el)).toBe(el);
    expect(eventElement(text)).toBe(el);
    expect(eventElement(null)).toBeNull();
    expect(isDragControl(null)).toBe(false);
  });
});

describe("lockCalloutDrag", () => {
  it("locks a row so the cluster does not steal the drag", () => {
    const cluster = document.createElement("div");
    cluster.className = "callout-cluster";
    const row = document.createElement("div");
    row.className = "callout-row";
    const input = document.createElement("input");
    const pick = document.createElement("label");
    pick.className = "callout-pick";
    pick.append(input);
    row.append(pick);
    cluster.append(row);
    document.body.append(cluster);

    expect(isDragControl(input)).toBe(true);
    lockCalloutDrag(cluster, input, true);
    expect(cluster.draggable).toBe(false);

    lockCalloutDrag(cluster, row, true);
    expect(cluster.draggable).toBe(false);
    expect(row.draggable).toBe(true);

    unlockCalloutDrag(cluster, true);
    expect(cluster.draggable).toBe(true);
    expect(row.draggable).toBe(true);

    const loose = document.createElement("div");
    lockCalloutDrag(loose, document.createElement("span"), false);
    expect(loose.draggable).toBe(false);
  });
});
