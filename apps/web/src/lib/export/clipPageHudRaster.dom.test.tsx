import { afterEach, describe, expect, it, vi } from "vitest";
import {
  rasterClipPageNode,
  resetClipPageHudCssCache,
  resetClipPageHudRasterCache,
} from "@/lib/export/clipPageHudRaster";

afterEach(() => {
  resetClipPageHudRasterCache();
  vi.restoreAllMocks();
});

describe("clip page HUD raster clone", () => {
  it("clones the panel and leaves the hidden slot out of the bitmap", async () => {
    const slot = document.createElement("div");
    slot.className = "clip-page-host-slot";
    slot.style.opacity = "0";
    const panel = document.createElement("div");
    panel.className = "radar-hud";
    panel.textContent = "5 – 5";
    slot.appendChild(panel);
    document.body.appendChild(slot);
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 40,
      bottom: 20,
      width: 40,
      height: 20,
      toJSON() {
        return {};
      },
    });
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

    try {
      const canvas = await rasterClipPageNode(panel);
      expect(canvas.width).toBe(40);
      expect(canvas.height).toBe(20);
      expect(markup).toHaveLength(1);
      const clone = markup[0];
      expect(clone).toBeInstanceOf(HTMLElement);
      expect(clone).not.toBe(slot);
      expect(clone).not.toBe(panel);
      expect((clone as HTMLElement).className).toBe("radar-hud");
      expect((clone as HTMLElement).textContent).toBe("5 – 5");
      expect((clone as HTMLElement).style.opacity).not.toBe("0");
      expect(serialize.call(new XMLSerializer(), clone as Node)).not.toContain(
        "clip-page-host-slot",
      );
    } finally {
      slot.remove();
      if (src) Object.defineProperty(HTMLImageElement.prototype, "src", src);
    }
  });

  it("embeds stylesheets added after the previous export once the cache is cleared", async () => {
    resetClipPageHudCssCache();
    const panel = document.createElement("div");
    panel.textContent = "hud";
    vi.spyOn(panel, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 40,
      bottom: 20,
      width: 40,
      height: 20,
      toJSON() {
        return {};
      },
    });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage() {
        return undefined;
      },
    } as unknown as CanvasRenderingContext2D);
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    let svg = "";
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      get() {
        return "";
      },
      set(this: HTMLImageElement, value: string) {
        const prefix = "data:image/svg+xml;charset=utf-8,";
        svg = decodeURIComponent(value.slice(prefix.length));
        queueMicrotask(() => {
          this.onload?.(new Event("load"));
        });
      },
    });
    const first = document.createElement("style");
    first.textContent = ".clip-export-css-a{color:red}";
    const extra = document.createElement("style");
    extra.textContent = ".clip-export-css-b{color:blue}";
    document.head.append(first, extra);
    extra.remove();
    try {
      await rasterClipPageNode(panel);
      expect(svg).toContain("clip-export-css-a");
      expect(svg).not.toContain("clip-export-css-b");
      document.head.appendChild(extra);
      await rasterClipPageNode(panel);
      expect(svg).not.toContain("clip-export-css-b");
      resetClipPageHudCssCache();
      await rasterClipPageNode(panel);
      expect(svg).toContain("clip-export-css-a");
      expect(svg).toContain("clip-export-css-b");
    } finally {
      first.remove();
      extra.remove();
      if (src) Object.defineProperty(HTMLImageElement.prototype, "src", src);
    }
  });
});
