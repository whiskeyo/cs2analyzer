import {
  habitsArrowAtScreen,
  habitsArrowJumpTick,
  type SeriesOverlay,
} from "@/lib/parse/seriesOverlay";
import type { SampledPlayer } from "@/lib/replay/sample";

/** Click this close to a pawn (CSS px) to select it. */
export const PLAYER_HIT_RADIUS_PX = 18;

/** Double-click this close to a habits arrow (CSS px) to jump. */
export const HABITS_ARROW_HIT_PX = 16;

export function canvasLocalPoint(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export function nearestPlayerIndexAtScreen(
  players: SampledPlayer[],
  mx: number,
  my: number,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  hitRadius = PLAYER_HIT_RADIUS_PX,
): number | null {
  let best: { i: number; d: number } | null = null;
  for (const p of players) {
    if (!p.present) continue;
    const s = toScreen(p.x, p.y);
    const d = (s.x - mx) ** 2 + (s.y - my) ** 2;
    if (!best || d < best.d) best = { i: p.index, d };
  }
  return best && best.d < hitRadius * hitRadius ? best.i : null;
}

export function habitsJumpAtScreen(
  overlay: SeriesOverlay,
  showArrows: boolean,
  mx: number,
  my: number,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  playSec: number | undefined,
): { demoId: string; jumpTick: number } | null {
  const hit = habitsArrowAtScreen(
    overlay,
    showArrows,
    mx,
    my,
    toScreen,
    HABITS_ARROW_HIT_PX,
    playSec,
  );
  if (!hit) return null;
  return { demoId: hit.demoId, jumpTick: habitsArrowJumpTick(hit) };
}
