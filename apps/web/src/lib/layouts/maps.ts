import { RADAR_FIT_PAD, RADAR_OVERVIEW_SIZE } from "@/lib/radar/constants.ts";
import { radarLayout, radarToScreen, screenToRadar, type RadarView } from "@/lib/radar/viewport.ts";
import type { MapCalibration, Point } from "./types";

export type { RadarView };
export { radarLayout, radarToScreen, screenToRadar, RADAR_FIT_PAD, RADAR_OVERVIEW_SIZE };

export async function loadCalibrations(): Promise<Record<string, MapCalibration>> {
  const res = await fetch("/maps/calibrations.json");
  if (!res.ok) {
    throw new Error("could not load map calibrations");
  }
  return (await res.json()) as Record<string, MapCalibration>;
}

export function radarFile(cal: MapCalibration, floor: "default" | "lower"): string {
  if (floor === "lower") {
    return cal.lower_radar ?? cal.radar;
  }
  return cal.radar;
}

/** Layout editor alias for shared radar pixel coords. */
export type RadarPoint = Point;
