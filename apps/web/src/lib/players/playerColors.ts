import type { Side } from "@/lib/replay/replayTypes";

/**
 * Starting T is the warm family. Starting CT is the cool family.
 * Shades stay inside that family and are far enough apart to tell apart on a dark chart.
 */
const WARM_MARKS = [
  "#e23d32",
  "#ff9a00",
  "#f8a058",
  "#ff4f9a",
  "#c6e000",
  "#fff1a8",
  "#f8f848",
  "#ff9ed0",
] as const;

const COOL_MARKS = [
  "#58b0f8",
  "#14b4c4",
  "#6d5cff",
  "#d6f4ff",
  "#00f8f8",
  "#b388ff",
  "#0a8f6a",
  "#48f8c8",
] as const;

/** One hue for the whole starting side, used for round-win marks. */
export const WARM_TEAM = "#e8883a";
export const COOL_TEAM = "#3d8fd6";

export function teamMarkColor(side: Side): string {
  return side === "CT" ? COOL_TEAM : WARM_TEAM;
}

/**
 * One colour per roster slot. Indexed by `player.index`, stable for the demo:
 * slot order within the starting side picks the shade.
 */
export function playerMarkColors(
  players: readonly { index: number; start_side: Side }[],
): string[] {
  let count = 0;
  for (const player of players) count = Math.max(count, player.index + 1);
  const colors = new Array<string>(count).fill(WARM_MARKS[0]);
  const ct: number[] = [];
  const t: number[] = [];
  for (const player of players) {
    (player.start_side === "CT" ? ct : t).push(player.index);
  }
  ct.sort((a, b) => a - b);
  t.sort((a, b) => a - b);
  t.forEach((index, order) => {
    colors[index] = WARM_MARKS[order % WARM_MARKS.length] ?? WARM_MARKS[0];
  });
  ct.forEach((index, order) => {
    colors[index] = COOL_MARKS[order % COOL_MARKS.length] ?? COOL_MARKS[0];
  });
  return colors;
}
