import { describe, expect, it } from "vitest";
import { PLAYER_TINTS, tintForName, uniqueTint } from "./palettes";

function hexRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function rgbDistance(a: string, b: string): number {
  const [ar, ag, ab] = hexRgb(a);
  const [br, bg, bb] = hexRgb(b);
  return Math.hypot(ar - br, ag - bg, ab - bb);
}

describe("PLAYER_TINTS", () => {
  it("starts with red, green, yellow, blue, brown and keeps later hues distinct", () => {
    expect(PLAYER_TINTS.slice(0, 5)).toEqual([
      "#d62728",
      "#2ca02c",
      "#ffe83a",
      "#1f77b4",
      "#8c564b",
    ]);
    expect(new Set(PLAYER_TINTS).size).toBe(PLAYER_TINTS.length);
    expect(PLAYER_TINTS.length).toBeGreaterThanOrEqual(8);
    for (let i = 0; i < PLAYER_TINTS.length; i++) {
      for (let j = i + 1; j < PLAYER_TINTS.length; j++) {
        expect(rgbDistance(PLAYER_TINTS[i]!, PLAYER_TINTS[j]!)).toBeGreaterThan(70);
      }
    }
  });
});

describe("uniqueTint / tintForName", () => {
  it("assigns each new key the next palette colour", () => {
    const assigned = new Map<string, string>();
    expect(uniqueTint("1", assigned)).toBe(PLAYER_TINTS[0]);
    expect(uniqueTint("2", assigned)).toBe(PLAYER_TINTS[1]);
    expect(uniqueTint("1", assigned)).toBe(PLAYER_TINTS[0]);
    expect(tintForName("Donk", assigned)).toBe(PLAYER_TINTS[2]);
    expect(tintForName(" donk ", assigned)).toBe(PLAYER_TINTS[2]);
    expect(tintForName("m0NESY", assigned)).not.toBe(tintForName("donk", assigned));
  });
});
