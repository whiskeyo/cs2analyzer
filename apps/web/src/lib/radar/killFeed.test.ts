import { describe, expect, it } from "vitest";
import { makeKill } from "@/lib/testing/fixtures";
import { environmentDeath } from "./killFeed";

describe("environmentDeath", () => {
  it("uses the bomb icon for a C4 kill even when a player is the attacker", () => {
    expect(environmentDeath(makeKill(1, 0, 1, { weapon: "c4" }))).toBe("bomb");
    expect(environmentDeath(makeKill(1, -1, 0, { weapon: "planted_c4" }))).toBe("bomb");
  });

  it("uses the skull for world, fall, suicide, and trigger hurt", () => {
    expect(environmentDeath(makeKill(1, -1, 0, { weapon: "world" }))).toBe("skull");
    expect(environmentDeath(makeKill(1, 0, 1, { weapon: "fall" }))).toBe("skull");
    expect(environmentDeath(makeKill(1, 0, 0, { weapon: "ak47" }))).toBe("skull");
    expect(environmentDeath(makeKill(1, 0, 1, { weapon: "trigger_hurt" }))).toBe("skull");
  });

  it("keeps a normal gun kill", () => {
    expect(environmentDeath(makeKill(1, 0, 1))).toBeNull();
  });
});
