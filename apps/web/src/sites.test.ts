import { describe, expect, it } from "vitest";
import { nearestBombsite, siteCallout } from "./sites";

describe("siteCallout", () => {
  it("labels Dust2 bombsites and mid", () => {
    expect(siteCallout("de_dust2", 1128, 2518)).toBe("A");
    expect(siteCallout("de_dust2", -1530, 2698)).toBe("B");
    expect(siteCallout("de_dust2", -223, 986)).toBe("Mid");
  });

  it("uses Z on Nuke so upper is A and lower is B", () => {
    expect(siteCallout("de_nuke", 709, -554, 0)).toBe("A");
    expect(siteCallout("de_nuke", 709, -554, -800)).toBe("B");
  });

  it("strips workshop prefixes", () => {
    expect(siteCallout("workshop/123/de_mirage", 400, -400)).toBeTruthy();
  });

  it("returns null for an unknown map", () => {
    expect(siteCallout("de_cbble", 0, 0)).toBeNull();
  });

  it("labels Anubis A west of CT, not the map origin", () => {
    expect(siteCallout("de_anubis", -658, 1835)).toBe("A");
    expect(siteCallout("de_anubis", -16, -307)).toBe("B");
    expect(siteCallout("de_anubis", -337, 764)).toBe("Mid");
    expect(nearestBombsite("de_anubis", -658, 1835)).toBe("A");
    expect(nearestBombsite("de_anubis", 0, 0)).toBe("B");
  });
});
