import { afterEach, describe, expect, it, vi } from "vitest";
import * as clipHud from "@/lib/export/clipHud";
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

function roster(frames: Array<{ tick: number; health: number }>) {
  const ticks = makeTicks(2, frames.length);
  frames.forEach((frame, index) => {
    ticks.ticks[index] = frame.tick;
    for (let player = 0; player < 2; player++) {
      const slot = index * 2 + player;
      ticks.flags[slot] = FLAG_PRESENT | FLAG_ALIVE | (player === 0 ? FLAG_CT : 0);
      ticks.health[slot] = frame.health;
      ticks.money[slot] = 800;
    }
  });
  return makeReplay({
    players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
    rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
    ticks,
  });
}

function replay() {
  return roster([{ tick: 64, health: 100 }]);
}

function paintCtx(): CanvasRenderingContext2D {
  return { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
}

function blankCanvas(): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = 12;
  canvas.height = 8;
  return Promise.resolve(canvas);
}

const TABBABLE = "a[href], button, input, select, textarea, [tabindex]";

/** Focusable controls. An `inert` ancestor removes the whole subtree. */
function tabbableDescendants(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter((el) => {
    if (el.closest("[inert]")) return false;
    if (el.tabIndex < 0) return false;
    if (el.matches(":disabled")) return false;
    return true;
  });
}

function pageHudPorts(raster: () => Promise<HTMLCanvasElement> = blankCanvas) {
  return {
    probe: async () => cleanProbe,
    raster,
    usable: async () => true,
  };
}

function mockPanelBoxes(): void {
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
}

function hostSlots(): NodeListOf<Element> {
  return document.querySelectorAll(".clip-page-host-slot");
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

describe("clip page host slot", () => {
  it("is inert and has no tabbable descendants while an export is mounted", async () => {
    mockPanelBoxes();
    await beginClipPageHud(replay(), 1080, 64, null, pageHudPorts());
    const slot = hostSlots()[0];
    expect(slot).toBeInstanceOf(HTMLElement);
    expect(slot?.hasAttribute("inert")).toBe(true);
    const buttons = [...(slot?.querySelectorAll("button") ?? [])].filter(
      (button) => button.tabIndex >= 0,
    );
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((button) => button.closest("[inert]") === slot)).toBe(true);
    expect(tabbableDescendants(slot!)).toEqual([]);
  });

  it("is removed after a successful export", async () => {
    mockPanelBoxes();
    await beginClipPageHud(replay(), 1080, 64, null, pageHudPorts());
    expect(hostSlots()).toHaveLength(1);
    endClipPageHud();
    expect(hostSlots()).toHaveLength(0);
  });

  it("is removed when the first raster fails", async () => {
    mockPanelBoxes();
    const session = await beginClipPageHud(replay(), 1080, 64, null, {
      ...pageHudPorts(async () => {
        throw new Error("raster");
      }),
    });
    expect(session.mode).toBe("painted");
    expect(hostSlots()).toHaveLength(0);
  });

  it("is removed when the export is cancelled", async () => {
    mockPanelBoxes();
    const session = await beginClipPageHud(replay(), 1080, 64, null, pageHudPorts());
    expect(hostSlots()).toHaveLength(1);
    session.dispose();
    expect(hostSlots()).toHaveLength(0);
  });
});

describe("clip page HUD raster failure", () => {
  it("uses the painted HUD for every later frame after one raster throws", async () => {
    mockPanelBoxes();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const painted = vi.spyOn(clipHud, "paintClipHud").mockImplementation(() => undefined);
    let fail = false;
    const raster = vi.fn(() => {
      if (fail) return Promise.reject(new Error("decode"));
      return blankCanvas();
    });
    const session = await beginClipPageHud(
      roster([
        { tick: 64, health: 100 },
        { tick: 200, health: 40 },
      ]),
      1080,
      64,
      null,
      { ...pageHudPorts(), raster },
    );
    expect(session.mode).toBe("page");
    const prepared = raster.mock.calls.length;
    fail = true;
    const ctx = paintCtx();
    await session.paint(ctx, 200, null);
    expect(session.mode).toBe("painted");
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(painted).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    const afterFailure = raster.mock.calls.length;
    expect(afterFailure).toBeGreaterThan(prepared);
    await session.paint(ctx, 200, null);
    await session.paint(ctx, 64, null);
    expect(raster.mock.calls.length).toBe(afterFailure);
    expect(painted).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});
