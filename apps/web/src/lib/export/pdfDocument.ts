import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import {
  PLAYBOOK_PDF_BODY_SIZE,
  PLAYBOOK_PDF_FOOTER,
  PLAYBOOK_PDF_FOOTER_SIZE,
  PLAYBOOK_PDF_HEADING_SIZE,
  PLAYBOOK_PDF_LINE_GAP,
  PLAYBOOK_PDF_MARGIN,
  PLAYBOOK_PDF_RADAR_MAX_PT,
  PLAYBOOK_PDF_SECTION_GAP,
  PLAYBOOK_PDF_SMALL_SIZE,
  PLAYBOOK_PDF_TITLE_SIZE,
} from "./constants";
import type { PlaybookReport, PlaybookReportPage } from "./playbookReport";

export type PlaybookPdfSnapshots = Readonly<Record<string, Uint8Array>>;

interface PdfLib {
  PDFDocument: (typeof import("pdf-lib"))["PDFDocument"];
  StandardFonts: (typeof import("pdf-lib"))["StandardFonts"];
  PageSizes: (typeof import("pdf-lib"))["PageSizes"];
  rgb: (typeof import("pdf-lib"))["rgb"];
}

interface DocFonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface Palette {
  ink: RGB;
  muted: RGB;
}

interface Layout {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
  contentWidth: number;
}

interface Writer {
  page: PDFPage;
  y: number;
  fonts: DocFonts;
  colors: Palette;
  layout: Layout;
  footer: string;
  addPage: () => PDFPage;
}

/** Drop characters Helvetica cannot encode (keep ASCII + common punctuation). */
export function pdfSafeText(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\n\r\t\x20-\x7E]/g, "");
}

export function wrapPdfText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of pdfSafeText(text).split(/\r?\n/)) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/).filter((word) => word !== "");
    let line = "";
    for (const word of words) {
      const pieces = splitLongWord(font, word, size, maxWidth);
      for (const piece of pieces) {
        const next = line === "" ? piece : `${line} ${piece}`;
        if (font.widthOfTextAtSize(next, size) <= maxWidth) {
          line = next;
        } else {
          if (line !== "") lines.push(line);
          line = piece;
        }
      }
    }
    if (line !== "") lines.push(line);
  }
  return lines;
}

function splitLongWord(font: PDFFont, word: string, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
  const parts: string[] = [];
  let chunk = "";
  for (const ch of word) {
    const next = `${chunk}${ch}`;
    if (chunk !== "" && font.widthOfTextAtSize(next, size) > maxWidth) {
      parts.push(chunk);
      chunk = ch;
    } else {
      chunk = next;
    }
  }
  if (chunk !== "") parts.push(chunk);
  return parts;
}

function lineHeight(size: number): number {
  return size + PLAYBOOK_PDF_LINE_GAP;
}

function makeLayout(width: number, height: number): Layout {
  const left = PLAYBOOK_PDF_MARGIN;
  const right = width - PLAYBOOK_PDF_MARGIN;
  return {
    width,
    height,
    left,
    right,
    top: height - PLAYBOOK_PDF_MARGIN,
    bottom: PLAYBOOK_PDF_MARGIN,
    contentWidth: right - left,
  };
}

function paintFooter(page: PDFPage, layout: Layout, font: PDFFont, color: RGB, text: string): void {
  page.drawText(pdfSafeText(text), {
    x: layout.left,
    y: layout.bottom - PLAYBOOK_PDF_FOOTER_SIZE,
    size: PLAYBOOK_PDF_FOOTER_SIZE,
    font,
    color,
  });
}

function ensureSpace(writer: Writer, needed: number): void {
  if (writer.y - needed >= writer.layout.bottom) return;
  writer.page = writer.addPage();
  paintFooter(writer.page, writer.layout, writer.fonts.regular, writer.colors.muted, writer.footer);
  writer.y = writer.layout.top;
}

function drawLines(writer: Writer, lines: string[], size: number, font: PDFFont, color: RGB): void {
  const height = lineHeight(size);
  for (const line of lines) {
    ensureSpace(writer, height);
    if (line !== "") {
      writer.page.drawText(line, {
        x: writer.layout.left,
        y: writer.y - size,
        size,
        font,
        color,
      });
    }
    writer.y -= height;
  }
}

function drawGap(writer: Writer, gap = PLAYBOOK_PDF_SECTION_GAP): void {
  writer.y -= gap;
}

async function embedSnapshots(
  pdf: import("pdf-lib").PDFDocument,
  snapshots: PlaybookPdfSnapshots,
): Promise<Map<string, PDFImage>> {
  const images = new Map<string, PDFImage>();
  for (const [id, bytes] of Object.entries(snapshots)) {
    if (bytes.byteLength === 0) continue;
    try {
      images.set(id, await pdf.embedPng(bytes));
    } catch {
      // Skip a still that is not a PNG; the strat page still has title and notes.
    }
  }
  return images;
}

function drawCover(writer: Writer, report: PlaybookReport): void {
  drawLines(
    writer,
    ["cs2analyzer playbook"],
    PLAYBOOK_PDF_SMALL_SIZE,
    writer.fonts.regular,
    writer.colors.muted,
  );
  drawGap(writer, 8);
  drawLines(
    writer,
    wrapPdfText(
      writer.fonts.bold,
      report.title,
      PLAYBOOK_PDF_TITLE_SIZE,
      writer.layout.contentWidth,
    ),
    PLAYBOOK_PDF_TITLE_SIZE,
    writer.fonts.bold,
    writer.colors.ink,
  );
  drawGap(writer, 8);
  drawLines(
    writer,
    [report.mapLabel],
    PLAYBOOK_PDF_HEADING_SIZE,
    writer.fonts.regular,
    writer.colors.ink,
  );
  drawLines(
    writer,
    [report.exportedOn],
    PLAYBOOK_PDF_BODY_SIZE,
    writer.fonts.regular,
    writer.colors.muted,
  );
  drawGap(writer);
  drawLines(writer, ["Strats"], PLAYBOOK_PDF_BODY_SIZE, writer.fonts.bold, writer.colors.ink);
  const items = report.pages.map((page, index) => `${index + 1}. ${page.title}`);
  drawLines(
    writer,
    wrapPdfText(
      writer.fonts.regular,
      items.join("\n"),
      PLAYBOOK_PDF_BODY_SIZE,
      writer.layout.contentWidth,
    ),
    PLAYBOOK_PDF_BODY_SIZE,
    writer.fonts.regular,
    writer.colors.ink,
  );
}

function drawRadar(writer: Writer, image: PDFImage | undefined): void {
  if (!image) return;
  const maxW = writer.layout.contentWidth;
  const maxH = PLAYBOOK_PDF_RADAR_MAX_PT;
  const dims = image.scaleToFit(maxW, maxH);
  ensureSpace(writer, dims.height + PLAYBOOK_PDF_SECTION_GAP);
  writer.page.drawImage(image, {
    x: writer.layout.left,
    y: writer.y - dims.height,
    width: dims.width,
    height: dims.height,
  });
  writer.y -= dims.height + PLAYBOOK_PDF_SECTION_GAP;
}

function drawStrat(
  writer: Writer,
  report: PlaybookReport,
  page: PlaybookReportPage,
  image: PDFImage | undefined,
): void {
  writer.page = writer.addPage();
  paintFooter(writer.page, writer.layout, writer.fonts.regular, writer.colors.muted, writer.footer);
  writer.y = writer.layout.top;
  drawLines(
    writer,
    wrapPdfText(
      writer.fonts.regular,
      `${report.title} · ${report.mapLabel}`,
      PLAYBOOK_PDF_SMALL_SIZE,
      writer.layout.contentWidth,
    ),
    PLAYBOOK_PDF_SMALL_SIZE,
    writer.fonts.regular,
    writer.colors.muted,
  );
  drawGap(writer, 8);
  drawLines(
    writer,
    wrapPdfText(
      writer.fonts.bold,
      page.title,
      PLAYBOOK_PDF_HEADING_SIZE,
      writer.layout.contentWidth,
    ),
    PLAYBOOK_PDF_HEADING_SIZE,
    writer.fonts.bold,
    writer.colors.ink,
  );
  drawGap(writer, 8);
  drawRadar(writer, image);
  if (page.body !== "") {
    drawLines(
      writer,
      wrapPdfText(
        writer.fonts.regular,
        page.body,
        PLAYBOOK_PDF_BODY_SIZE,
        writer.layout.contentWidth,
      ),
      PLAYBOOK_PDF_BODY_SIZE,
      writer.fonts.regular,
      writer.colors.ink,
    );
    drawGap(writer, 8);
  }
  for (const clip of page.clips) {
    const caption = clip.title === "" ? clip.url : `${clip.title} — ${clip.url}`;
    drawLines(
      writer,
      wrapPdfText(
        writer.fonts.regular,
        caption,
        PLAYBOOK_PDF_SMALL_SIZE,
        writer.layout.contentWidth,
      ),
      PLAYBOOK_PDF_SMALL_SIZE,
      writer.fonts.regular,
      writer.colors.muted,
    );
  }
}

export async function buildPlaybookPdf(
  report: PlaybookReport,
  snapshots: PlaybookPdfSnapshots = {},
): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, PageSizes, rgb } = (await import("pdf-lib")) as PdfLib;
  const pdf = await PDFDocument.create();
  const fonts: DocFonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const colors: Palette = {
    ink: rgb(0.09, 0.11, 0.14),
    muted: rgb(0.38, 0.42, 0.46),
  };
  const [pageWidth, pageHeight] = PageSizes.A4;
  const layout = makeLayout(pageWidth, pageHeight);
  const footer = `${PLAYBOOK_PDF_FOOTER} · ${report.exportedOn}`;
  const images = await embedSnapshots(pdf, snapshots);

  const addPage = () => pdf.addPage(PageSizes.A4);
  const first = addPage();
  paintFooter(first, layout, fonts.regular, colors.muted, footer);
  const writer: Writer = {
    page: first,
    y: layout.top,
    fonts,
    colors,
    layout,
    footer,
    addPage,
  };
  drawCover(writer, report);
  for (const page of report.pages) {
    drawStrat(writer, report, page, images.get(page.id));
  }
  return pdf.save();
}
