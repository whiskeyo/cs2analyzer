import { polygonCallout } from "@/lib/layout/regions.ts";
import type { LayoutCallout, Point } from "@/lib/layouts/types";

export const TRIANGLE: Point[] = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
];

export const SQUARE: Point[] = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

export function poly(
  id: string,
  name = id,
  extra: Partial<Pick<LayoutCallout, "floor" | "group">> = {},
): LayoutCallout {
  return polygonCallout(id, name, TRIANGLE, extra);
}
