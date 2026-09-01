import { describe, expect, it, vi } from "vitest";
import { calibrationFor, floorForZ, loadCalibrations, radarFloor, worldOnRadar } from "./maps";
import type { MapCalibration } from "@/lib/replay/replayTypes";

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
    expect(radarFloor(nuke, players, 0, "upper")).toBe("default");
    expect(radarFloor(nuke, players, 1, "lower")).toBe("lower");
    expect(radarFloor(nuke, players, null, "upper")).toBe("default");
    expect(radarFloor(nuke, players, null, "lower")).toBe("lower");
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

describe("loadCalibrations", () => {
  it("fetches once and caches map calibrations", async () => {
    const payload = { de_test: nuke };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    vi.stubGlobal("fetch", fetchMock);
    const first = await loadCalibrations();
    const second = await loadCalibrations();
    expect(first).toEqual(payload);
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

describe("calibrationFor", () => {
  it("normalizes workshop and scrimmage map paths", () => {
    const maps = { de_mirage: nuke };
    expect(calibrationFor(maps, "workshop/de_mirage")).toBe(nuke);
    expect(calibrationFor(maps, "de_mirage_scrimmagemap")).toBe(nuke);
    expect(calibrationFor(maps, "de_unknown")).toBeUndefined();
  });
});

describe("worldOnRadar", () => {
  it("accepts positions inside the overview margin", () => {
    expect(worldOnRadar(nuke, 0, 0)).toBe(true);
    expect(worldOnRadar(undefined, 0, 0)).toBe(true);
  });

  it("rejects positions far outside the overview", () => {
    expect(worldOnRadar(nuke, 1_000_000, 1_000_000)).toBe(false);
  });
});
