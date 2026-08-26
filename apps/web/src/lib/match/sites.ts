import {
  RADAR_OVERVIEW_SIZE,
  SITE_CALLOUT_CLOSER_RATIO,
  SITE_CALLOUT_RADIUS,
} from "@/lib/shared/constants";

export type SiteCallout = "A" | "B" | "Mid";

interface SiteAnchor {
  x: number;
  y: number;
}

interface MapSites {
  a: SiteAnchor;
  b: SiteAnchor;
  /** World Z below this is the B floor (Nuke / Vertigo). */
  lowerMaxZ?: number;
}

function worldFromRadar(
  posX: number,
  posY: number,
  scale: number,
  fractionX: number,
  fractionY: number,
): SiteAnchor {
  return {
    x: fractionX * RADAR_OVERVIEW_SIZE * scale + posX,
    y: posY - fractionY * RADAR_OVERVIEW_SIZE * scale,
  };
}

function layout(
  posX: number,
  posY: number,
  scale: number,
  bombA: readonly [number, number],
  bombB: readonly [number, number],
  lowerMaxZ?: number,
): MapSites {
  return {
    a: worldFromRadar(posX, posY, scale, bombA[0], bombA[1]),
    b: worldFromRadar(posX, posY, scale, bombB[0], bombB[1]),
    lowerMaxZ,
  };
}

/**
 * Bombsite markers from Valve overview `bombA_x` / `bombB_y` (0–1 on the radar).
 * Anubis has no bomb icons in the overview; A is the west pillar courtyard,
 * B is the northeast temple (not south toward T spawn).
 */
const MAP_SITES: Record<string, MapSites> = {
  de_dust2: layout(-2476, 3239, 4.4, [0.8, 0.16], [0.21, 0.12]),
  de_mirage: layout(-3230, 1713, 5.0, [0.54, 0.76], [0.23, 0.28]),
  de_inferno: layout(-2087, 3870, 4.9, [0.81, 0.69], [0.49, 0.22]),
  de_nuke: layout(-3453, 2887, 7, [0.58, 0.48], [0.58, 0.58], -495),
  de_overpass: layout(-4831, 1781, 5.2, [0.55, 0.23], [0.7, 0.31]),
  de_ancient: layout(-2953, 2164, 5, [0.31, 0.25], [0.8, 0.4]),
  de_anubis: layout(-2796, 3328, 5.22, [0.25, 0.49], [0.77, 0.26]),
  de_vertigo: layout(-3168, 1762, 4.0, [0.705, 0.585], [0.222, 0.223], 11700),
  de_train: layout(-2308, 2078, 4.082077, [0.63, 0.49], [0.52, 0.76]),
  de_cache: layout(-2000, 3250, 5.5, [0.325, 0.26], [0.345, 0.79]),
};

function mapKey(mapName: string): string {
  return (
    mapName
      .split("/")
      .pop()
      ?.replace(/_scrimmagemap$/, "") ?? mapName
  );
}

function dist2(a: SiteAnchor, x: number, y: number): number {
  return Math.hypot(a.x - x, a.y - y);
}

/** A / B / Mid from world XY (and Z on Nuke / Vertigo). Unknown maps return null. */
export function siteCallout(mapName: string, x: number, y: number, z?: number): SiteCallout | null {
  const sites = MAP_SITES[mapKey(mapName)];
  if (!sites) return null;

  if (sites.lowerMaxZ != null && z != null) {
    if (z < sites.lowerMaxZ) {
      return dist2(sites.b, x, y) <= SITE_CALLOUT_RADIUS ? "B" : "Mid";
    }
    return dist2(sites.a, x, y) <= SITE_CALLOUT_RADIUS ? "A" : "Mid";
  }

  const distA = dist2(sites.a, x, y);
  const distB = dist2(sites.b, x, y);
  if (distA <= SITE_CALLOUT_RADIUS && distA < distB * SITE_CALLOUT_CLOSER_RATIO) return "A";
  if (distB <= SITE_CALLOUT_RADIUS && distB < distA * SITE_CALLOUT_CLOSER_RATIO) return "B";
  return "Mid";
}

/** A plant is always A or B. Unknown maps return null. */
export function nearestBombsite(
  mapName: string,
  x: number,
  y: number,
  z?: number,
): Exclude<SiteCallout, "Mid"> | null {
  const sites = MAP_SITES[mapKey(mapName)];
  if (!sites) return null;
  if (sites.lowerMaxZ != null && z != null) {
    return z < sites.lowerMaxZ ? "B" : "A";
  }
  return dist2(sites.a, x, y) <= dist2(sites.b, x, y) ? "A" : "B";
}
