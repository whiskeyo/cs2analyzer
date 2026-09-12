import { inflateSync } from "node:zlib";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { addPage, newPlaybook, setPageBody, setPageVideos } from "@/lib/playbook/pages";
import {
  PLAYBOOK_PDF_FOOTER,
  PLAYBOOK_PDF_FOOTER_URL,
  PLAYBOOK_PDF_LIGHT_PAGE_BG,
  PLAYBOOK_PDF_PAGE_BG,
} from "./constants";
import { buildPlaybookPdf, pdfSafeText, wrapPdfText } from "./pdfDocument";
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

/** Helvetica `Tj` strings live in Flate streams. Slice by `/Length`, not `endstream`. */
function pdfDrawnText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  const latin1 = raw.toString("latin1");
  const texts: string[] = [];
  const headerRe = /\/Length\s+(\d+)[\s\S]*?stream\r?\n/g;
  for (const match of latin1.matchAll(headerRe)) {
    const length = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    if (!Number.isFinite(length) || start + length > raw.length) continue;
    try {
      const inflated = inflateSync(raw.subarray(start, start + length)).toString("latin1");
      for (const hex of inflated.matchAll(/<([0-9A-Fa-f]+)>/g)) {
        texts.push(decodePdfHex(hex[1] ?? ""));
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
  it("maps common punctuation to WinAnsi", () => {
    expect(pdfSafeText("It’s “mid” — go…")).toBe('It\'s "mid" - go...');
    expect(pdfSafeText("łódź")).toBe("d");
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

describe("buildPlaybookPdf", () => {
  it("writes a cover plus one page per strat", async () => {
    let book = newPlaybook("de_mirage", "A execs");
    const first = book.pages[0]!;
    book = setPageBody(book, first.id, "Smoke **stairs** and *flash* __mid__.");
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
    expect(text).toContain("Smoke");
    expect(text).toContain("stairs");
    expect(text).toContain("flash");
    expect(text).toContain("mid");
    expect(text).not.toContain("**");
    expect(text).not.toContain("__");
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
