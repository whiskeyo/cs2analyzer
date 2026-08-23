import { describe, expect, it } from "vitest";
import { floorForZ, radarFloor } from "./maps";
import type { MapCalibration } from "./types";

const nuke: MapCalibration = {
  pos_x: -3453,
  pos_y: 2887,
  scale: 7,
  radar: "de_nuke.png",
  lower_radar: "de_nuke_lower.png",
  floors: [
    { name: "default", z_min: -495, z_max: 10000 },
    { name: "lower", z_min: -10000, z_max: -495 },
  ],
};

function player(index: number, z: number, alive = true) {
  return { index, z, present: true, alive };
}

describe("floorForZ", () => {
  it("treats Nuke B / secret as lower (z < -495)", () => {
    expect(floorForZ(nuke, -800)).toBe("lower");
    expect(floorForZ(nuke, -495)).toBe("default");
    expect(floorForZ(nuke, 0)).toBe("default");
  });
});

describe("radarFloor", () => {
  it("follows the selected player's floor even when they are the only one downstairs", () => {
    const players = [player(0, -800), player(1, 0), player(2, 40), player(3, -100), player(4, 20)];
    expect(radarFloor(nuke, players, null)).toBe("default");
    expect(radarFloor(nuke, players, 0)).toBe("lower");
    expect(radarFloor(nuke, players, 1)).toBe("default");
  });

  it("uses majority of alive players when nobody is selected", () => {
    const players = [
      player(0, -800),
      player(1, -700),
      player(2, -750),
      player(3, 0),
      player(4, 20),
    ];
    expect(radarFloor(nuke, players, null)).toBe("lower");
  });
});
