import { MIN_CIRCLE_RADIUS } from "@shared/layout/schema.ts";
import { calloutArea, pointInCallout } from "@shared/layout/regions.ts";
import { EDGE_HIT_PX, VERTEX_HIT_PX } from "./constants";
import { nearestPolygonEdge } from "./geometry";
import { radarToScreen, screenToRadar, type RadarView } from "./maps";
import type { LayoutCallout, LayoutFloor, LayoutRegion, Point } from "./types";

export type LayoutHandle =
  | { kind: "poly-vertex"; region: number; index: number }
  | { kind: "circle-center"; region: number }
  | { kind: "circle-rim"; region: number };

export function visibleCallouts(callouts: LayoutCallout[], floor: LayoutFloor): LayoutCallout[] {
  return callouts.filter((c) => c.floor === floor);
}

export function hitCalloutAtRadar(
  callouts: LayoutCallout[],
  floor: LayoutFloor,
  x: number,
  y: number,
): LayoutCallout | null {
  const hits = visibleCallouts(callouts, floor).filter((c) => pointInCallout(x, y, c));
  if (hits.length === 0) return null;
  hits.sort((a, b) => calloutArea(a) - calloutArea(b));
  return hits[0] ?? null;
}

function circleRim(region: Extract<LayoutRegion, { kind: "circle" }>): Point {
  return { x: region.x + region.radius, y: region.y };
}

export function hitHandle(
  wrap: { clientWidth: number; clientHeight: number },
  view: RadarView,
  callout: LayoutCallout,
  sx: number,
  sy: number,
): LayoutHandle | null {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  const near = (p: Point) => {
    const s = radarToScreen(w, h, view, p.x, p.y);
    return Math.hypot(s.x - sx, s.y - sy) <= VERTEX_HIT_PX;
  };
  for (let r = 0; r < callout.regions.length; r++) {
    const region = callout.regions[r];
    if (!region) continue;
    if (region.kind === "circle") {
      if (near({ x: region.x, y: region.y })) return { kind: "circle-center", region: r };
      if (near(circleRim(region))) return { kind: "circle-rim", region: r };
      continue;
    }
    for (let i = 0; i < region.points.length; i++) {
      const p = region.points[i];
      if (p && near(p)) return { kind: "poly-vertex", region: r, index: i };
    }
  }
  return null;
}

export function hitPolygonEdge(
  wrap: { clientWidth: number; clientHeight: number },
  view: RadarView,
  callouts: LayoutCallout[],
  floor: LayoutFloor,
  preferredId: string | null,
  sx: number,
  sy: number,
): { callout: LayoutCallout; region: number; index: number } | null {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  const toScreen = (p: Point) => radarToScreen(w, h, view, p.x, p.y);
  const layer = visibleCallouts(callouts, floor);
  const preferred = preferredId ? layer.find((c) => c.id === preferredId) : undefined;
  const ordered = preferred ? [preferred, ...layer.filter((c) => c.id !== preferred.id)] : layer;
  let best: { callout: LayoutCallout; region: number; index: number; dist: number } | null = null;
  for (const callout of ordered) {
    for (let r = 0; r < callout.regions.length; r++) {
      const region = callout.regions[r];
      if (!region || region.kind !== "polygon") continue;
      const hit = nearestPolygonEdge(region.points, toScreen, sx, sy);
      if (!hit || hit.dist > EDGE_HIT_PX) continue;
      if (!best || hit.dist < best.dist) {
        best = { callout, region: r, index: hit.index, dist: hit.dist };
      }
    }
    if (preferred && callout.id === preferred.id && best?.callout.id === preferred.id) break;
  }
  return best ? { callout: best.callout, region: best.region, index: best.index } : null;
}

export function applyHandleDrag(
  callout: LayoutCallout,
  handle: LayoutHandle,
  radar: Point,
): LayoutCallout {
  const regions = callout.regions.map((region, i) => {
    if (i !== handle.region) return region;
    if (handle.kind === "poly-vertex" && region.kind === "polygon") {
      return {
        kind: "polygon" as const,
        points: region.points.map((p, vi) => (vi === handle.index ? { ...radar } : p)),
      };
    }
    if (handle.kind === "circle-center" && region.kind === "circle") {
      return { ...region, x: radar.x, y: radar.y };
    }
    if (handle.kind === "circle-rim" && region.kind === "circle") {
      return {
        ...region,
        radius: Math.max(MIN_CIRCLE_RADIUS, Math.hypot(radar.x - region.x, radar.y - region.y)),
      };
    }
    return region;
  });
  return { ...callout, regions };
}

export function screenToRadarIn(
  wrap: { clientWidth: number; clientHeight: number },
  view: RadarView,
  sx: number,
  sy: number,
): Point {
  return screenToRadar(wrap.clientWidth, wrap.clientHeight, view, sx, sy);
}
