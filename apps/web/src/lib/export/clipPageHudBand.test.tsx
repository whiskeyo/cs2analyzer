import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClipPageHud } from "@/components/export/ClipPageHud";
import { clipClockLabel } from "@/lib/export/clipHud";
import { CLIP_EXPORT_SIZE_DEFAULT, clipExportFrame } from "@/lib/export/constants";
import { CLIP_HUD_PANEL_HUD } from "@/lib/export/clipPageHudKey";
import {
  clipHudPanelLayoutCss,
  rasterClipPageNode,
  resetClipPageHudRasterCache,
} from "@/lib/export/clipPageHudRaster";
import { placedClipPanel } from "@/lib/export/clipPageHudSession";
import { DEFAULT_TICK_RATE } from "@/lib/shared/constants";
import { makeBombEvent, makeReplay, makeRound } from "@/lib/testing/fixtures";

/**
 * Live Mirage score band: full text, centered, inside 1920×1080.
 * A half-width or shifted box is the clip that cut off Team Vitality.
 */
const BAND_LEFT = 823.31;
const BAND_TOP = 10;
const BAND_WIDTH = 273.375;
const BAND_HEIGHT = 43.86;
const PLANT_TICK = 400;
const FUSE_ELAPSED_SECONDS = 16;
const PLANTED_TICK = PLANT_TICK + FUSE_ELAPSED_SECONDS * DEFAULT_TICK_RATE;
const ROUND_CLOCK_TICK = 320;

afterEach(() => {
  resetClipPageHudRasterCache();
  vi.restoreAllMocks();
});

function domRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    toJSON() {
      return {};
    },
  };
}

function scoreReplay() {
  return makeReplay({
    header: { map_name: "de_mirage", team_t: "Team Vitality", team_ct: "Team Spirit" },
    rounds: [
      makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 200, winner: "CT" }),
      makeRound({
        number: 2,
        start_tick: 256,
        freeze_end_tick: ROUND_CLOCK_TICK,
        end_tick: 8000,
        winner: null,
        team_t: "Team Vitality",
        team_ct: "Team Spirit",
      }),
    ],
    bombEvents: [makeBombEvent({ tick: PLANT_TICK, kind: "planted" })],
  });
}

function stubForeignObject(): { markup: Node[]; restore: () => void } {
  const markup: Node[] = [];
  const serialize = XMLSerializer.prototype.serializeToString;
  vi.spyOn(XMLSerializer.prototype, "serializeToString").mockImplementation(function (
    this: XMLSerializer,
    node: Node,
  ) {
    markup.push(node);
    return serialize.call(this, node);
  });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage() {
      return undefined;
    },
  } as unknown as CanvasRenderingContext2D);
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    configurable: true,
    get() {
      return "";
    },
    set(this: HTMLImageElement) {
      queueMicrotask(() => {
        this.onload?.(new Event("load"));
      });
    },
  });
  return {
    markup,
    restore() {
      if (src) Object.defineProperty(HTMLImageElement.prototype, "src", src);
    },
  };
}

describe("clip score band", () => {
  it("keeps the full raster rect inside 1920×1080 and includes both teams, the clock, and C4", async () => {
    const frame = clipExportFrame(CLIP_EXPORT_SIZE_DEFAULT);
    expect(frame).toEqual({ width: 1920, height: 1080 });
    const replay = scoreReplay();
    const clock = clipClockLabel(replay, PLANTED_TICK);
    const view = render(
      <ClipPageHud
        replay={replay}
        tick={PLANTED_TICK}
        selected={null}
        width={frame.width}
        height={frame.height}
      />,
    );
    const host = view.container.querySelector(".clip-page-host");
    const panel = view.container.querySelector(`[data-clip-panel="${CLIP_HUD_PANEL_HUD}"]`);
    expect(host).toBeInstanceOf(HTMLElement);
    expect(panel).toBeInstanceOf(HTMLElement);
    const hud = host as HTMLElement;
    const band = panel as HTMLElement;

    expect(band.querySelector(".t")?.textContent).toBe("Team Vitality 0");
    expect(band.querySelector(".ct")?.textContent).toBe("1 Team Spirit");
    const meta = band.querySelector(".hud-meta")?.textContent ?? "";
    expect(meta).toContain("Mirage");
    expect(meta).toMatch(/R\d+/);
    expect(meta).toContain(clock);
    expect(meta).toMatch(/C4 \d+\.\d/);

    vi.spyOn(hud, "getBoundingClientRect").mockReturnValue(
      domRect(0, 0, frame.width, frame.height),
    );
    vi.spyOn(band, "getBoundingClientRect").mockReturnValue(
      domRect(BAND_LEFT, BAND_TOP, BAND_WIDTH, BAND_HEIGHT),
    );
    const paint = stubForeignObject();
    try {
      const canvas = await rasterClipPageNode(band, clipHudPanelLayoutCss(CLIP_HUD_PANEL_HUD));
      expect(canvas.width).toBe(Math.ceil(BAND_WIDTH));
      expect(canvas.height).toBe(Math.ceil(BAND_HEIGHT));
      const placed = placedClipPanel(hud, band, canvas);
      expect(placed).not.toBeNull();
      if (!placed) return;
      expect(placed.w).toBe(BAND_WIDTH);
      expect(placed.h).toBe(BAND_HEIGHT);
      expect(placed.x).toBeGreaterThanOrEqual(0);
      expect(placed.y).toBeGreaterThanOrEqual(0);
      expect(placed.x + placed.w).toBeLessThanOrEqual(frame.width);
      expect(placed.y + placed.h).toBeLessThanOrEqual(frame.height);

      const clone = paint.markup[0];
      expect(clone).toBeInstanceOf(HTMLElement);
      const rasterHud = (clone as HTMLElement).querySelector(".radar-hud");
      expect(rasterHud).toBeInstanceOf(HTMLElement);
      const score = rasterHud as HTMLElement;
      expect(score.style.getPropertyValue("transform")).toBe("none");
      expect(score.style.getPropertyPriority("transform")).toBe("important");
      expect(score.getAttribute("style")).toContain("transform: none !important");
      const rasterText = (clone as HTMLElement).textContent ?? "";
      expect(rasterText).toContain("Team Vitality 0");
      expect(rasterText).toContain("1 Team Spirit");
      expect(rasterText).toContain("Mirage");
      expect(rasterText).toMatch(/R\d+/);
      expect(rasterText).toContain(clock);
      expect(rasterText).toMatch(/C4 \d+\.\d/);
    } finally {
      paint.restore();
    }
  });

  it("includes the round clock before the plant", () => {
    const frame = clipExportFrame(CLIP_EXPORT_SIZE_DEFAULT);
    const replay = scoreReplay();
    const clock = clipClockLabel(replay, ROUND_CLOCK_TICK);
    const view = render(
      <ClipPageHud
        replay={replay}
        tick={ROUND_CLOCK_TICK}
        selected={null}
        width={frame.width}
        height={frame.height}
      />,
    );
    const band = view.container.querySelector(`[data-clip-panel="${CLIP_HUD_PANEL_HUD}"]`);
    const meta = band?.querySelector(".hud-meta")?.textContent ?? "";
    expect(clock).toBe("1:55");
    expect(meta).toContain("Mirage");
    expect(meta).toMatch(/R\d+/);
    expect(meta).toContain(clock);
    expect(meta).not.toMatch(/C4 \d+\.\d/);
    expect(band?.querySelector(".t")?.textContent).toBe("Team Vitality 0");
    expect(band?.querySelector(".ct")?.textContent).toBe("1 Team Spirit");
  });
});
