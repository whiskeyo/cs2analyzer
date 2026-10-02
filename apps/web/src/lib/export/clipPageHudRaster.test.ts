import { describe, expect, it } from "vitest";
import { CLIP_HUD_PANEL_HUD, CLIP_HUD_PANEL_SCORE } from "@/lib/export/clipPageHudKey";
import {
  clipHudCssVariableText,
  clipHudPanelLayoutCss,
  clipPageHudSvg,
  collectDocumentCss,
  escapeClipHudCss,
} from "@/lib/export/clipPageHudRaster";

describe("clip page HUD raster", () => {
  it("escapes style text so it cannot close the SVG style tag", () => {
    const escaped = escapeClipHudCss(`a { content: "</style>"; background: url("a&b"); }`);
    expect(escaped).not.toContain("</");
    expect(escaped).toContain("&lt;/style>");
    expect(escaped).toContain("a&amp;b");
  });

  it("keeps the page score row when the HUD panel is rasterized", () => {
    const layout = clipHudPanelLayoutCss(CLIP_HUD_PANEL_HUD);
    expect(layout).toContain("flex-direction:row");
    expect(layout).toContain(".hud-score");
    expect(clipHudPanelLayoutCss(CLIP_HUD_PANEL_SCORE)).toBe("");
    const svg = clipPageHudSvg("", "<div class='radar-hud'></div>", 200, 40, "", layout);
    expect(svg).toContain("flex-direction:row");
  });

  it("embeds the stylesheet and the panel markup in one foreignObject", () => {
    const svg = clipPageHudSvg(".hud{color:red}", "<div>1:30</div>", 120, 40, "--bg:#0b0e12");
    expect(svg).toContain('width="120"');
    expect(svg).toContain('height="40"');
    expect(svg).toContain("<foreignObject");
    expect(svg).toContain(".hud{color:red}");
    expect(svg).toContain("--bg:#0b0e12");
    expect(svg).toContain("<div>1:30</div>");
    expect(svg.startsWith("<svg")).toBe(true);
  });

  it("reads only custom properties", () => {
    const style = {
      length: 3,
      item: (index: number) => ["color", "--bg", "--text"][index] ?? "",
      getPropertyValue: (name: string) => (name === "--bg" ? "#0b0e12" : "#fff"),
    } as CSSStyleDeclaration;
    expect(clipHudCssVariableText(style)).toBe("--bg:#0b0e12;--text:#fff");
  });

  it("skips a stylesheet that cannot be read and keeps the rest", () => {
    const doc = {
      styleSheets: [
        {
          get cssRules() {
            throw new DOMException("blocked");
          },
        },
        {
          cssRules: {
            length: 1,
            item: () => ({ cssText: ".hud{color:red}" }),
          },
        },
      ],
    } as unknown as Document;
    expect(collectDocumentCss(doc)).toBe(".hud{color:red}");
  });
});
