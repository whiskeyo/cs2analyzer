import { vi, type Mock } from "vitest";

/** Vitest-backed stand-in for `CanvasRenderingContext2D` used by radar paint tests. */
export type MockCanvasContext = CanvasRenderingContext2D & {
  drawImage: Mock;
  fillRect: Mock;
  clearRect: Mock;
  fillText: Mock;
  strokeText: Mock;
  beginPath: Mock;
  moveTo: Mock;
  lineTo: Mock;
  quadraticCurveTo: Mock;
  stroke: Mock;
  closePath: Mock;
  fill: Mock;
  save: Mock;
  restore: Mock;
  clip: Mock;
  rect: Mock;
  roundRect: Mock;
  measureText: Mock;
  arc: Mock;
  translate: Mock;
  rotate: Mock;
  setLineDash: Mock;
};

export type MockCanvasOptions = {
  /** Returned from `measureText`; defaults to 40px per string. */
  textWidth?: number;
};

/** Identity world-to-screen projection for unit tests. */
export function identityToScreen(x: number, y: number): { x: number; y: number } {
  return { x, y };
}

/** Creates a mock 2D context with spies on every method the radar painters use. */
export function createMockCanvas(opts: MockCanvasOptions = {}): MockCanvasContext {
  const textWidth = opts.textWidth ?? 40;
  return {
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    clip: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    measureText: vi.fn((text: string) => ({
      width: text.length > 0 ? textWidth : 4,
    })),
    arc: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    filter: "none",
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineJoin: "round",
    lineCap: "round",
    font: "",
    textAlign: "left",
    textBaseline: "top",
  } as unknown as MockCanvasContext;
}

/** Counts `arc` calls whose centre matches a screen point (within tolerance). */
export function arcCountAt(ctx: MockCanvasContext, x: number, y: number, tolerance = 0.5): number {
  return ctx.arc.mock.calls.filter(
    ([cx, cy]) => Math.abs(cx - x) < tolerance && Math.abs(cy - y) < tolerance,
  ).length;
}
