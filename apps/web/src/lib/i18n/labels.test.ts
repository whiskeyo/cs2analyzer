import { describe, expect, it } from "vitest";
import { WIN_REASON_BOMB, WIN_REASON_TIME } from "@/lib/shared/constants";
import { en } from "./en";
import { pl } from "./pl";
import {
  bombEventLabel,
  floorLabel,
  nadeLabel,
  paletteLabel,
  roundKindLabel,
  windowKindText,
  winReasonText,
} from "./labels";

describe("label switches", () => {
  it("maps known codes and falls unknown values back to English-shaped defaults", () => {
    expect(winReasonText(en, WIN_REASON_BOMB)).toBe("Bomb");
    expect(winReasonText(pl, WIN_REASON_TIME)).toBe("Czas");
    expect(winReasonText(en, 0)).toBe("—");
    expect(winReasonText(en, 99)).toBe("#99");
    expect(nadeLabel(en, "smoke")).toBe("Smoke");
    expect(nadeLabel(en, "incendiary")).toBe("Incendiary");
    expect(nadeLabel(en, "molotov")).toBe("Molly");
    expect(bombEventLabel(en, "begin_plant")).toBe("Planting");
    expect(bombEventLabel(pl, "exploded")).toBe("Wybuch");
    expect(windowKindText(en, null)).toBe("Whole round");
    expect(windowKindText(pl, { start: 10, end: 10 })).toBe("Pin");
    expect(paletteLabel(en, "night")).toBe("Night");
    expect(paletteLabel(en, "unknown")).toBe("Neon");
    expect(floorLabel(en, "lower")).toBe("Lower");
    expect(floorLabel(en, "auto")).toBe("Auto");
    expect(roundKindLabel(pl, "eco")).toBe("Eco");
    expect(roundKindLabel(en, "full")).toBe("Full");
  });
});
