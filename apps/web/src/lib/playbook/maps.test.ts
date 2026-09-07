import { describe, expect, it } from "vitest";
import { pickInitialMap, sortedMapNames } from "./maps";
import { PLAYBOOK_PREFERRED_MAP } from "./types";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";

describe("playbook maps", () => {
  it("sorts map names and prefers mirage when present", () => {
    expect(sortedMapNames({ de_nuke: UNIT_CALIBRATION, de_ancient: UNIT_CALIBRATION })).toEqual([
      "de_ancient",
      "de_nuke",
    ]);
    expect(pickInitialMap(["de_inferno", PLAYBOOK_PREFERRED_MAP])).toBe(PLAYBOOK_PREFERRED_MAP);
    expect(pickInitialMap(["de_inferno", "de_nuke"])).toBe("de_inferno");
    expect(pickInitialMap([])).toBeNull();
  });
});
