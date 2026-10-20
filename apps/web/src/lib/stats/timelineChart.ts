import { getConvar } from "@/lib/match/convars";
import type { MatchInfo, Side } from "@/lib/replay/replayTypes";

/** Regulation and an overtime period are two side blocks (MR12 is 12+12, MR3 OT is 3+3). */
const SIDE_BLOCKS_PER_PERIOD = 2;

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

export type TimelineLayout = {
  [Key in keyof typeof TIMELINE_LAYOUT]: number;
};

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

/** A hairline is never thinner than one device pixel. */
const MIN_DEVICE_PIXEL_STROKE = 1;

function finiteDevicePixelRatio(dpr: number): number {
  return dpr > 0 && Number.isFinite(dpr) ? dpr : 1;
}

/** `window.devicePixelRatio`, or 1 when the browser has not reported one. */
export function readDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  return finiteDevicePixelRatio(window.devicePixelRatio);
}

/**
 * Device pixels a grid, seam, or hover stroke covers. Floor keeps 1.25 and 1.5
 * at one device pixel and 2 at two. The same width on both axes: `crispEdges`
 * otherwise rounds a fractional device-pixel stroke differently for horizontal
 * and vertical rules.
 */
export function devicePixelStroke(dpr: number): number {
  return Math.max(MIN_DEVICE_PIXEL_STROKE, Math.floor(finiteDevicePixelRatio(dpr)));
}

/** CSS `stroke-width` that covers exactly `devicePixelStroke(dpr)` device pixels. */
export function axisStrokeWidth(dpr: number): number {
  return devicePixelStroke(dpr) / finiteDevicePixelRatio(dpr);
}

/**
 * Local CSS position so `overlayOriginCss + local` is a device-pixel center
 * (odd stroke) or a device-pixel boundary (even stroke).
 *
 * The overlay's `getBoundingClientRect()` origin is what the rasterizer adds.
 * Snapping in local SVG units and then shifting the element does not: the used
 * CSS `left` is not that device-pixel boundary, and one rule falls on a pixel
 * edge where `crispEdges` draws nothing.
 */
export function snapOverlayAxis(localCss: number, overlayOriginCss: number, dpr: number): number {
  const ratio = finiteDevicePixelRatio(dpr);
  if (!Number.isFinite(localCss)) return 0;
  const origin = Number.isFinite(overlayOriginCss) ? overlayOriginCss : 0;
  const screenDevice = (origin + localCss) * ratio;
  const centered = devicePixelStroke(ratio) % 2 === 1;
  const snapped = centered ? Math.round(screenDevice - 0.5) + 0.5 : Math.round(screenDevice);
  return snapped / ratio - origin;
}

/** Snap a CSS position when the overlay origin is already on a device pixel. */
export function snapDevicePixel(px: number, dpr: number): number {
  return snapOverlayAxis(px, 0, dpr);
}

/**
 * Map a viewBox coordinate into an overlay whose viewBox is the element's CSS
 * pixel size (one user unit = one CSS pixel, no stretch), then snap it so the
 * stroke lands on whole device pixels of the screen. `originCss` is the
 * overlay edge (`getBoundingClientRect().left` or `.top`).
 */
export function axisPixel(
  user: number,
  viewSpan: number,
  cssSpan: number,
  dpr: number = 1,
  originCss: number = 0,
): number {
  if (!(cssSpan > 0) || !(viewSpan > 0)) return user;
  return snapOverlayAxis((user / viewSpan) * cssSpan, originCss, dpr);
}

/** First device pixel covered by a stroke centered at `screenCss`. */
export function strokeDeviceColumn(screenCss: number, dpr: number): number {
  const ratio = finiteDevicePixelRatio(dpr);
  const start = screenCss * ratio - devicePixelStroke(ratio) / 2;
  return Math.floor(start + 1e-9);
}

/**
 * Call `onChange` when zoom or a monitor change moves `devicePixelRatio`.
 * The media query only matches the current ratio, so each change re-registers.
 */
export function watchDevicePixelRatio(onChange: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => undefined;
  }
  let query: MediaQueryList | undefined;
  let listener: (() => void) | undefined;
  const listen = () => {
    if (query && listener) query.removeEventListener("change", listener);
    query = window.matchMedia(`(resolution: ${readDevicePixelRatio()}dppx)`);
    listener = () => {
      if (query && listener) query.removeEventListener("change", listener);
      onChange();
      listen();
    };
    query.addEventListener("change", listener);
  };
  listen();
  return () => {
    if (query && listener) query.removeEventListener("change", listener);
  };
}

/** CSS pixels. Labels sit outside the stretched viewBox, so this size does not follow the chart width. */
export const AXIS_LABEL_PX = 10;

/** CSS pixels between the 0 baseline and the top of a round label, before device alignment. */
export const ROUND_LABEL_GAP_PX = 5;

/** CSS pixels kept under the baseline at DPR 1: the gap plus one line of round labels. */
export const ROUND_LABEL_BAND_PX = ROUND_LABEL_GAP_PX + AXIS_LABEL_PX;

/** CSS pixels of air above the centered top tick label. */
export const AXIS_TOP_GAP_PX = 4;

/** Plot edge to the top tick at DPR 1: half the label, then the gap above it. */
export const AXIS_TOP_PAD_PX = AXIS_LABEL_PX / 2 + AXIS_TOP_GAP_PX;

/**
 * Top inset in CSS px, rounded to a whole device pixel.
 * The same DPR always yields the same inset; chart height does not enter.
 */
export function axisTopPadPx(dpr: number = 1): number {
  const ratio = finiteDevicePixelRatio(dpr);
  return Math.round(AXIS_TOP_PAD_PX * ratio) / ratio;
}

/**
 * Gap under the baseline in CSS px, rounded to a whole device pixel.
 * The same DPR always yields the same gap; width and sidebar do not enter.
 */
export function roundLabelGapPx(dpr: number = 1): number {
  const ratio = finiteDevicePixelRatio(dpr);
  return Math.round(ROUND_LABEL_GAP_PX * ratio) / ratio;
}

/**
 * Inline size of a turned round label at `AXIS_LABEL_PX` ("R42" in the UI font).
 * The bottom band uses this so the turned row still clears the plot.
 */
export const ROUND_LABEL_TURNED_PX = 18;

/** CSS pixels reserved under the baseline for the current label orientation. */
export function roundLabelBand(orientation: RoundLabelOrientation, dpr: number = 1): number {
  const gap = roundLabelGapPx(dpr);
  if (orientation === "vertical") return gap + ROUND_LABEL_TURNED_PX;
  return gap + AXIS_LABEL_PX;
}

/** `top` in CSS px: the snapped baseline, then `roundLabelGapPx` device-aligned pixels. */
export function roundLabelTopPx(baselineCss: number, dpr: number = 1): number {
  return baselineCss + roundLabelGapPx(dpr);
}

/**
 * Fit viewBox padding to CSS pixels at any chart height.
 * The top inset stays `topPadPx` (half a tick label, plus a hair) so the top
 * tick is not clipped and does not grow into an empty band. The bottom band
 * stays `bandPx` for the round labels. Width and device pixel ratio do not enter.
 */
export function timelineLayoutForHeight(
  cssHeight: number,
  layout: TimelineLayout = TIMELINE_LAYOUT,
  bandPx: number = ROUND_LABEL_BAND_PX,
  topPadPx: number = AXIS_TOP_PAD_PX,
): TimelineLayout {
  if (!(cssHeight > 0)) return layout;
  const topPx = Math.min(Math.max(topPadPx, 0), cssHeight);
  let padTop = (topPx / cssHeight) * layout.height;
  const band = Math.min(Math.max(bandPx, 0), Math.max(cssHeight - topPx, 0));
  let padBottom = (band / cssHeight) * layout.height;
  const limit = layout.height - 1;
  if (padTop + padBottom > limit) {
    const scale = limit / (padTop + padBottom);
    padTop *= scale;
    padBottom *= scale;
  }
  return { ...layout, padTop, padBottom };
}

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

/** Present players on each plotted column, in the shape half and OT lines read. */
export function timelineColumnRosters(
  columns: readonly {
    number: number;
    rows: readonly { present: boolean; player: number; side: Side }[];
  }[],
): TimelineRoundRoster[] {
  return columns.map((column) => ({
    number: column.number,
    players: column.rows
      .filter((row) => row.present)
      .map((row) => ({ player: row.player, side: row.side })),
  }));
}

/**
 * Round numbers after which a half or overtime block ends.
 * A swap counts only when the same player is present in both rounds and changed
 * side. Someone who was absent, including a late join, does not invent a side.
 * Regulation half is `mp_maxrounds / 2`, plus an actual side swap during
 * regulation. Overtime keeps the previous side until that period's halfway
 * swap, so period boundaries are `mp_maxrounds + k * mp_overtime_maxrounds`.
 * The half line in a period is the side swap inside it, or the midpoint when
 * the rounds show no swap. Nothing is drawn after the last plotted round.
 */
export function economyBreakAfter(
  rounds: readonly TimelineRoundRoster[],
  matchInfo?: MatchInfo,
): number[] {
  if (rounds.length < 2) return [];
  const swaps = sideSwaps(rounds);
  const last = rounds[rounds.length - 1]?.number;
  const regulation = positiveInt(getConvar(matchInfo, "mp_maxrounds"));
  if (regulation == null || last == null) return breakLines(rounds, new Set(swaps));
  const marks = new Set<number>();
  if (regulation % SIDE_BLOCKS_PER_PERIOD === 0) {
    marks.add(regulation / SIDE_BLOCKS_PER_PERIOD);
  }
  for (const swap of swaps) {
    if (swap < regulation) marks.add(swap);
  }
  const overtime = positiveInt(getConvar(matchInfo, "mp_overtime_maxrounds"));
  if (overtime != null) {
    addOvertimeMarks(marks, swaps, regulation, overtime, last);
  } else if (regulation < last) {
    marks.add(regulation);
    for (const swap of swaps) {
      if (swap > regulation) marks.add(swap);
    }
  }
  return breakLines(rounds, marks);
}

function sideSwaps(rounds: readonly TimelineRoundRoster[]): number[] {
  const swaps: number[] = [];
  for (let i = 1; i < rounds.length; i++) {
    const previous = rounds[i - 1];
    const current = rounds[i];
    if (!previous || !current || !rosterSwapped(previous.players, current.players)) continue;
    swaps.push(previous.number);
  }
  return swaps;
}

/**
 * Round after which the first side swap inside regulation happens.
 * Uses the same present-player comparison as `economyBreakAfter`.
 * Undefined when nobody who was present on both sides of a boundary changed side
 * before `maxRounds`.
 */
export function regulationSideSwapAfter(
  rounds: readonly TimelineRoundRoster[],
  maxRounds: number,
): number | undefined {
  if (!Number.isFinite(maxRounds) || maxRounds <= 0) return undefined;
  for (const swap of sideSwaps(rounds)) {
    if (swap < maxRounds) return swap;
  }
  return undefined;
}

/**
 * Overtime starts on the same side as the end of regulation. Boundaries step
 * by `mp_overtime_maxrounds`. The halfway swap inside a period is the half
 * line; a period with no swap uses the midpoint.
 */
function addOvertimeMarks(
  marks: Set<number>,
  swaps: readonly number[],
  regulation: number,
  overtime: number,
  last: number,
): void {
  for (let boundary = regulation; boundary < last; boundary += overtime) {
    marks.add(boundary);
    const periodEnd = boundary + overtime;
    const halves = swaps.filter((swap) => swap > boundary && swap < periodEnd);
    if (halves.length > 0) {
      for (const half of halves) marks.add(half);
      continue;
    }
    if (overtime % SIDE_BLOCKS_PER_PERIOD !== 0) continue;
    marks.add(boundary + overtime / SIDE_BLOCKS_PER_PERIOD);
  }
}

function positiveInt(raw: string | undefined): number | undefined {
  if (raw == null || !/^\d+$/.test(raw)) return undefined;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) return undefined;
  return value;
}

function breakLines(rounds: readonly TimelineRoundRoster[], marks: ReadonlySet<number>): number[] {
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
