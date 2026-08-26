import {
  CALLOUT_BETWEEN_MAX,
  CALLOUT_CLOSEST_RATIO,
  CALLOUT_NEAR_RADIUS,
} from "@/lib/shared/constants";
import {
  calloutAtWorld,
  distanceToPolygon,
  polygonCentroid,
  type LayoutCallout,
  type MapLayout,
} from "@/lib/radar/layouts";
import { floorForZ, worldToRadar } from "@/lib/radar/maps";
import type { MapCalibration } from "@/lib/replay/replayTypes";

export type SiteCallout = "A" | "B" | "Mid";

export interface MapPlaces {
  layout: MapLayout;
  cal: MapCalibration;
}

export interface PlaceHit {
  site: SiteCallout | null;
  location: string | null;
}

export function placesReady(places: MapPlaces | null | undefined): places is MapPlaces {
  return places != null && places.layout.callouts.length > 0;
}

function isSpawnName(name: string): boolean {
  return /\bspawn\b/i.test(name);
}

/** "A Site" / "B Apps" / "Top mid" → A/B/Mid. Spawns and unnamed rooms stay unlabeled. */
export function siteFromName(name: string): SiteCallout | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return null;
  if (isSpawnName(trimmed)) return null;
  if (/\bmid\b/i.test(trimmed)) return "Mid";
  if (/^a\b/i.test(trimmed)) return "A";
  if (/^b\b/i.test(trimmed)) return "B";
  return null;
}

export function layoutSiteFilters(layout: MapLayout | null | undefined): {
  a: boolean;
  b: boolean;
  mid: boolean;
} {
  const out = { a: false, b: false, mid: false };
  if (!layout) return out;
  for (const callout of layout.callouts) {
    const site = siteFromName(callout.name);
    if (site === "A") out.a = true;
    else if (site === "B") out.b = true;
    else if (site === "Mid") out.mid = true;
  }
  return out;
}

export function locationAt(
  places: MapPlaces | null | undefined,
  x: number,
  y: number,
  z?: number,
): LayoutCallout | null {
  if (!placesReady(places)) return null;
  return calloutAtWorld(places.layout, places.cal, x, y, z);
}

function bombsitePolygon(layout: MapLayout, site: "A" | "B"): LayoutCallout | null {
  const exact = layout.callouts.find((callout) => {
    const name = callout.name.trim();
    return (
      new RegExp(`^${site}\\s+site$`, "i").test(name) || name.toLowerCase() === site.toLowerCase()
    );
  });
  if (exact) return exact;
  return layout.callouts.find((callout) => siteFromName(callout.name) === site) ?? null;
}

/** Closer of the A Site / B Site polygon centroids. Needs both bombsite regions. */
export function nearerBombsite(
  places: MapPlaces | null | undefined,
  x: number,
  y: number,
): "A" | "B" | null {
  if (!placesReady(places)) return null;
  const a = bombsitePolygon(places.layout, "A");
  const b = bombsitePolygon(places.layout, "B");
  if (!a || !b) return null;
  const radar = worldToRadar(places.cal, x, y);
  const ca = polygonCentroid(a.polygon);
  const cb = polygonCentroid(b.polygon);
  const distA = Math.hypot(radar.x - ca.x, radar.y - ca.y);
  const distB = Math.hypot(radar.x - cb.x, radar.y - cb.y);
  return distA <= distB ? "A" : "B";
}

function nearbyCallouts(
  places: MapPlaces,
  x: number,
  y: number,
  z?: number,
): { name: string; dist: number }[] {
  const radar = worldToRadar(places.cal, x, y);
  const floor = z == null ? "default" : floorForZ(places.cal, z);
  const rows: { name: string; dist: number }[] = [];
  for (const callout of places.layout.callouts) {
    if (callout.floor !== floor || isSpawnName(callout.name)) continue;
    const dist = distanceToPolygon(radar.x, radar.y, callout.polygon);
    if (dist > CALLOUT_NEAR_RADIUS) continue;
    rows.push({ name: callout.name, dist });
  }
  rows.sort((a, b) => a.dist - b.dist || a.name.localeCompare(b.name));
  return rows;
}

const BETWEEN_PREFIX = "between ";

function betweenLabel(names: string[]): string {
  if (names.length === 1) return names[0] ?? "";
  return `${BETWEEN_PREFIX}${names.join(", ")}`;
}

/** Callout names a landing belongs to, including neighbors in a "between X, Y" gap. */
export function calloutsInLocation(location: string | null | undefined): string[] {
  if (!location) return [];
  if (location.startsWith(BETWEEN_PREFIX)) {
    return location
      .slice(BETWEEN_PREFIX.length)
      .split(", ")
      .filter((name) => name.length > 0);
  }
  return [location];
}

function gapPlace(places: MapPlaces, x: number, y: number, z?: number): PlaceHit {
  const nearby = nearbyCallouts(places, x, y, z);
  const nearest = nearby[0];
  if (!nearest) return { site: null, location: null };
  const clusterLimit = nearest.dist / CALLOUT_CLOSEST_RATIO;
  const names = nearby
    .filter((row) => row.dist <= clusterLimit)
    .slice(0, CALLOUT_BETWEEN_MAX)
    .map((row) => row.name);
  const location = betweenLabel(names);
  const named = siteFromName(nearest.name);
  return { location, site: named ?? nearerBombsite(places, x, y) };
}

export function placeAt(
  places: MapPlaces | null | undefined,
  x: number,
  y: number,
  z?: number,
): PlaceHit {
  if (!placesReady(places)) return { site: null, location: null };
  const hit = locationAt(places, x, y, z);
  if (hit) {
    if (isSpawnName(hit.name)) return { site: null, location: null };
    const named = siteFromName(hit.name);
    return { location: hit.name, site: named ?? nearerBombsite(places, x, y) };
  }
  return gapPlace(places, x, y, z);
}

export function siteAt(
  places: MapPlaces | null | undefined,
  x: number,
  y: number,
  z?: number,
): SiteCallout | null {
  return placeAt(places, x, y, z).site;
}

/** A plant is on a bombsite even if it sits just outside the drawn polygon. */
export function plantPlace(
  places: MapPlaces | null | undefined,
  x: number,
  y: number,
  z?: number,
): PlaceHit {
  const hit = placeAt(places, x, y, z);
  if (hit.site === "A" || hit.site === "B") return hit;
  if (!placesReady(places)) return { site: null, location: null };
  return { location: hit.location, site: nearerBombsite(places, x, y) };
}

function majoritySite(counts: Record<SiteCallout, number>): SiteCallout | null {
  let best: SiteCallout | null = null;
  let bestN = 0;
  let tie = false;
  for (const key of ["A", "B", "Mid"] as const) {
    const n = counts[key];
    if (n > bestN) {
      best = key;
      bestN = n;
      tie = false;
    } else if (n === bestN && bestN > 0) {
      tie = true;
    }
  }
  return tie ? null : best;
}

/** Vote A/B/Mid from grenade landings against the layout. */
export function placeFromLandings(
  places: MapPlaces | null | undefined,
  pts: { x: number; y: number; z?: number }[],
): PlaceHit {
  if (!placesReady(places) || pts.length === 0) return { site: null, location: null };
  const counts: Record<SiteCallout, number> = { A: 0, B: 0, Mid: 0 };
  const names = new Map<string, number>();
  for (const pt of pts) {
    const hit = placeAt(places, pt.x, pt.y, pt.z);
    if (hit.site) counts[hit.site] += 1;
    if (hit.location) names.set(hit.location, (names.get(hit.location) ?? 0) + 1);
  }
  let location: string | null = null;
  let best = 0;
  let locTie = false;
  for (const [name, n] of names) {
    if (n > best) {
      location = name;
      best = n;
      locTie = false;
    } else if (n === best) {
      locTie = true;
    }
  }
  return { site: majoritySite(counts), location: locTie ? null : location };
}

/** Prefer a specific room name; fall back to A/B/Mid. */
export function placeLabel(hit: PlaceHit): string | null {
  if (hit.location && siteFromName(hit.location) == null) return hit.location;
  return hit.site;
}
