import { PAWN_INTERP_MAX_SPEED } from "@/lib/shared/constants";
import { FLAG_ALIVE, FLAG_PRESENT } from "@/lib/replay/replayTypes";

/** One sampled pawn. `flags` uses the replay `FLAG_*` bits. */
export interface InterpPawn {
  x: number;
  y: number;
  z: number;
  yaw: number;
  flags: number;
}

export interface InterpPawnPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** The pose is the later sample, not a blend between the two. */
  snapped: boolean;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-arc blend of CS2 eye yaw in degrees, across ±180°. */
export function lerpYaw(a: number, b: number, t: number): number {
  let delta = b - a;
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return a + delta * t;
}

function flagBitDiffers(earlier: number, later: number, bit: number): boolean {
  return (earlier & bit) !== (later & bit);
}

/** Horizontal distance that still blends. Zero when the gap or tick rate is not positive. */
export function pawnInterpMaxDistance(deltaTicks: number, tickRate: number): number {
  if (!(tickRate > 0) || !(deltaTicks > 0)) return 0;
  return (PAWN_INTERP_MAX_SPEED * deltaTicks) / tickRate;
}

/**
 * True when blending would slide across a death, a presence change, or a
 * horizontal jump faster than {@link PAWN_INTERP_MAX_SPEED}. `z` is ignored
 * so a Vertigo or Nuke drop stays a blend.
 */
export function pawnSamplesShouldSnap(
  earlier: InterpPawn,
  later: InterpPawn,
  deltaTicks: number,
  tickRate: number,
): boolean {
  if (flagBitDiffers(earlier.flags, later.flags, FLAG_PRESENT)) return true;
  if (flagBitDiffers(earlier.flags, later.flags, FLAG_ALIVE)) return true;
  const dx = later.x - earlier.x;
  const dy = later.y - earlier.y;
  return Math.hypot(dx, dy) > pawnInterpMaxDistance(deltaTicks, tickRate);
}

/**
 * Blend two pawn samples. `t` is 0 on the earlier tick and approaches 1 at
 * the later one. A snap draws the later sample for any `t` past the earlier
 * tick; the earlier tick itself stays on the earlier sample.
 */
export function interpolatePawn(
  earlier: InterpPawn,
  later: InterpPawn,
  t: number,
  deltaTicks: number,
  tickRate: number,
): InterpPawnPose {
  if (!(t > 0)) {
    return { x: earlier.x, y: earlier.y, z: earlier.z, yaw: earlier.yaw, snapped: false };
  }
  if (pawnSamplesShouldSnap(earlier, later, deltaTicks, tickRate)) {
    return { x: later.x, y: later.y, z: later.z, yaw: later.yaw, snapped: true };
  }
  return {
    x: lerp(earlier.x, later.x, t),
    y: lerp(earlier.y, later.y, t),
    z: lerp(earlier.z, later.z, t),
    yaw: lerpYaw(earlier.yaw, later.yaw, t),
    snapped: false,
  };
}
