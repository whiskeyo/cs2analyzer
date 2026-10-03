import type { ClipHudRenderer } from "@/lib/export/clipHudRaster";

export interface ClipPageHudController {
  mode: ClipHudRenderer;
  paint(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    tick: number,
    selected: number | null,
  ): Promise<void>;
  dispose(): void;
}

let active: ClipPageHudController | null = null;

export function adoptClipPageHudSession(next: ClipPageHudController | null): void {
  if (active && active !== next) {
    active.dispose();
  }
  active = next;
}

export function clipPageHudSession(): ClipPageHudController | null {
  return active;
}

export function endClipPageHud(): void {
  active?.dispose();
  active = null;
}
