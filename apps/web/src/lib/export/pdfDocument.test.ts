import { inflateSync } from "node:zlib";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRef } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import {
  addPage,
  newPlaybook,
  setPageBody,
  setPageImages,
  setPageVideos,
} from "@/lib/playbook/pages";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import {
  PLAYBOOK_PDF_FLOOR_GAP,
  PLAYBOOK_PDF_FOOTER,
  PLAYBOOK_PDF_FOOTER_URL,
  PLAYBOOK_PDF_LIGHT_PAGE_BG,
  PLAYBOOK_PDF_LINE_GAP,
  PLAYBOOK_PDF_PAGE_BG,
  PLAYBOOK_PDF_MARGIN,
  PLAYBOOK_PDF_PHOTO_BACK,
  PLAYBOOK_PDF_PHOTO_BACK_ARROW_GAP,
  PLAYBOOK_PDF_PHOTO_BACK_ARROW_SIZE,
  PLAYBOOK_PDF_PIN_HIT_MIN,
  PLAYBOOK_PDF_SECTION_GAP,
  PLAYBOOK_PDF_SMALL_SIZE,
} from "./constants";
import {
  buildPlaybookPdf,
  centerOnContent,
  pdfSafeText,
  playbookRadarMaxSize,
  wrapPdfText,
} from "./pdfDocument";
import { playbookPdfPhotoBackPlacement } from "./playbookPdfPhotoBack";
import { formatPlaybookExportDate, playbookReport } from "./playbookReport";

const EXPORTED_AT = Date.UTC(2026, 8, 12, 15, 0, 0);

/** 1×1 PNG (red). */
const TINY_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function decodePdfHex(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  let out = "";
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out += String.fromCharCode(Number.parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

function decodeUtf16BeHex(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  const units: number[] = [];
  for (let i = 0; i + 3 < clean.length; i += 4) {
    units.push(Number.parseInt(clean.slice(i, i + 4), 16));
  }
  return String.fromCharCode(...units);
}

function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const pair of cmap.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
    map.set(Number.parseInt(pair[1] ?? "", 16), decodeUtf16BeHex(pair[2] ?? ""));
  }
  return map;
}

function decodeTj(hex: string, maps: Map<number, string>[]): string {
  const clean = hex.replace(/\s+/g, "");
  if (maps.length === 0 || clean.length % 4 !== 0) return decodePdfHex(clean);
  const outs: string[] = [];
  for (const map of maps) {
    let out = "";
    let mapped = 0;
    const total = clean.length / 4;
    for (let i = 0; i < clean.length; i += 4) {
      const cid = Number.parseInt(clean.slice(i, i + 4), 16);
      const ch = map.get(cid);
      if (ch == null) continue;
      out += ch;
      mapped += 1;
    }
    if (mapped === total && out !== "") outs.push(out);
  }
  if (outs.length > 0) return outs.join("\n");
  let out = "";
  let mapped = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const cid = Number.parseInt(clean.slice(i, i + 4), 16);
    const ch = maps.map((entry) => entry.get(cid)).find((value) => value != null);
    if (ch == null) continue;
    out += ch;
    mapped += 1;
  }
  return mapped > 0 ? out : decodePdfHex(clean);
}

/** Embedded-font `Tj` strings live in Flate streams. Slice by `/Length`, not `endstream`. */
function pdfDrawnText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  const latin1 = raw.toString("latin1");
  const maps: Map<number, string>[] = [];
  const texts: string[] = [];
  const headerRe = /\/Length\s+(\d+)[\s\S]*?stream\r?\n/g;
  for (const match of latin1.matchAll(headerRe)) {
    const length = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    if (!Number.isFinite(length) || start + length > raw.length) continue;
    try {
      const inflated = inflateSync(raw.subarray(start, start + length)).toString("latin1");
      if (inflated.includes("beginbfchar") || inflated.includes("begincmap")) {
        maps.push(parseToUnicode(inflated));
      }
    } catch {
      // image / already-raw stream
    }
  }
  for (const match of latin1.matchAll(headerRe)) {
    const length = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    if (!Number.isFinite(length) || start + length > raw.length) continue;
    try {
      const inflated = inflateSync(raw.subarray(start, start + length)).toString("latin1");
      if (inflated.includes("beginbfchar") || inflated.includes("begincmap")) continue;
      if (!/(?:Tj|TJ)\b/.test(inflated)) continue;
      for (const hex of inflated.matchAll(/<([0-9A-Fa-f]+)>/g)) {
        texts.push(decodeTj(hex[1] ?? "", maps));
      }
    } catch {
      // image / already-raw stream
    }
  }
  return texts.join("\n");
}

function pdfContentHasRgb(bytes: Uint8Array, color: { r: number; g: number; b: number }): boolean {
  const raw = Buffer.from(bytes);
  const latin1 = raw.toString("latin1");
  const headerRe = /\/Length\s+(\d+)[\s\S]*?stream\r?\n/g;
  const fills = /([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+rg/g;
  for (const match of latin1.matchAll(headerRe)) {
    const length = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    if (!Number.isFinite(length) || start + length > raw.length) continue;
    try {
      const inflated = inflateSync(raw.subarray(start, start + length)).toString("latin1");
      for (const fill of inflated.matchAll(fills)) {
        const red = Number(fill[1]);
        const green = Number(fill[2]);
        const blue = Number(fill[3]);
        if (
          Math.abs(red - color.r) < 0.002 &&
          Math.abs(green - color.g) < 0.002 &&
          Math.abs(blue - color.b) < 0.002
        ) {
          return true;
        }
      }
    } catch {
      // image / already-raw stream
    }
  }
  return false;
}

async function pdfLinkUris(bytes: Uint8Array): Promise<string[]> {
  const loaded = await PDFDocument.load(bytes);
  const uris: string[] = [];
  for (const page of loaded.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (const item of annots.asArray()) {
      const annot = page.doc.context.lookup(item);
      if (!(annot instanceof PDFDict)) continue;
      const actionRef = annot.get(PDFName.of("A"));
      const action = actionRef instanceof PDFDict ? actionRef : page.doc.context.lookup(actionRef);
      if (!(action instanceof PDFDict)) continue;
      const uriObj = action.get(PDFName.of("URI"));
      if (!uriObj || !("decodeText" in uriObj)) continue;
      uris.push((uriObj as { decodeText: () => string }).decodeText());
    }
  }
  return uris;
}

function destPageIndex(loaded: PDFDocument, destObj: unknown): number {
  const dest = destObj instanceof PDFRef ? loaded.context.lookup(destObj) : destObj;
  if (!(dest instanceof PDFArray)) return -1;
  const ref = dest.get(0);
  if (!(ref instanceof PDFRef)) return -1;
  return loaded.getPages().findIndex((page) => page.ref === ref);
}

function destTop(loaded: PDFDocument, destObj: unknown): number | null {
  const dest = destObj instanceof PDFRef ? loaded.context.lookup(destObj) : destObj;
  if (!(dest instanceof PDFArray)) return null;
  const y = dest.get(3);
  return y instanceof PDFNumber ? y.asNumber() : null;
}

async function pdfGoToPageIndexes(bytes: Uint8Array): Promise<number[]> {
  const loaded = await PDFDocument.load(bytes);
  const indexes: number[] = [];
  for (const page of loaded.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (const item of annots.asArray()) {
      const annot = loaded.context.lookup(item);
      if (!(annot instanceof PDFDict)) continue;
      const actionRef = annot.get(PDFName.of("A"));
      const action = actionRef instanceof PDFDict ? actionRef : loaded.context.lookup(actionRef);
      if (!(action instanceof PDFDict)) continue;
      if (String(action.get(PDFName.of("S"))) !== "/GoTo") continue;
      const index = destPageIndex(loaded, action.get(PDFName.of("D")));
      if (index >= 0) indexes.push(index);
    }
  }
  return indexes;
}

async function pdfGoToAnnots(
  bytes: Uint8Array,
): Promise<{ destPage: number; destY: number; width: number; height: number }[]> {
  const loaded = await PDFDocument.load(bytes);
  const out: { destPage: number; destY: number; width: number; height: number }[] = [];
  for (const page of loaded.getPages()) {
    const annots = page.node.Annots();
    if (!annots) continue;
    for (const item of annots.asArray()) {
      const annot = loaded.context.lookup(item);
      if (!(annot instanceof PDFDict)) continue;
      const actionRef = annot.get(PDFName.of("A"));
      const action = actionRef instanceof PDFDict ? actionRef : loaded.context.lookup(actionRef);
      if (!(action instanceof PDFDict)) continue;
      if (String(action.get(PDFName.of("S"))) !== "/GoTo") continue;
      const destPage = destPageIndex(loaded, action.get(PDFName.of("D")));
      const destY = destTop(loaded, action.get(PDFName.of("D")));
      const rect = annot.get(PDFName.of("Rect"));
      if (destPage < 0 || destY == null || !(rect instanceof PDFArray)) continue;
      const x0 = rect.get(0);
      const y0 = rect.get(1);
      const x1 = rect.get(2);
      const y1 = rect.get(3);
      if (
        !(x0 instanceof PDFNumber) ||
        !(y0 instanceof PDFNumber) ||
        !(x1 instanceof PDFNumber) ||
        !(y1 instanceof PDFNumber)
      ) {
        continue;
      }
      out.push({
        destPage,
        destY,
        width: Math.abs(x1.asNumber() - x0.asNumber()),
        height: Math.abs(y1.asNumber() - y0.asNumber()),
      });
    }
  }
  return out;
}

async function pdfOutlineTitles(bytes: Uint8Array): Promise<string[]> {
  const loaded = await PDFDocument.load(bytes);
  const outlinesRef = loaded.catalog.get(PDFName.of("Outlines"));
  if (!outlinesRef) return [];
  const outlines = loaded.context.lookup(outlinesRef);
  if (!(outlines instanceof PDFDict)) return [];
  const titles: string[] = [];
  let cursor = outlines.get(PDFName.of("First"));
  while (cursor) {
    const node = loaded.context.lookup(cursor);
    if (!(node instanceof PDFDict)) break;
    const titleObj = node.get(PDFName.of("Title"));
    if (titleObj && "decodeText" in titleObj) {
      titles.push((titleObj as { decodeText: () => string }).decodeText());
    }
    cursor = node.get(PDFName.of("Next"));
  }
  return titles;
}

describe("pdfSafeText", () => {
  it("maps punctuation and keeps Polish letters", () => {
    expect(pdfSafeText("It’s “mid” — go…")).toBe('It\'s "mid" - go...');
    expect(pdfSafeText("Łódź / zawinięcie")).toBe("Łódź / zawinięcie");
  });
});

describe("wrapPdfText", () => {
  it("wraps words to the given width", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont("Helvetica");
    const lines = wrapPdfText(font, "Smoke stairs then flash mid", 11, 80);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toContain("Smoke");
    expect(lines.join(" ")).toContain("mid");
  });

  it("splits a long token that does not fit a line", async () => {
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont("Helvetica");
    const lines = wrapPdfText(font, "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", 11, 40);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => font.widthOfTextAtSize(line, 11) <= 40)).toBe(true);
  });
});

function pdfImageCount(bytes: Uint8Array): number {
  return [
    ...Buffer.from(bytes)
      .toString("latin1")
      .matchAll(/\/Subtype\s*\/Image\b/g),
  ].length;
}

describe("buildPlaybookPdf", () => {
  it("writes a cover plus one page per strat", async () => {
    let book = newPlaybook("de_mirage", "A execs");
    const first = book.pages[0]!;
    book = setPageBody(book, first.id, "Smoke **stairs** and flash mid.");
    book = setPageVideos(book, first.id, [
      {
        id: "v1",
        videoId: "abcdefghijk",
        url: "https://www.youtube.com/watch?v=abcdefghijk",
        title: "Window lineup",
        x: 0,
        y: 0,
      },
    ]);
    book = addPage(book, "Mid control");
    book = {
      ...book,
      pages: book.pages.map((page) =>
        page.id === first.id ? { ...page, note: emptyNote() } : page,
      ),
    };
    const report = playbookReport(book, EXPORTED_AT);
    const bytes = await buildPlaybookPdf(report, {
      [first.id]: { upper: TINY_PNG },
    });
    expect(String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0)).toBe(
      "%PDF",
    );

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(3);
    const text = pdfDrawnText(bytes);
    expect(text).toContain("Mirage: A execs");
    expect(text).toContain(formatPlaybookExportDate(EXPORTED_AT));
    expect(text).toContain("Mid control");
    expect(text).toContain("Smoke **stairs** and flash mid.");
    expect(text).toContain("Window lineup");
    expect(text).toContain(PLAYBOOK_PDF_FOOTER);
    expect(text).not.toContain("Drawings stay on this machine");
    expect(await pdfLinkUris(bytes)).toEqual(loaded.getPages().map(() => PLAYBOOK_PDF_FOOTER_URL));
    expect(await pdfGoToPageIndexes(bytes)).toEqual([1, 2]);
    expect(await pdfOutlineTitles(bytes)).toEqual(["Untitled strat", "Mid control"]);
    expect(pdfContentHasRgb(bytes, PLAYBOOK_PDF_PAGE_BG)).toBe(true);
  });

  it("uses the light page fill when the theme is light", async () => {
    const book = newPlaybook("de_nuke", "default executes");
    const report = playbookReport(book, EXPORTED_AT);
    expect(report.heading).toBe("Nuke: default executes");
    const bytes = await buildPlaybookPdf(report, {}, "light");
    expect(pdfContentHasRgb(bytes, PLAYBOOK_PDF_LIGHT_PAGE_BG)).toBe(true);
    expect(pdfContentHasRgb(bytes, PLAYBOOK_PDF_PAGE_BG)).toBe(false);
  });

  it("paints Upper and Lower labels when both floor stills are present", async () => {
    const book = newPlaybook("de_nuke", "Nuke execs");
    const report = playbookReport(book, EXPORTED_AT);
    const pageId = report.pages[0]?.id ?? "";
    const bytes = await buildPlaybookPdf(report, {
      [pageId]: { upper: TINY_PNG, lower: TINY_PNG },
    });
    const text = pdfDrawnText(bytes);
    expect(text).toContain("Upper");
    expect(text).toContain("Lower");
  });

  it("sizes stacked floors from leftover page height, not half-width columns", () => {
    const contentWidth = 499;
    const budget = 600;
    const labeled = true;
    const slot = playbookRadarMaxSize(contentWidth, budget, 2, labeled);
    const labelH = PLAYBOOK_PDF_SMALL_SIZE + PLAYBOOK_PDF_LINE_GAP;
    const imgBudget = budget - 2 * labelH - PLAYBOOK_PDF_FLOOR_GAP - PLAYBOOK_PDF_SECTION_GAP;
    expect(slot.maxW).toBe(contentWidth);
    expect(slot.maxH).toBe(imgBudget / 2);
    expect(slot.maxH).toBeGreaterThan(contentWidth / 2);
    expect(centerOnContent(48, contentWidth, 300)).toBe(48 + (contentWidth - 300) / 2);
  });

  it("sits the back link in the left page margin next to the photo", () => {
    const photo = { y: 200, height: 240 };
    const labelWidth = 90;
    const labelSize = 10;
    const placed = playbookPdfPhotoBackPlacement(photo, labelWidth, labelSize);
    expect(placed.arrowY).toBe(placed.textY + labelWidth + PLAYBOOK_PDF_PHOTO_BACK_ARROW_GAP);
    expect(placed.height).toBe(
      labelWidth + PLAYBOOK_PDF_PHOTO_BACK_ARROW_GAP + PLAYBOOK_PDF_PHOTO_BACK_ARROW_SIZE,
    );
    expect(placed.x + placed.width).toBeLessThanOrEqual(PLAYBOOK_PDF_MARGIN);
    expect(placed.x).toBeGreaterThanOrEqual(0);
    expect(placed.y).toBeGreaterThanOrEqual(photo.y);
    expect(placed.y + placed.height).toBeLessThanOrEqual(photo.y + photo.height);
    expect(placed.width).toBe(labelSize);
  });

  it("round-trips Polish letters through the embedded font", async () => {
    let book = newPlaybook("de_mirage", "Łódź");
    const page = book.pages[0]!;
    book = setPageBody(book, page.id, "zawinięcie");
    const bytes = await buildPlaybookPdf(playbookReport(book, EXPORTED_AT));
    const text = pdfDrawnText(bytes);
    expect(text).toContain("Mirage: Łódź");
    expect(text).toContain("zawinięcie");
  });

  it("embeds local photos under the notes and keeps the radar still", async () => {
    let book = newPlaybook("de_mirage", "A execs");
    const page = book.pages[0]!;
    book = setPageImages(book, page.id, [
      {
        id: "img-1",
        name: "window-lineup.png",
        mime: "image/png",
        x: 10,
        y: 20,
      },
    ]);
    const report = playbookReport(book, EXPORTED_AT);
    const withPhoto = await buildPlaybookPdf(report, { [page.id]: { upper: TINY_PNG } }, "dark", {
      "img-1": TINY_PNG,
    });
    const stillOnly = await buildPlaybookPdf(report, { [page.id]: { upper: TINY_PNG } });
    expect(pdfDrawnText(withPhoto)).toContain("window-lineup.png");
    expect(pdfDrawnText(withPhoto)).toContain(PLAYBOOK_PDF_PHOTO_BACK);
    expect(pdfDrawnText(stillOnly)).not.toContain("window-lineup.png");
    expect(pdfDrawnText(stillOnly)).not.toContain(PLAYBOOK_PDF_PHOTO_BACK);
    expect(pdfImageCount(withPhoto)).toBeGreaterThan(pdfImageCount(stillOnly));
    expect(pdfImageCount(stillOnly)).toBeGreaterThan(0);
  });

  it("links each still pin to its photo and back to the strat", async () => {
    let book = newPlaybook("de_mirage", "A execs");
    const page = book.pages[0]!;
    book = setPageImages(book, page.id, [
      {
        id: "img-1",
        name: "window-lineup.png",
        mime: "image/png",
        x: 0,
        y: 0,
      },
    ]);
    const report = playbookReport(book, EXPORTED_AT);
    const bytes = await buildPlaybookPdf(
      report,
      { [page.id]: { upper: TINY_PNG } },
      "dark",
      { "img-1": TINY_PNG },
      UNIT_CALIBRATION,
    );
    expect(pdfDrawnText(bytes)).toContain(PLAYBOOK_PDF_PHOTO_BACK);
    const gotos = await pdfGoToAnnots(bytes);
    const stratPage = 1;
    const loaded = await PDFDocument.load(bytes);
    const stratTop = loaded.getPage(stratPage).getHeight();
    const pin = gotos.find((hit) => hit.width <= PLAYBOOK_PDF_PIN_HIT_MIN + 4);
    const back = gotos.find(
      (hit) =>
        hit.destPage === stratPage &&
        hit.destY === stratTop &&
        hit.width <= PLAYBOOK_PDF_SMALL_SIZE + 2 &&
        hit.height > 40,
    );
    expect(pin).toBeDefined();
    expect(pin?.destY).toBeLessThan(loaded.getPage(pin?.destPage ?? 0).getHeight());
    expect(pin?.destPage !== stratPage || (pin?.destY ?? stratTop) < stratTop).toBe(true);
    expect(back).toBeDefined();
    expect(await pdfGoToPageIndexes(bytes)).toContain(stratPage);
  });

  it("still builds when a snapshot is not a PNG", async () => {
    const book = newPlaybook("de_inferno", "Defaults");
    const report = playbookReport(book, EXPORTED_AT);
    const pageId = report.pages[0]?.id ?? "";
    const bytes = await buildPlaybookPdf(report, {
      [pageId]: { upper: new Uint8Array([1, 2, 3]) },
    });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(2);
  });
});
