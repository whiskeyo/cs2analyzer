import {
  RATING_CENTER,
  RATING_FLOOR,
  RATING_GRAPH_MAX,
  RATING_SPREAD_STD,
} from "@/lib/shared/constants";
import { MATCH_RATING_RANGES, type MatchRatingRange } from "./rating";

export const RATING_GRAPH_LAYOUT = {
  width: 720,
  height: 272,
  padLeft: 28,
  padRight: 28,
  padTop: 28,
  padBottom: 72,
} as const;

export type RatingGraphLayout = typeof RATING_GRAPH_LAYOUT;

export type PlotRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);

export function ratingNormalPdf(x: number, mean = RATING_CENTER, std = RATING_SPREAD_STD): number {
  const z = (x - mean) / std;
  return Math.exp(-0.5 * z * z) / (std * SQRT_TWO_PI);
}

export function ratingGraphDomain(): { min: number; max: number } {
  return { min: RATING_FLOOR, max: RATING_GRAPH_MAX };
}

export function ratingRangeBounds(range: MatchRatingRange): { min: number; max: number } {
  return { min: range.min, max: range.max ?? RATING_GRAPH_MAX };
}

export function ratingRangeTone(label: string): string {
  return label.toLowerCase();
}

export function sampleRatingAxis(count: number): number[] {
  const { min, max } = ratingGraphDomain();
  const last = Math.max(count - 1, 1);
  return Array.from({ length: Math.max(count, 2) }, (_, i) => min + ((max - min) * i) / last);
}

export function plotRect(layout: RatingGraphLayout = RATING_GRAPH_LAYOUT): PlotRect {
  return {
    x: layout.padLeft,
    y: layout.padTop,
    width: layout.width - layout.padLeft - layout.padRight,
    height: layout.height - layout.padTop - layout.padBottom,
  };
}

export function ratingToX(rating: number, layout: RatingGraphLayout = RATING_GRAPH_LAYOUT): number {
  const { min, max } = ratingGraphDomain();
  const plot = plotRect(layout);
  return plot.x + ((rating - min) / (max - min)) * plot.width;
}

export function densityToY(
  density: number,
  peak: number,
  layout: RatingGraphLayout = RATING_GRAPH_LAYOUT,
): number {
  const plot = plotRect(layout);
  const t = peak <= 0 ? 0 : density / peak;
  return plot.y + plot.height * (1 - t);
}

function pointPath(xs: number[], layout: RatingGraphLayout): string {
  const peak = ratingNormalPdf(RATING_CENTER);
  return xs
    .map((x, i) => {
      const px = ratingToX(x, layout);
      const py = densityToY(ratingNormalPdf(x), peak, layout);
      return `${i === 0 ? "M" : "L"}${px.toFixed(2)} ${py.toFixed(2)}`;
    })
    .join(" ");
}

export function ratingCurvePath(
  xs: number[],
  layout: RatingGraphLayout = RATING_GRAPH_LAYOUT,
): string {
  return pointPath(xs, layout);
}

export function ratingBandPath(
  range: MatchRatingRange,
  xs: number[],
  layout: RatingGraphLayout = RATING_GRAPH_LAYOUT,
): string {
  const { min, max } = ratingRangeBounds(range);
  const inner = xs.filter((x) => x > min && x < max);
  const ratings = [min, ...inner, max];
  const curve = pointPath(ratings, layout);
  if (!curve) return "";
  const plot = plotRect(layout);
  const baseline = plot.y + plot.height;
  const x0 = ratingToX(min, layout);
  const x1 = ratingToX(max, layout);
  return `${curve} L${x1.toFixed(2)} ${baseline.toFixed(2)} L${x0.toFixed(2)} ${baseline.toFixed(2)} Z`;
}

export function ratingGraphTicks(): number[] {
  const edges = MATCH_RATING_RANGES.flatMap((range) => [range.min, range.max]).filter(
    (value): value is number => value != null,
  );
  const { min, max } = ratingGraphDomain();
  return [...new Set([min, ...edges, max, RATING_CENTER])].sort((a, b) => a - b);
}
