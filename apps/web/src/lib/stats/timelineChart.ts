import type { Side } from "@/lib/replay/replayTypes";

/** A little air above the highest point so a line does not sit on the frame. */
const AXIS_HEADROOM = 1.08;

/** HS% and KAST already live on a 0–100 scale. */
const PERCENT_AXIS_CAP = 100;

export const TIMELINE_LAYOUT = {
  width: 960,
  height: 280,
  padLeft: 46,
  padRight: 28,
  padTop: 22,
  padBottom: 28,
} as const;

export type TimelineLayout = typeof TIMELINE_LAYOUT;

export interface PlotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimelinePoint {
  x: number;
  y: number;
}

export interface CurveSegment {
  from: TimelinePoint;
  c1: TimelinePoint;
  c2: TimelinePoint;
  to: TimelinePoint;
}

export interface AxisScale {
  max: number;
  ticks: number[];
}

export function plotRect(layout: TimelineLayout = TIMELINE_LAYOUT): PlotRect {
  return {
    x: layout.padLeft,
    y: layout.padTop,
    width: layout.width - layout.padLeft - layout.padRight,
    height: layout.height - layout.padTop - layout.padBottom,
  };
}

export function axisScale(peak: number): AxisScale {
  return scaleTo(peak <= 0 ? 1 : peak * AXIS_HEADROOM);
}

/** Lock a percent stat to 0–100 unless a point actually exceeds it. */
export function percentAxis(peak: number): AxisScale {
  if (peak <= PERCENT_AXIS_CAP) return scaleTo(PERCENT_AXIS_CAP);
  return axisScale(peak);
}

export function roundX(index: number, count: number, plot: PlotRect): number {
  if (count <= 1) return plot.x + plot.width / 2;
  const column = plot.width / count;
  return plot.x + (index + 0.5) * column;
}

export function valueToY(value: number, max: number, plot: PlotRect): number {
  const span = max <= 0 ? 1 : max;
  const t = Math.min(Math.max(value, 0), span) / span;
  return plot.y + plot.height * (1 - t);
}

/** CSS pixels. Labels sit outside the stretched viewBox, so this size does not follow the chart width. */
export const AXIS_LABEL_PX = 10;

/** Room a horizontal "R42" needs. A tighter column turns the label upright instead of shrinking it. */
export const ROUND_LABEL_SLOT_PX = 28;

export type RoundLabelOrientation = "horizontal" | "vertical";

/**
 * Horizontal while each round has `slotPx` of the plot. Otherwise the label
 * rotates, still at the same font size, and every round stays on the axis.
 */
export function roundLabelOrientation(
  count: number,
  plotWidthPx: number,
  slotPx: number,
): RoundLabelOrientation {
  if (count <= 1 || plotWidthPx <= 0 || slotPx <= 0) return "horizontal";
  const column = plotWidthPx / count;
  return column >= slotPx ? "horizontal" : "vertical";
}

export function nearestRoundIndex(x: number, count: number, plot: PlotRect): number {
  if (count <= 0) return -1;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < count; i++) {
    const dist = Math.abs(roundX(i, count, plot) - x);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }
  return best;
}

export interface TimelineRoundPlayer {
  player: number;
  side: Side;
}

/** One plotted round, with only the players who were actually in it. */
export interface TimelineRoundRoster {
  number: number;
  players: readonly TimelineRoundPlayer[];
}

/**
 * Round numbers after which an economy block ends.
 * A swap counts only when the same player is present in both rounds and changed
 * side. Someone who was absent, including a late join, does not invent a side.
 * Overtime also resets at the start of each period: regulation is twice the
 * first swap, and the next swap is only the middle of that overtime, so a full
 * overtime is twice the gap. Nothing is drawn after the last plotted round.
 */
export function economyBreakAfter(rounds: readonly TimelineRoundRoster[]): number[] {
  if (rounds.length < 2) return [];
  const swaps: number[] = [];
  for (let i = 1; i < rounds.length; i++) {
    const previous = rounds[i - 1];
    const current = rounds[i];
    if (!previous || !current || !rosterSwapped(previous.players, current.players)) continue;
    swaps.push(previous.number);
  }
  const marks = new Set(swaps);
  const first = swaps[0];
  const last = rounds[rounds.length - 1]?.number;
  if (first != null && last != null) {
    const regulation = first * 2;
    const middle = swaps.find((round) => round > regulation);
    if (middle != null) {
      const overtimeHalf = middle - regulation;
      if (overtimeHalf > 0) {
        const overtimeLength = overtimeHalf * 2;
        for (let boundary = regulation; boundary < last; boundary += overtimeLength) {
          marks.add(boundary);
        }
      }
    }
  }
  const lines: number[] = [];
  for (let i = 0; i < rounds.length - 1; i++) {
    const left = rounds[i];
    const right = rounds[i + 1];
    if (!left || !right) continue;
    for (const boundary of marks) {
      if (boundary >= left.number && boundary < right.number) {
        lines.push(left.number);
        break;
      }
    }
  }
  return lines;
}

function rosterSwapped(
  previous: readonly TimelineRoundPlayer[],
  current: readonly TimelineRoundPlayer[],
): boolean {
  const before = new Map(previous.map((row) => [row.player, row.side]));
  for (const row of current) {
    const side = before.get(row.player);
    if (side != null && side !== row.side) return true;
  }
  return false;
}

/** Fritsch–Carlson monotone cubic. The curve stays between each segment's endpoints. */
export function smoothLineSegments(points: readonly TimelinePoint[]): CurveSegment[] {
  const n = points.length;
  if (n < 2) return [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    if (!from || !to) continue;
    const dx = to.x - from.x;
    slopes.push(dx === 0 ? 0 : (to.y - from.y) / dx);
  }
  const tangent = new Array<number>(n).fill(0);
  tangent[0] = slopes[0] ?? 0;
  tangent[n - 1] = slopes[n - 2] ?? 0;
  for (let i = 1; i < n - 1; i++) {
    const left = slopes[i - 1] ?? 0;
    const right = slopes[i] ?? 0;
    tangent[i] = left * right <= 0 ? 0 : (left + right) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    const slope = slopes[i] ?? 0;
    if (Math.abs(slope) < 1e-6) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = (tangent[i] ?? 0) / slope;
    const b = (tangent[i + 1] ?? 0) / slope;
    const hypot = Math.hypot(a, b);
    if (hypot > 3) {
      const tau = 3 / hypot;
      tangent[i] = tau * a * slope;
      tangent[i + 1] = tau * b * slope;
    }
  }
  const segments: CurveSegment[] = [];
  for (let i = 0; i < n - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    if (!from || !to) continue;
    const dx = to.x - from.x;
    segments.push({
      from,
      c1: { x: from.x + dx / 3, y: from.y + ((tangent[i] ?? 0) * dx) / 3 },
      c2: { x: to.x - dx / 3, y: to.y - ((tangent[i + 1] ?? 0) * dx) / 3 },
      to,
    });
  }
  return segments;
}

export function smoothLinePath(points: readonly TimelinePoint[]): string {
  if (points.length === 0) return "";
  const first = points[0];
  if (!first) return "";
  if (points.length === 1) return `M ${fmt(first.x)} ${fmt(first.y)}`;
  const segments = smoothLineSegments(points);
  let path = `M ${fmt(first.x)} ${fmt(first.y)}`;
  for (const segment of segments) {
    path += ` C ${fmt(segment.c1.x)} ${fmt(segment.c1.y)}, ${fmt(segment.c2.x)} ${fmt(segment.c2.y)}, ${fmt(segment.to.x)} ${fmt(segment.to.y)}`;
  }
  return path;
}

function scaleTo(target: number): AxisScale {
  const rough = target / 4;
  const exponent = Math.floor(Math.log10(Math.max(rough, 1e-6)));
  const magnitude = 10 ** exponent;
  const fraction = rough / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2.5 ? 2 : fraction <= 5 ? 5 : 10;
  const step = nice * magnitude;
  const max = Math.max(step, Math.ceil((target - 1e-9) / step) * step);
  const count = Math.round(max / step);
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(Math.round(i * step * 1000) / 1000);
  }
  return { max, ticks };
}

function fmt(value: number): string {
  return value.toFixed(2);
}
