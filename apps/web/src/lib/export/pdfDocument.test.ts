import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { addPage, newPlaybook, setPageBody, setPageVideos } from "@/lib/playbook/pages";
import { PLAYBOOK_PDF_FOOTER } from "./constants";
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
    book = setPageBody(book, first.id, "Smoke stairs.");
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
    const bytes = await buildPlaybookPdf(report, { [first.id]: TINY_PNG });
    expect(String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0)).toBe(
      "%PDF",
    );

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(3);
    const text = pdfDrawnText(bytes);
    expect(text).toContain("A execs");
    expect(text).toContain("Mirage");
    expect(text).toContain(formatPlaybookExportDate(EXPORTED_AT));
    expect(text).toContain("Mid control");
    expect(text).toContain("Smoke stairs.");
    expect(text).toContain("Window lineup");
    expect(text).toContain(PLAYBOOK_PDF_FOOTER);
  });

  it("still builds when a snapshot is not a PNG", async () => {
    const book = newPlaybook("de_inferno", "Defaults");
    const report = playbookReport(book, EXPORTED_AT);
    const pageId = report.pages[0]?.id ?? "";
    const bytes = await buildPlaybookPdf(report, { [pageId]: new Uint8Array([1, 2, 3]) });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(2);
  });
});
