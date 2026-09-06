import { vi, type Mock } from "vitest";

export type MockCanvasContext = CanvasRenderingContext2D & {
  drawImage: Mock;
  fillRect: Mock;
  fillText: Mock;
  strokeText: Mock;
  beginPath: Mock;
  moveTo: Mock;
  lineTo: Mock;
  stroke: Mock;
  closePath: Mock;
  fill: Mock;
  clearRect: Mock;
  arc: Mock;
  rect: Mock;
  setLineDash: Mock;
  setTransform: Mock;
};

export function createMockCanvas(): MockCanvasContext {
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
    stroke: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    setLineDash: vi.fn(),
    globalAlpha: 1,
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    font: "",
    textAlign: "left",
    textBaseline: "top",
    imageSmoothingEnabled: true,
  } as unknown as MockCanvasContext;
}
