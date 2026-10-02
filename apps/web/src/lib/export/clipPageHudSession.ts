import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { ClipPageHud } from "@/components/export/ClipPageHud";
import { clipHudLayout, paintClipHud } from "@/lib/export/clipHud";
import { CLIP_HUD_PROBE_PX, clipExportFrame } from "@/lib/export/constants";
import {
  clipHudPanelLayoutCss,
  fitClipScoreboard,
  rasterClipPageNode,
} from "@/lib/export/clipPageHudRaster";
import {
  probeClipHudForeignObject,
  selectClipHudRenderer,
  type ClipHudProbe,
  type ClipHudRenderer,
} from "@/lib/export/clipHudRaster";
import {
  CLIP_HUD_PANEL_ECO,
  CLIP_HUD_PANEL_HUD,
  CLIP_HUD_PANEL_SCORE,
  clipHudPanelsToRaster,
  clipPageHudKey,
  type ClipHudPanel,
  type ClipPageHudKey,
} from "@/lib/export/clipPageHudKey";
import {
  adoptClipPageHudSession,
  type ClipPageHudController,
} from "@/lib/export/clipPageHudBridge";
import type { Replay } from "@/lib/replay/replayTypes";

interface PlacedImage {
  canvas: HTMLCanvasElement;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ClipPageHudPorts {
  probe: () => Promise<ClipHudProbe>;
  raster: (node: HTMLElement, panel: ClipHudPanel) => Promise<HTMLCanvasElement>;
  usable: (canvas: HTMLCanvasElement) => Promise<boolean>;
}

type HudDrawContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const PANEL_ORDER: ClipHudPanel[] = [CLIP_HUD_PANEL_SCORE, CLIP_HUD_PANEL_ECO, CLIP_HUD_PANEL_HUD];

function rasterPageNode(node: HTMLElement, panel: ClipHudPanel): Promise<HTMLCanvasElement> {
  return rasterClipPageNode(node, clipHudPanelLayoutCss(panel));
}

/** Draw the raster into a tiny canvas and see whether encoding it still works. */
export async function clipHudRasterUsable(canvas: HTMLCanvasElement): Promise<boolean> {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("canvas");
  const side = CLIP_HUD_PROBE_PX;
  probe.width = side;
  probe.height = side;
  const ctx = probe.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  try {
    ctx.drawImage(canvas, 0, 0, side, side);
    ctx.getImageData(0, 0, 1, 1);
  } catch {
    return false;
  }
  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      probe.toBlob((next) => resolve(next), "image/png");
    });
    if (!blob || blob.size === 0) return false;
  } catch {
    return false;
  }
  if (typeof VideoFrame !== "undefined") {
    try {
      const frame = new VideoFrame(probe, { timestamp: 0 });
      frame.close();
    } catch {
      return false;
    }
  }
  return true;
}

function panelNodes(host: ParentNode, panel: ClipHudPanel): HTMLElement[] {
  const root = host.querySelector<HTMLElement>(`[data-clip-panel="${panel}"]`);
  if (!root) return [];
  if (panel === CLIP_HUD_PANEL_ECO) {
    const columns = Array.from(root.querySelectorAll<HTMLElement>(".spec-eco"));
    if (columns.length > 0) return columns;
  }
  return [root];
}

function place(
  host: HTMLElement,
  node: HTMLElement,
  canvas: HTMLCanvasElement,
): PlacedImage | null {
  const hostBox = host.getBoundingClientRect();
  const box = node.getBoundingClientRect();
  if (box.width < 1 || box.height < 1) return null;
  return {
    canvas,
    x: box.left - hostBox.left,
    y: box.top - hostBox.top,
    w: box.width,
    h: box.height,
  };
}

class ClipPageHudSession implements ClipPageHudController {
  mode: ClipHudRenderer = "painted";
  private readonly ports: ClipPageHudPorts;
  private readonly replay: Replay;
  private readonly height: number;
  private slot: HTMLDivElement | null = null;
  private react: Root | null = null;
  private key: ClipPageHudKey | null = null;
  private images = new Map<ClipHudPanel, PlacedImage[]>();

  constructor(replay: Replay, height: number, ports?: Partial<ClipPageHudPorts>) {
    this.replay = replay;
    this.height = height;
    this.ports = {
      probe: ports?.probe ?? probeClipHudForeignObject,
      raster: ports?.raster ?? rasterPageNode,
      usable: ports?.usable ?? clipHudRasterUsable,
    };
  }

  async prepare(tick: number, selected: number | null): Promise<void> {
    try {
      this.mode = selectClipHudRenderer(await this.ports.probe());
    } catch {
      this.mode = "painted";
      return;
    }
    if (this.mode !== "page") return;
    try {
      this.mount();
      await this.sync(tick, selected, true);
      const sample = [...this.images.values()]
        .flat()
        .find((image) => image.canvas.width > 0)?.canvas;
      if (!sample || !(await this.ports.usable(sample))) {
        this.mode = "painted";
        this.clearDom();
      }
    } catch {
      this.mode = "painted";
      this.clearDom();
    }
  }

  async paint(ctx: HudDrawContext, tick: number, selected: number | null): Promise<void> {
    if (this.mode !== "page" || !this.slot) {
      this.paintFallback(ctx, tick);
      return;
    }
    try {
      await this.sync(tick, selected, false);
      const host = this.hostElement();
      if (!host) {
        this.paintFallback(ctx, tick);
        return;
      }
      for (const panel of PANEL_ORDER) {
        for (const image of this.images.get(panel) ?? []) {
          ctx.drawImage(image.canvas, image.x, image.y, image.w, image.h);
        }
      }
    } catch {
      this.paintFallback(ctx, tick);
    }
  }

  dispose(): void {
    this.clearDom();
    this.images.clear();
    this.key = null;
  }

  private mount(): void {
    if (typeof document === "undefined") {
      throw new Error("clip hud needs a document");
    }
    const frame = clipExportFrame(this.height);
    const slot = document.createElement("div");
    slot.className = "clip-page-host-slot";
    slot.inert = true;
    slot.setAttribute("inert", "");
    slot.setAttribute("aria-hidden", "true");
    slot.style.width = `${frame.width}px`;
    slot.style.height = `${frame.height}px`;
    document.body.appendChild(slot);
    this.slot = slot;
    this.react = createRoot(slot);
  }

  private hostElement(): HTMLElement | null {
    return this.slot?.querySelector<HTMLElement>(".clip-page-host") ?? null;
  }

  private render(tick: number, selected: number | null): void {
    if (!this.react) return;
    const frame = clipExportFrame(this.height);
    flushSync(() => {
      this.react?.render(
        createElement(ClipPageHud, {
          replay: this.replay,
          tick,
          selected,
          width: frame.width,
          height: frame.height,
        }),
      );
    });
  }

  private async sync(tick: number, selected: number | null, force: boolean): Promise<void> {
    const next = clipPageHudKey(this.replay, tick, selected);
    const dirty = force
      ? [CLIP_HUD_PANEL_HUD, CLIP_HUD_PANEL_ECO, CLIP_HUD_PANEL_SCORE]
      : clipHudPanelsToRaster(this.key, next);
    if (dirty.length === 0) return;
    this.render(tick, selected);
    const host = this.hostElement();
    if (!host) return;
    if (dirty.includes(CLIP_HUD_PANEL_SCORE)) fitClipScoreboard(host);
    await Promise.all(dirty.map((panel) => this.rasterPanel(host, panel)));
    this.key = next;
  }

  private async rasterPanel(host: HTMLElement, panel: ClipHudPanel): Promise<void> {
    const placed: PlacedImage[] = [];
    for (const node of panelNodes(host, panel)) {
      const box = node.getBoundingClientRect();
      if (box.width < 1 || box.height < 1) continue;
      const canvas = await this.ports.raster(node, panel);
      const image = place(host, node, canvas);
      if (image) placed.push(image);
    }
    this.images.set(panel, placed);
  }

  private paintFallback(ctx: HudDrawContext, tick: number): void {
    const frame = clipExportFrame(this.height);
    paintClipHud(ctx, this.replay, tick, clipHudLayout(frame.width, frame.height));
  }

  private clearDom(): void {
    this.react?.unmount();
    this.react = null;
    this.slot?.remove();
    this.slot = null;
  }
}

/** Build the offscreen page HUD. A failed probe or raster keeps the painted HUD. */
export async function beginClipPageHud(
  replay: Replay,
  height: number,
  tick: number,
  selected: number | null,
  ports?: Partial<ClipPageHudPorts>,
): Promise<ClipPageHudController> {
  const session = new ClipPageHudSession(replay, height, ports);
  try {
    await session.prepare(tick, selected);
  } catch {
    session.mode = "painted";
  }
  adoptClipPageHudSession(session);
  return session;
}
