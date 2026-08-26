import { describe, expect, it } from "vitest";
import { emptyLayout, parseMapLayout, slugId, uniqueId } from "./layout";

const valid = {
  schema: 1,
  map: "de_mirage",
  callouts: [
    {
      id: "palace",
      name: "Palace",
      floor: "default",
      polygon: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
      ],
    },
  ],
};

describe("parseMapLayout", () => {
  it("keeps valid callouts and drops broken rows", () => {
    const parsed = parseMapLayout({
      ...valid,
      callouts: [...valid.callouts, { id: "x" }, valid.callouts[0]],
    });
    expect(parsed?.callouts.map((c) => c.id)).toEqual(["palace"]);
  });

  it("rejects the wrong map when expectedMap is set", () => {
    expect(parseMapLayout(valid, "de_dust2")).toBeNull();
    expect(parseMapLayout(valid, "de_mirage")?.map).toBe("de_mirage");
  });

  it("rejects a missing schema", () => {
    expect(parseMapLayout({ ...valid, schema: 2 })).toBeNull();
    expect(parseMapLayout(emptyLayout("de_nuke"))?.callouts).toEqual([]);
  });
});

describe("uniqueId", () => {
  it("slugifies names and suffixes collisions", () => {
    expect(slugId("A Ramp")).toBe("a-ramp");
    expect(uniqueId("palace", ["palace", "palace-2"])).toBe("palace-3");
  });
});
