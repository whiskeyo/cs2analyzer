import { describe, expect, it } from "vitest";
import { COOL_TEAM, WARM_TEAM, playerMarkColors, teamMarkColor } from "./playerColors";

function channels(hex: string): [number, number, number] {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function hue(hex: string): number {
  const [r, g, b] = channels(hex).map((channel) => channel / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  if (delta === 0) return 0;
  let turn: number;
  if (max === r) turn = ((g - b) / delta) % 6;
  else if (max === g) turn = (b - r) / delta + 2;
  else turn = (r - g) / delta + 4;
  return (turn * 60 + 360) % 360;
}

/** Page background. Marks have to stay readable on it. */
const PAGE_BACKGROUND = "#0b0e12";

function luminance(hex: string): number {
  const linear = channels(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
}

function contrast(hex: string): number {
  const mark = luminance(hex);
  const background = luminance(PAGE_BACKGROUND);
  return (Math.max(mark, background) + 0.05) / (Math.min(mark, background) + 0.05);
}

function distance(a: string, b: string): number {
  const [ar, ag, ab] = channels(a);
  const [br, bg, bb] = channels(b);
  return Math.hypot(ar - br, ag - bg, ab - bb);
}

function roster(countPerSide: number) {
  const players = [];
  for (let i = 0; i < countPerSide; i++) {
    players.push({ index: i, start_side: "T" as const });
    players.push({ index: countPerSide + i, start_side: "CT" as const });
  }
  return players;
}

describe("playerMarkColors", () => {
  it("is deterministic and ignores roster order", () => {
    const players = roster(5);
    const forward = playerMarkColors(players);
    const backward = playerMarkColors([...players].reverse());
    expect(backward).toEqual(forward);
    expect(playerMarkColors(players)).toEqual(forward);
  });

  it("gives the two starting sides different hue families", () => {
    expect(teamMarkColor("T")).toBe(WARM_TEAM);
    expect(teamMarkColor("CT")).toBe(COOL_TEAM);
    const warm = hue(WARM_TEAM);
    const cool = hue(COOL_TEAM);
    const gap = Math.min(Math.abs(warm - cool), 360 - Math.abs(warm - cool));
    expect(gap).toBeGreaterThan(90);

    const colors = playerMarkColors(roster(8));
    for (let i = 0; i < 8; i++) {
      const tHue = hue(colors[i]!);
      const ctHue = hue(colors[8 + i]!);
      expect(tHue < 70 || tHue > 320).toBe(true);
      expect(ctHue).toBeGreaterThan(150);
      expect(ctHue).toBeLessThan(280);
    }
  });

  it("stays bright enough to read on the page background", () => {
    const colors = playerMarkColors(roster(8));
    for (const color of colors) {
      expect(contrast(color), color).toBeGreaterThan(4);
    }
  });

  it("keeps teammates distinct", () => {
    const colors = playerMarkColors(roster(8));
    const teams = [colors.slice(0, 8), colors.slice(8)];
    for (const team of teams) {
      expect(new Set(team).size).toBe(team.length);
      for (let i = 0; i < team.length; i++) {
        for (let j = i + 1; j < team.length; j++) {
          expect(distance(team[i]!, team[j]!), `${team[i]} vs ${team[j]}`).toBeGreaterThan(80);
        }
      }
    }
  });
});
