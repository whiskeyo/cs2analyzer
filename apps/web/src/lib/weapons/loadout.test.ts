import { describe, expect, it } from "vitest";
import { GEAR_INC, GEAR_MOLLY } from "@/lib/replay/replayTypes";
import type { SampledPlayer } from "@/lib/replay/sample";
import { gearItems } from "./loadout";

function player(gear: number): SampledPlayer {
  return {
    index: 0,
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    health: 100,
    armor: 0,
    present: true,
    alive: true,
    ducked: false,
    scoped: false,
    ct: true,
    money: 0,
    equip: 0,
    gear,
    primary: 0,
    secondary: 0,
  };
}

describe("gearItems", () => {
  it("shows a molotov icon, not an incendiary, for GEAR_MOLLY", () => {
    const icons = gearItems(player(GEAR_MOLLY));
    expect(icons).toEqual([{ name: "molotov", title: "Molly" }]);
  });

  it("shows the incendiary icon for GEAR_INC", () => {
    const icons = gearItems(player(GEAR_INC));
    expect(icons).toEqual([{ name: "incgrenade", title: "Incendiary" }]);
  });
});
