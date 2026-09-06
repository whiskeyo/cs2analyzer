import { describe, expect, it } from "vitest";
import { GEAR_INC, GEAR_MOLLY } from "@/lib/replay/replayTypes";
import type { SampledPlayer } from "@/lib/replay/sample";
import { gearItems, gearIconHeldClass, heldIconClass, weaponHasMagazine } from "./loadout";

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
    active: 0,
    clip: 0,
    reserve: 0,
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

describe("heldIconClass", () => {
  it("marks the in-hand weapon and stows the rest", () => {
    expect(heldIconClass(23, 23)).toBe("held");
    expect(heldIconClass(23, 1)).toBe("stowed");
    expect(heldIconClass(23, 0)).toBe("");
  });
});

describe("gearIconHeldClass", () => {
  it("matches nade and knife names to weapon ids", () => {
    expect(gearIconHeldClass("knife", 1)).toBe("held");
    expect(gearIconHeldClass("flashbang", 1)).toBe("stowed");
    expect(gearIconHeldClass("helmet", 1)).toBe("stowed");
    expect(gearIconHeldClass("knife", 0)).toBe("");
  });
});

describe("weaponHasMagazine", () => {
  it("is true for guns and Zeus, false for knife and nades", () => {
    expect(weaponHasMagazine(2)).toBe(true);
    expect(weaponHasMagazine(23)).toBe(true);
    expect(weaponHasMagazine(1)).toBe(false);
    expect(weaponHasMagazine(3)).toBe(false);
    expect(weaponHasMagazine(39)).toBe(false);
  });
});
