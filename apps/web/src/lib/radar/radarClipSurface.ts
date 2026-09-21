/**
 * Live radar canvas the single-playback clip exporter paints into.
 * `RadarCanvas` registers while it is mounted. Aggregated bucket playback
 * uses the same canvas; the export control itself stays on single playback.
 */

export interface RadarClipSurface {
  canvas: HTMLCanvasElement;
  /** Draw one demo tick into the live radar bitmap. */
  paintAt: (tick: number) => void;
}

let surface: RadarClipSurface | null = null;
let hold = false;

export function registerRadarClipSurface(next: RadarClipSurface | null): void {
  surface = next;
}

export function radarClipSurface(): RadarClipSurface | null {
  return surface;
}

/** While true, the radar rAF loop skips so export frames are the only paints. */
export function setRadarClipHold(next: boolean): void {
  hold = next;
}

export function radarClipHold(): boolean {
  return hold;
}

/** Size the live radar bitmap and paint one export tick in CSS pixels. */
export function paintRadarClipFrame(
  canvas: HTMLCanvasElement,
  wrap: HTMLElement,
  tick: number,
  beforePaint: (width: number, height: number) => void,
  paint: (ctx: CanvasRenderingContext2D, width: number, height: number, tick: number) => void,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const width = wrap.clientWidth;
  const height = wrap.clientHeight;
  if (width <= 0 || height <= 0) return;
  const nextWidth = Math.floor(width * dpr);
  const nextHeight = Math.floor(height * dpr);
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
  }
  beforePaint(width, height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paint(ctx, width, height, tick);
}
