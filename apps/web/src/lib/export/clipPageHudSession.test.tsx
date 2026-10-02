import { afterEach, describe, expect, it, vi } from "vitest";
import { fitClipScoreboard } from "@/lib/export/clipPageHudRaster";
import { beginClipPageHud } from "@/lib/export/clipPageHudSession";
import { endClipPageHud } from "@/lib/export/clipPageHudBridge";
import type { ClipHudProbe } from "@/lib/export/clipHudRaster";
import { makePlayer, makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";

const cleanProbe: ClipHudProbe = {
  tainted: false,
  toBlob: true,
  videoFrame: "ok",
  alphaPreserved: true,
  threw: false,
};

function replay() {
  const ticks = makeTicks(2, 1);
  ticks.ticks[0] = 64;
  for (let player = 0; player < 2; player++) {
    ticks.flags[player] = FLAG_PRESENT | FLAG_ALIVE | (player === 0 ? FLAG_CT : 0);
    ticks.health[player] = 100;
    ticks.money[player] = 800;
  }
  return makeReplay({
    players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
    rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
    ticks,
  });
}

function blankCanvas(): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = 12;
  canvas.height = 8;
  return Promise.resolve(canvas);
}

afterEach(() => {
  endClipPageHud();
  vi.restoreAllMocks();
});

describe("fitClipScoreboard", () => {
  it("scales the table when both teams do not fit in the sidebar body", () => {
    const host = document.createElement("div");
    const body = document.createElement("div");
    body.className = "sidebar-body";
    const content = document.createElement("div");
    body.appendChild(content);
    host.appendChild(body);
    Object.defineProperty(body, "clientHeight", { configurable: true, value: 100 });
    Object.defineProperty(content, "scrollHeight", { configurable: true, value: 250 });
    expect(fitClipScoreboard(host)).toBeCloseTo(0.4);
    expect(content.style.transform).toBe("scale(0.4)");
    Object.defineProperty(content, "scrollHeight", { configurable: true, value: 80 });
    expect(fitClipScoreboard(host)).toBe(1);
    expect(content.style.transform).toBe("");
  });
});

describe("clip page HUD fallback", () => {
  it("keeps the painted HUD when the probe taints and does not throw", async () => {
    const raster = vi.fn(blankCanvas);
    const session = await beginClipPageHud(replay(), 1080, 64, null, {
      probe: async () => ({
        ...cleanProbe,
        tainted: true,
        toBlob: false,
        videoFrame: "failed",
        alphaPreserved: false,
      }),
      raster,
      usable: async () => true,
    });
    expect(session.mode).toBe("painted");
    expect(raster).not.toHaveBeenCalled();
  });

  it("keeps the painted HUD when the probe throws", async () => {
    const raster = vi.fn(blankCanvas);
    const session = await beginClipPageHud(replay(), 1080, 64, null, {
      probe: async () => {
        throw new Error("webkit");
      },
      raster,
      usable: async () => true,
    });
    expect(session.mode).toBe("painted");
    expect(raster).not.toHaveBeenCalled();
  });

  it("rasters a changed panel once and reuses it while the key holds", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 4,
      y: 6,
      left: 4,
      top: 6,
      right: 80,
      bottom: 40,
      width: 76,
      height: 34,
      toJSON() {
        return {};
      },
    });
    const raster = vi.fn(blankCanvas);
    const session = await beginClipPageHud(replay(), 1080, 64, null, {
      probe: async () => cleanProbe,
      raster,
      usable: async () => true,
    });
    expect(session.mode).toBe("page");
    const first = raster.mock.calls.length;
    expect(first).toBeGreaterThan(0);
    const ctx = {
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D;
    await session.paint(ctx, 64, null);
    expect(raster.mock.calls.length).toBe(first);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it("falls back without throwing when the raster itself cannot be encoded", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 20,
      bottom: 10,
      width: 20,
      height: 10,
      toJSON() {
        return {};
      },
    });
    const session = await beginClipPageHud(replay(), 1080, 64, null, {
      probe: async () => cleanProbe,
      raster: blankCanvas,
      usable: async () => false,
    });
    expect(session.mode).toBe("painted");
  });
});
