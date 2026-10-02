import {
  CLIP_HUD_PANEL_HUD,
  CLIP_HUD_PANEL_SCORE,
  type ClipHudPanel,
} from "@/lib/export/clipPageHudKey";

/**
 * Draw a clip HUD panel through an SVG `foreignObject`.
 *
 * Copying every computed style made a full-round export about three times
 * the painted HUD. The page stylesheet is serialized once and
 * weapon icons are cached as data URLs, so a later panel with the same CSS
 * is only a clone plus a decode.
 */

const imageDataUrls = new Map<string, Promise<string>>();
let cachedCss: string | null = null;

export function resetClipPageHudRasterCache(): void {
  imageDataUrls.clear();
  cachedCss = null;
}

/** Keep a `<style>` body from closing the tag or breaking the SVG XML. */
export function escapeClipHudCss(css: string): string {
  return css.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
}

/** Custom properties from `getComputedStyle(documentElement)`, as a declaration list. */
export function clipHudCssVariableText(style: CSSStyleDeclaration): string {
  const parts: string[] = [];
  for (let i = 0; i < style.length; i += 1) {
    const name = style.item(i);
    if (!name.startsWith("--")) continue;
    parts.push(`${name}:${style.getPropertyValue(name)}`);
  }
  return parts.join(";");
}

function appendCssRules(rules: CSSRuleList, out: string[]): void {
  for (let i = 0; i < rules.length; i += 1) {
    const rule = rules.item(i);
    if (!rule) continue;
    if (typeof CSSRule !== "undefined" && rule.type === CSSRule.IMPORT_RULE) {
      const sheet = (rule as CSSImportRule).styleSheet;
      if (sheet) appendCssRules(sheet.cssRules, out);
      continue;
    }
    out.push(rule.cssText);
  }
}

export function collectDocumentCss(doc: Document): string {
  const out: string[] = [];
  for (const sheet of doc.styleSheets) {
    try {
      appendCssRules(sheet.cssRules, out);
    } catch {
      // A cross-origin sheet cannot be read. The painted HUD is the fallback.
    }
  }
  return out.join("\n");
}

function documentCss(): string {
  if (cachedCss == null) cachedCss = collectDocumentCss(document);
  return cachedCss;
}

/**
 * Desktop HUD rules for the raster.
 * The SVG viewport is the panel, so `@media (max-width: 900px)` would
 * left-align the score and the round clock used to sit on that line.
 * The page Hud is a centered row: team score, alive count, team score.
 */
const HUD_LAYOUT_CSS = [
  ".radar-hud{position:relative !important;top:auto !important;left:auto !important;right:auto !important;transform:none !important;",
  "display:flex !important;flex-direction:column !important;align-items:center !important;text-align:center !important;",
  "width:max-content !important;max-width:100% !important;gap:0.25rem !important}",
  ".hud-score{display:flex !important;flex-direction:row !important;flex-wrap:nowrap !important;",
  "align-items:baseline !important;gap:0.7rem !important;white-space:nowrap !important}",
].join("");

/**
 * The scoreboard SVG is sidebar-width, so the 900px rule's `max-height: 40vh`
 * was cutting Team Vitality off. Stretch the column to the measured slot.
 */
const SCORE_LAYOUT_CSS = [
  ".sidebar{display:flex !important;flex-direction:column !important;max-height:none !important;",
  "height:100% !important;overflow:hidden !important;grid-template-rows:none !important}",
  ".tabs{flex:0 0 auto !important}",
  ".sidebar-body{display:block !important;flex:1 1 auto !important;min-height:0 !important;",
  "max-height:none !important;overflow:hidden !important}",
].join("");

export function clipHudPanelLayoutCss(panel: ClipHudPanel): string {
  if (panel === CLIP_HUD_PANEL_HUD) return HUD_LAYOUT_CSS;
  if (panel === CLIP_HUD_PANEL_SCORE) return SCORE_LAYOUT_CSS;
  return "";
}

/**
 * Shrink the scoreboard table so both teams fit in the sidebar body.
 * Returns 1 when the rows already fit.
 */
export function fitClipScoreboard(host: ParentNode): number {
  const body = host.querySelector(".sidebar-body");
  const content = body?.firstElementChild;
  if (!(body instanceof HTMLElement) || !(content instanceof HTMLElement)) return 1;
  content.style.transform = "";
  content.style.width = "";
  const available = body.clientHeight;
  const needed = content.scrollHeight;
  if (available < 1 || needed <= available) return 1;
  const scale = available / needed;
  content.style.transformOrigin = "top left";
  content.style.transform = `scale(${scale})`;
  content.style.width = `${(1 / scale) * 100}%`;
  return scale;
}

/**
 * SVG document for one panel. `markup` is the panel's XHTML.
 * The wrapper is the containing block so an absolutely positioned panel
 * (spectator column, top HUD) stays inside the bitmap we measured.
 */
export function clipPageHudSvg(
  css: string,
  markup: string,
  width: number,
  height: number,
  variables: string,
  layoutCss = "",
): string {
  const style = escapeClipHudCss(css);
  const vars = escapeClipHudCss(variables);
  const layout = escapeClipHudCss(layoutCss);
  const box = `width:${width}px;height:${height}px;margin:0;padding:0;position:relative;overflow:hidden;`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">`,
    `<foreignObject x="0" y="0" width="${width}" height="${height}">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" class="clip-hud-raster-root" style="${box}">`,
    `<style>${style}</style>`,
    `<style>.clip-hud-raster-root{${vars}}</style>`,
    layout ? `<style>${layout}</style>` : "",
    markup,
    "</div></foreignObject></svg>",
  ].join("");
}

function pinRasterRoot(clone: HTMLElement, width: number, height: number): void {
  clone.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
  const reset: [string, string][] = [
    ["position", "relative"],
    ["top", "0"],
    ["right", "auto"],
    ["bottom", "auto"],
    ["left", "0"],
    ["margin", "0"],
    ["transform", "none"],
    ["width", `${width}px`],
    ["height", `${height}px`],
  ];
  for (const [name, value] of reset) {
    clone.style.setProperty(name, value, "important");
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("clip hud image"));
    reader.readAsDataURL(blob);
  });
}

function cachedImageDataUrl(src: string): Promise<string> {
  const abs = new URL(src, window.location.href).href;
  const existing = imageDataUrls.get(abs);
  if (existing) return existing;
  const pending = fetch(abs).then((res) => {
    if (!res.ok) {
      imageDataUrls.delete(abs);
      throw new Error("clip hud image");
    }
    return res.blob().then(blobToDataUrl);
  });
  imageDataUrls.set(abs, pending);
  return pending;
}

async function inlineImages(root: ParentNode): Promise<void> {
  const images = [...root.querySelectorAll("img")];
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute("src");
      if (!src || src.startsWith("data:")) return;
      try {
        img.setAttribute("src", await cachedImageDataUrl(src));
      } catch {
        img.removeAttribute("src");
      }
    }),
  );
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("foreignObject image failed"));
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Raster one HUD panel. Throws when the foreignObject image cannot be drawn. */
export async function rasterClipPageNode(
  node: HTMLElement,
  layoutCss = "",
): Promise<HTMLCanvasElement> {
  const box = node.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(box.width));
  const height = Math.max(1, Math.ceil(box.height));
  const clone = node.cloneNode(true);
  if (!(clone instanceof HTMLElement)) {
    throw new Error("clip hud node");
  }
  pinRasterRoot(clone, width, height);
  await inlineImages(clone);
  const variables = clipHudCssVariableText(getComputedStyle(document.documentElement));
  const svg = clipPageHudSvg(
    documentCss(),
    new XMLSerializer().serializeToString(clone),
    width,
    height,
    variables,
    layoutCss,
  );
  const image = await loadSvgImage(svg);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("clip hud canvas");
  ctx.drawImage(image, 0, 0, width, height);
  return canvas;
}
