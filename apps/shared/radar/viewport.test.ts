import { describe, expect, it } from "vitest";
import { radarLayout, radarToScreen, screenToRadar } from "./viewport.ts";

describe("radarLayout", () => {
  it("fits the overview inside the canvas with padding", () => {
    const layout = radarLayout(400, 400, { scale: 1, ox: 0, oy: 0 });
    expect(layout).toMatchObject({ pad: 16, fit: 368, baseX: 16, baseY: 16, imgSize: 1024 });
  });
});

describe("screenToRadar", () => {
  it("round-trips through radarToScreen at scale 1", () => {
    const view = { scale: 1, ox: 0, oy: 0 };
    const w = 400;
    const h = 400;
    const radar = screenToRadar(w, h, view, 200, 200);
    const back = radarToScreen(w, h, view, radar.x, radar.y);
    expect(back.x).toBeCloseTo(200, 5);
    expect(back.y).toBeCloseTo(200, 5);
  });
});
