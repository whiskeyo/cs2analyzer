import { describe, expect, it } from "vitest";
import {
  WIN_REASON_BOMB,
  WIN_REASON_CT_ELIM,
  WIN_REASON_CT_SURRENDER,
  WIN_REASON_DEFUSE,
  WIN_REASON_DRAW,
  WIN_REASON_T_ELIM,
  WIN_REASON_T_SURRENDER,
  WIN_REASON_TIME,
} from "@/lib/shared/constants";
import {
  formatClock,
  prettyMap,
  prettyWeapon,
  refineHurtWeapon,
  weaponHeadshotLabel,
  weaponIconSrc,
  weaponKey,
  winReasonLabel,
  WEAPON_BY_ID,
} from "./weapons";

describe("prettyWeapon", () => {
  it("maps known weapons and strips weapon_ prefix", () => {
    expect(prettyWeapon("weapon_ak47")).toBe("AK-47");
    expect(prettyWeapon("m4a1_silencer")).toBe("M4A1-S");
    expect(prettyWeapon("weapon_karambit")).toBe("Knife");
    expect(prettyWeapon("bayonet_fade")).toBe("Knife");
  });

  it("falls back to a readable label", () => {
    expect(prettyWeapon("weapon_custom_gun")).toBe("custom gun");
  });
});

describe("weaponHeadshotLabel", () => {
  it("shows percent for guns and an em dash for grenades", () => {
    expect(weaponHeadshotLabel("ak47", 4, 2)).toBe("50%");
    expect(weaponHeadshotLabel("hegrenade", 1, 0)).toBe("—");
    expect(weaponHeadshotLabel("weapon_molotov", 1, 0)).toBe("—");
    expect(weaponHeadshotLabel("inferno", 1, 0)).toBe("—");
    expect(weaponHeadshotLabel("ak47", 0, 0)).toBe("—");
  });
});

describe("refineHurtWeapon", () => {
  const m4a4 = WEAPON_BY_ID.indexOf("m4a1");
  const m4a1s = WEAPON_BY_ID.indexOf("m4a1_silencer");
  const usp = WEAPON_BY_ID.indexOf("usp_silencer");
  const p2000 = WEAPON_BY_ID.indexOf("hkp2000");

  it("maps generic hurt names to the silenced item in hand", () => {
    expect(refineHurtWeapon("m4a1", m4a1s)).toBe("m4a1_silencer");
    expect(refineHurtWeapon("hkp2000", usp)).toBe("usp_silencer");
    expect(refineHurtWeapon("weapon_hkp2000", usp)).toBe("usp_silencer");
  });

  it("leaves the unsilenced class name when that gun is held", () => {
    expect(refineHurtWeapon("m4a1", m4a4)).toBe("m4a1");
    expect(refineHurtWeapon("hkp2000", p2000)).toBe("hkp2000");
  });

  it("uses primary / secondary when active is not the rifle or pistol", () => {
    const knife = WEAPON_BY_ID.indexOf("knife");
    expect(refineHurtWeapon("m4a1", knife, m4a1s)).toBe("m4a1_silencer");
    expect(refineHurtWeapon("hkp2000", knife, 0, usp)).toBe("usp_silencer");
  });
});

describe("weaponKey", () => {
  it("normalizes aliases and rejects non-weapons", () => {
    expect(weaponKey("m4a4")).toBe("m4a1");
    expect(weaponKey("inferno")).toBe("molotov");
    expect(weaponKey("incgrenade")).toBe("incgrenade");
    expect(weaponIconSrc("incgrenade")).toContain("/weapons/incgrenade.svg");
    expect(weaponKey("world")).toBeNull();
    expect(weaponKey("trigger_hurt")).toBeNull();
    expect(weaponKey("butterfly_knife")).toBe("knife");
  });
});

describe("weaponIconSrc", () => {
  it("resolves by name and numeric id", () => {
    expect(weaponIconSrc("ak47")).toContain("/weapons/ak47.svg");
    expect(weaponIconSrc(23)).toContain("/weapons/ak47.svg");
    expect(weaponIconSrc("unknown_gun")).toBeNull();
    expect(weaponIconSrc(0)).toBeNull();
  });
});

describe("formatClock", () => {
  it("formats seconds as m:ss and clamps negatives", () => {
    expect(formatClock(125)).toBe("2:05");
    expect(formatClock(-3)).toBe("0:00");
  });
});

describe("prettyMap", () => {
  it("labels known maps and strips prefixes", () => {
    expect(prettyMap("de_mirage")).toBe("Mirage");
    expect(prettyMap("workshop/de_dust2")).toBe("Dust II");
    expect(prettyMap("de_custom_map")).toBe("custom map");
  });
});

describe("winReasonLabel", () => {
  it("maps known round-win codes", () => {
    expect(winReasonLabel(WIN_REASON_BOMB)).toBe("Bomb");
    expect(winReasonLabel(WIN_REASON_DEFUSE)).toBe("Defuse");
    expect(winReasonLabel(WIN_REASON_CT_ELIM)).toBe("CT elim");
    expect(winReasonLabel(WIN_REASON_T_ELIM)).toBe("T elim");
    expect(winReasonLabel(WIN_REASON_DRAW)).toBe("Draw");
    expect(winReasonLabel(WIN_REASON_TIME)).toBe("Time");
    expect(winReasonLabel(WIN_REASON_T_SURRENDER)).toBe("T surrender");
    expect(winReasonLabel(WIN_REASON_CT_SURRENDER)).toBe("CT surrender");
    expect(winReasonLabel(0)).toBe("—");
    expect(winReasonLabel(99)).toBe("#99");
  });
});
