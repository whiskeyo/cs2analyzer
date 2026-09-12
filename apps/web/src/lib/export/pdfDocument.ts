import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import {
  PLAYBOOK_PDF_BODY_SIZE,
  PLAYBOOK_PDF_FLOOR_GAP,
  PLAYBOOK_PDF_FLOOR_LABEL_LOWER,
  PLAYBOOK_PDF_FLOOR_LABEL_UPPER,
  PLAYBOOK_PDF_FOOTER,
  PLAYBOOK_PDF_FOOTER_SIZE,
  PLAYBOOK_PDF_FOOTER_URL,
  PLAYBOOK_PDF_HEADING_SIZE,
  PLAYBOOK_PDF_INK,
  PLAYBOOK_PDF_LINE_GAP,
  PLAYBOOK_PDF_MARGIN,
  PLAYBOOK_PDF_MUTED,
  PLAYBOOK_PDF_PAGE_BG,
  PLAYBOOK_PDF_RADAR_MAX_PT,
  PLAYBOOK_PDF_SECTION_GAP,
  PLAYBOOK_PDF_SMALL_SIZE,
  PLAYBOOK_PDF_TITLE_SIZE,
} from "./constants";
import type { PlaybookReport, PlaybookReportPage } from "./playbookReport";

export interface PlaybookPageStills {
  readonly upper?: Uint8Array;
  readonly lower?: Uint8Array;
}

export type PlaybookPdfSnapshots = Readonly<Record<string, PlaybookPageStills>>;

interface PdfLib {
  PDFDocument: (typeof import("pdf-lib"))["PDFDocument"];
  PDFString: (typeof import("pdf-lib"))["PDFString"];
  StandardFonts: (typeof import("pdf-lib"))["StandardFonts"];
  PageSizes: (typeof import("pdf-lib"))["PageSizes"];
  rgb: (typeof import("pdf-lib"))["rgb"];
}

interface DocFonts {
  regular: PDFFont;
  bold: PDFFont;
}

interface Palette {
  bg: RGB;
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

interface EmbeddedStills {
  upper?: PDFImage;
  lower?: PDFImage;
}

interface Writer {
  page: PDFPage;
  y: number;
  fonts: DocFonts;
  colors: Palette;
  layout: Layout;
  footer: string;
  footerUri: string;
  PDFString: PdfLib["PDFString"];
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

function addUriLink(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  uri: string,
  PDFString: PdfLib["PDFString"],
): void {
  const annot = page.doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x, y, x + width, y + height],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFString.of(uri),
    },
  });
  page.node.addAnnot(page.doc.context.register(annot));
}

function paintFooter(writer: Writer, page: PDFPage): void {
  const text = pdfSafeText(writer.footer);
  const size = PLAYBOOK_PDF_FOOTER_SIZE;
  const x = writer.layout.left;
  const y = writer.layout.bottom - size;
  page.drawText(text, {
    x,
    y,
    size,
    font: writer.fonts.regular,
    color: writer.colors.muted,
  });
  addUriLink(
    page,
    x,
    y,
    writer.fonts.regular.widthOfTextAtSize(text, size),
    size + PLAYBOOK_PDF_LINE_GAP,
    writer.footerUri,
    writer.PDFString,
  );
}

function paintPageChrome(writer: Writer, page: PDFPage): void {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: writer.layout.width,
    height: writer.layout.height,
    color: writer.colors.bg,
  });
  paintFooter(writer, page);
}

function ensureSpace(writer: Writer, needed: number): void {
  if (writer.y - needed >= writer.layout.bottom) return;
  writer.page = writer.addPage();
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

async function embedPng(
  pdf: import("pdf-lib").PDFDocument,
  bytes: Uint8Array | undefined,
): Promise<PDFImage | undefined> {
  if (!bytes || bytes.byteLength === 0) return undefined;
  try {
    return await pdf.embedPng(bytes);
  } catch {
    return undefined;
  }
}

async function embedSnapshots(
  pdf: import("pdf-lib").PDFDocument,
  snapshots: PlaybookPdfSnapshots,
): Promise<Map<string, EmbeddedStills>> {
  const images = new Map<string, EmbeddedStills>();
  for (const [id, stills] of Object.entries(snapshots)) {
    const embedded: EmbeddedStills = {
      upper: await embedPng(pdf, stills.upper),
      lower: await embedPng(pdf, stills.lower),
    };
    if (embedded.upper || embedded.lower) images.set(id, embedded);
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

function drawOneRadar(
  writer: Writer,
  image: PDFImage,
  x: number,
  maxW: number,
  maxH: number,
): number {
  const dims = image.scaleToFit(maxW, maxH);
  writer.page.drawImage(image, {
    x,
    y: writer.y - dims.height,
    width: dims.width,
    height: dims.height,
  });
  return dims.height;
}

function drawRadars(writer: Writer, stills: EmbeddedStills | undefined): void {
  if (!stills?.upper && !stills?.lower) return;
  if (!stills.lower) {
    if (!stills.upper) return;
    const dims = stills.upper.scaleToFit(writer.layout.contentWidth, PLAYBOOK_PDF_RADAR_MAX_PT);
    ensureSpace(writer, dims.height + PLAYBOOK_PDF_SECTION_GAP);
    drawOneRadar(
      writer,
      stills.upper,
      writer.layout.left,
      writer.layout.contentWidth,
      PLAYBOOK_PDF_RADAR_MAX_PT,
    );
    writer.y -= dims.height + PLAYBOOK_PDF_SECTION_GAP;
    return;
  }
  const labelSize = PLAYBOOK_PDF_SMALL_SIZE;
  const labelH = lineHeight(labelSize);
  const colW = (writer.layout.contentWidth - PLAYBOOK_PDF_FLOOR_GAP) / 2;
  const upperDims = stills.upper?.scaleToFit(colW, PLAYBOOK_PDF_RADAR_MAX_PT);
  const lowerDims = stills.lower.scaleToFit(colW, PLAYBOOK_PDF_RADAR_MAX_PT);
  const imgH = Math.max(upperDims?.height ?? 0, lowerDims.height);
  ensureSpace(writer, labelH + imgH + PLAYBOOK_PDF_SECTION_GAP);
  writer.page.drawText(PLAYBOOK_PDF_FLOOR_LABEL_UPPER, {
    x: writer.layout.left,
    y: writer.y - labelSize,
    size: labelSize,
    font: writer.fonts.regular,
    color: writer.colors.muted,
  });
  writer.page.drawText(PLAYBOOK_PDF_FLOOR_LABEL_LOWER, {
    x: writer.layout.left + colW + PLAYBOOK_PDF_FLOOR_GAP,
    y: writer.y - labelSize,
    size: labelSize,
    font: writer.fonts.regular,
    color: writer.colors.muted,
  });
  writer.y -= labelH;
  if (stills.upper) {
    drawOneRadar(writer, stills.upper, writer.layout.left, colW, PLAYBOOK_PDF_RADAR_MAX_PT);
  }
  drawOneRadar(
    writer,
    stills.lower,
    writer.layout.left + colW + PLAYBOOK_PDF_FLOOR_GAP,
    colW,
    PLAYBOOK_PDF_RADAR_MAX_PT,
  );
  writer.y -= imgH + PLAYBOOK_PDF_SECTION_GAP;
}

function drawStrat(
  writer: Writer,
  report: PlaybookReport,
  page: PlaybookReportPage,
  stills: EmbeddedStills | undefined,
): void {
  writer.page = writer.addPage();
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
  drawRadars(writer, stills);
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
  const { PDFDocument, PDFString, StandardFonts, PageSizes, rgb } =
    (await import("pdf-lib")) as PdfLib;
  const pdf = await PDFDocument.create();
  const fonts: DocFonts = {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  };
  const colors: Palette = {
    bg: rgb(PLAYBOOK_PDF_PAGE_BG.r, PLAYBOOK_PDF_PAGE_BG.g, PLAYBOOK_PDF_PAGE_BG.b),
    ink: rgb(PLAYBOOK_PDF_INK.r, PLAYBOOK_PDF_INK.g, PLAYBOOK_PDF_INK.b),
    muted: rgb(PLAYBOOK_PDF_MUTED.r, PLAYBOOK_PDF_MUTED.g, PLAYBOOK_PDF_MUTED.b),
  };
  const [pageWidth, pageHeight] = PageSizes.A4;
  const layout = makeLayout(pageWidth, pageHeight);
  const images = await embedSnapshots(pdf, snapshots);

  const writer = {
    fonts,
    colors,
    layout,
    footer: PLAYBOOK_PDF_FOOTER,
    footerUri: PLAYBOOK_PDF_FOOTER_URL,
    PDFString,
  } as Writer;
  writer.addPage = () => {
    const page = pdf.addPage(PageSizes.A4);
    paintPageChrome(writer, page);
    return page;
  };
  writer.page = writer.addPage();
  writer.y = layout.top;
  drawCover(writer, report);
  for (const page of report.pages) {
    drawStrat(writer, report, page, images.get(page.id));
  }
  return pdf.save();
}
