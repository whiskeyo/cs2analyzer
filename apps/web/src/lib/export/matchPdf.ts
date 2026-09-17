import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import { DEFAULT_PDF_THEME, type PdfTheme } from "@/lib/settings/userSettings";
import {
  MATCH_PDF_BOOKMARKS,
  MATCH_PDF_COL_A,
  MATCH_PDF_COL_ADR,
  MATCH_PDF_COL_D,
  MATCH_PDF_COL_ENTRY,
  MATCH_PDF_COL_K,
  MATCH_PDF_COL_KAST,
  MATCH_PDF_COL_PLAYER,
  MATCH_PDF_COL_RATING,
  MATCH_PDF_KICKER,
  MATCH_PDF_NO_NOTES,
  MATCH_PDF_NOTES,
  MATCH_PDF_REOPEN,
  MATCH_PDF_SCOREBOARD,
  PLAYBOOK_PDF_BODY_SIZE,
  PLAYBOOK_PDF_FOOTER,
  PLAYBOOK_PDF_FOOTER_SIZE,
  PLAYBOOK_PDF_FOOTER_URL,
  PLAYBOOK_PDF_HEADING_SIZE,
  PLAYBOOK_PDF_INK,
  PLAYBOOK_PDF_LIGHT_INK,
  PLAYBOOK_PDF_LIGHT_MUTED,
  PLAYBOOK_PDF_LIGHT_PAGE_BG,
  PLAYBOOK_PDF_LINE_GAP,
  PLAYBOOK_PDF_MARGIN,
  PLAYBOOK_PDF_MUTED,
  PLAYBOOK_PDF_PAGE_BG,
  PLAYBOOK_PDF_SECTION_GAP,
  PLAYBOOK_PDF_SMALL_SIZE,
  PLAYBOOK_PDF_TITLE_SIZE,
} from "./constants";
import { addGoToLink, addOutline, addUriLink, type PdfLinkHit } from "./pdfLinks";
import { loadPlaybookPdfFontBytes, registerPlaybookPdfFontkit } from "./pdfFonts";
import { centerOnContent, playbookRadarMaxSize } from "./pdfDocument";
import { fitPdfText, pdfSafeText, wrapPdfText } from "./pdfText";
import type { MatchReport, MatchReportBookmark, MatchReportPlayer } from "./matchReport";

export type MatchPdfStills = Readonly<Record<string, Uint8Array>>;

interface PdfLib {
  PDFDocument: (typeof import("pdf-lib"))["PDFDocument"];
  PDFName: (typeof import("pdf-lib"))["PDFName"];
  PDFString: (typeof import("pdf-lib"))["PDFString"];
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

interface TocHit extends PdfLinkHit {
  bookmarkId: string;
}

const TABLE_ROW_SIZE = PLAYBOOK_PDF_SMALL_SIZE;
/** Share of content width: name first, then compact stat columns. */
const COL_SHARES = [0.28, 0.08, 0.08, 0.08, 0.12, 0.12, 0.12, 0.12] as const;
const COL_TITLES = [
  MATCH_PDF_COL_PLAYER,
  MATCH_PDF_COL_K,
  MATCH_PDF_COL_D,
  MATCH_PDF_COL_A,
  MATCH_PDF_COL_ADR,
  MATCH_PDF_COL_KAST,
  MATCH_PDF_COL_RATING,
  MATCH_PDF_COL_ENTRY,
] as const;

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

function themePalette(theme: PdfTheme, rgb: PdfLib["rgb"]): Palette {
  if (theme === "light") {
    return {
      bg: rgb(
        PLAYBOOK_PDF_LIGHT_PAGE_BG.r,
        PLAYBOOK_PDF_LIGHT_PAGE_BG.g,
        PLAYBOOK_PDF_LIGHT_PAGE_BG.b,
      ),
      ink: rgb(PLAYBOOK_PDF_LIGHT_INK.r, PLAYBOOK_PDF_LIGHT_INK.g, PLAYBOOK_PDF_LIGHT_INK.b),
      muted: rgb(
        PLAYBOOK_PDF_LIGHT_MUTED.r,
        PLAYBOOK_PDF_LIGHT_MUTED.g,
        PLAYBOOK_PDF_LIGHT_MUTED.b,
      ),
    };
  }
  return {
    bg: rgb(PLAYBOOK_PDF_PAGE_BG.r, PLAYBOOK_PDF_PAGE_BG.g, PLAYBOOK_PDF_PAGE_BG.b),
    ink: rgb(PLAYBOOK_PDF_INK.r, PLAYBOOK_PDF_INK.g, PLAYBOOK_PDF_INK.b),
    muted: rgb(PLAYBOOK_PDF_MUTED.r, PLAYBOOK_PDF_MUTED.g, PLAYBOOK_PDF_MUTED.b),
  };
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

function colWidths(contentWidth: number): number[] {
  return COL_SHARES.map((share) => contentWidth * share);
}

function playerCells(player: MatchReportPlayer): string[] {
  return [
    player.name,
    String(player.kills),
    String(player.deaths),
    String(player.assists),
    player.adr,
    player.kast,
    player.rating,
    player.entry,
  ];
}

function drawTableRow(writer: Writer, cells: readonly string[], font: PDFFont, color: RGB): void {
  const size = TABLE_ROW_SIZE;
  const widths = colWidths(writer.layout.contentWidth);
  ensureSpace(writer, lineHeight(size));
  let x = writer.layout.left;
  cells.forEach((cell, index) => {
    const width = widths[index] ?? 0;
    const pad = index === 0 ? 0 : 4;
    writer.page.drawText(fitPdfText(font, cell, size, Math.max(0, width - pad)), {
      x: x + pad,
      y: writer.y - size,
      size,
      font,
      color,
    });
    x += width;
  });
  writer.y -= lineHeight(size);
}

function drawTeamTable(
  writer: Writer,
  name: string,
  score: number,
  rows: readonly MatchReportPlayer[],
): void {
  drawLines(
    writer,
    [`${name}  ${score}`],
    PLAYBOOK_PDF_BODY_SIZE,
    writer.fonts.bold,
    writer.colors.ink,
  );
  drawTableRow(writer, COL_TITLES, writer.fonts.bold, writer.colors.muted);
  for (const player of rows) {
    drawTableRow(writer, playerCells(player), writer.fonts.regular, writer.colors.ink);
  }
  drawGap(writer, 8);
}

function drawWrapped(writer: Writer, text: string, size: number, font: PDFFont, color: RGB): void {
  drawLines(writer, wrapPdfText(font, text, size, writer.layout.contentWidth), size, font, color);
}

function drawCover(writer: Writer, report: MatchReport): TocHit[] {
  drawLines(
    writer,
    [MATCH_PDF_KICKER],
    PLAYBOOK_PDF_SMALL_SIZE,
    writer.fonts.regular,
    writer.colors.muted,
  );
  drawGap(writer, 8);
  drawWrapped(
    writer,
    report.heading,
    PLAYBOOK_PDF_TITLE_SIZE,
    writer.fonts.bold,
    writer.colors.ink,
  );
  drawGap(writer, 8);
  drawLines(
    writer,
    [report.scoreLine, `${report.fileName} · ${report.exportedOn}`],
    PLAYBOOK_PDF_BODY_SIZE,
    writer.fonts.regular,
    writer.colors.muted,
  );
  drawGap(writer);
  drawLines(
    writer,
    [MATCH_PDF_SCOREBOARD],
    PLAYBOOK_PDF_BODY_SIZE,
    writer.fonts.bold,
    writer.colors.ink,
  );
  drawGap(writer, 8);
  drawTeamTable(writer, report.ctName, report.ctScore, report.players.ct);
  drawTeamTable(writer, report.tName, report.tScore, report.players.t);
  drawGap(writer);
  drawLines(
    writer,
    [MATCH_PDF_NOTES],
    PLAYBOOK_PDF_BODY_SIZE,
    writer.fonts.bold,
    writer.colors.ink,
  );
  drawGap(writer, 8);
  if (report.notes.length === 0) {
    drawWrapped(
      writer,
      MATCH_PDF_NO_NOTES,
      PLAYBOOK_PDF_BODY_SIZE,
      writer.fonts.regular,
      writer.colors.muted,
    );
  } else {
    for (const section of report.notes) {
      drawLines(
        writer,
        [section.roundLabel],
        PLAYBOOK_PDF_BODY_SIZE,
        writer.fonts.bold,
        writer.colors.ink,
      );
      for (const item of section.items) {
        drawWrapped(
          writer,
          `• ${item.title}`,
          PLAYBOOK_PDF_BODY_SIZE,
          writer.fonts.regular,
          writer.colors.ink,
        );
      }
      drawGap(writer, 8);
    }
  }
  const hits: TocHit[] = [];
  if (report.bookmarks.length > 0) {
    drawGap(writer, 8);
    drawLines(
      writer,
      [MATCH_PDF_BOOKMARKS],
      PLAYBOOK_PDF_BODY_SIZE,
      writer.fonts.bold,
      writer.colors.ink,
    );
    const size = PLAYBOOK_PDF_BODY_SIZE;
    report.bookmarks.forEach((mark, index) => {
      const lines = wrapPdfText(
        writer.fonts.regular,
        `${index + 1}. ${mark.title} — ${mark.caption}`,
        size,
        writer.layout.contentWidth,
      );
      const blockHeight = Math.max(lines.length, 1) * lineHeight(size);
      ensureSpace(writer, blockHeight);
      const hitPage = writer.page;
      const top = writer.y;
      drawLines(writer, lines, size, writer.fonts.regular, writer.colors.ink);
      hits.push({
        bookmarkId: mark.id,
        page: hitPage,
        x: writer.layout.left,
        y: writer.y,
        width: writer.layout.contentWidth,
        height: top - writer.y,
      });
    });
  }
  drawGap(writer);
  drawWrapped(
    writer,
    MATCH_PDF_REOPEN,
    PLAYBOOK_PDF_SMALL_SIZE,
    writer.fonts.regular,
    writer.colors.muted,
  );
  return hits;
}

async function embedStills(
  pdf: { embedPng: (bytes: Uint8Array) => Promise<PDFImage> },
  stills: MatchPdfStills,
): Promise<Map<string, PDFImage>> {
  const images = new Map<string, PDFImage>();
  for (const [id, bytes] of Object.entries(stills)) {
    if (!bytes || bytes.byteLength === 0) continue;
    try {
      images.set(id, await pdf.embedPng(bytes));
    } catch {
      // skip a still that is not a PNG — the caption page still prints
    }
  }
  return images;
}

function drawBookmarkStill(writer: Writer, image: PDFImage | undefined): void {
  if (!image) return;
  const budget = writer.y - writer.layout.bottom - PLAYBOOK_PDF_SECTION_GAP;
  const slot = playbookRadarMaxSize(writer.layout.contentWidth, budget, 1, false);
  const dims = image.scaleToFit(slot.maxW, slot.maxH);
  if (writer.y - dims.height < writer.layout.bottom) {
    writer.page = writer.addPage();
    writer.y = writer.layout.top;
  }
  const x = centerOnContent(writer.layout.left, writer.layout.contentWidth, dims.width);
  const y = writer.y - dims.height;
  writer.page.drawImage(image, { x, y, width: dims.width, height: dims.height });
  writer.y -= dims.height;
  writer.y -= PLAYBOOK_PDF_SECTION_GAP;
}

function drawBookmarkPage(
  writer: Writer,
  report: MatchReport,
  mark: MatchReportBookmark,
  image: PDFImage | undefined,
): PDFPage {
  writer.page = writer.addPage();
  const dest = writer.page;
  writer.y = writer.layout.top;
  drawWrapped(
    writer,
    report.heading,
    PLAYBOOK_PDF_SMALL_SIZE,
    writer.fonts.regular,
    writer.colors.muted,
  );
  drawGap(writer, 8);
  drawWrapped(writer, mark.title, PLAYBOOK_PDF_HEADING_SIZE, writer.fonts.bold, writer.colors.ink);
  drawGap(writer, 8);
  drawWrapped(
    writer,
    mark.caption,
    PLAYBOOK_PDF_BODY_SIZE,
    writer.fonts.regular,
    writer.colors.muted,
  );
  drawGap(writer, 8);
  drawBookmarkStill(writer, image);
  return dest;
}

export async function buildMatchPdf(
  report: MatchReport,
  stills: MatchPdfStills = {},
  theme: PdfTheme = DEFAULT_PDF_THEME,
): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFString, PageSizes, rgb } = (await import("pdf-lib")) as PdfLib;
  const pdf = await PDFDocument.create();
  await registerPlaybookPdfFontkit(pdf);
  const fontBytes = await loadPlaybookPdfFontBytes();
  const fonts: DocFonts = {
    regular: await pdf.embedFont(fontBytes.regular, { subset: true }),
    bold: await pdf.embedFont(fontBytes.bold, { subset: true }),
  };
  const colors = themePalette(theme, rgb);
  const [pageWidth, pageHeight] = PageSizes.A4;
  const layout = makeLayout(pageWidth, pageHeight);
  const images = await embedStills(pdf, stills);

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
  const tocHits = drawCover(writer, report);
  const destById = new Map<string, PDFPage>();
  const outlineItems: { title: string; page: PDFPage }[] = [
    { title: MATCH_PDF_SCOREBOARD, page: writer.page },
  ];
  for (const mark of report.bookmarks) {
    const dest = drawBookmarkPage(writer, report, mark, images.get(mark.id));
    destById.set(mark.id, dest);
    outlineItems.push({ title: mark.title, page: dest });
  }
  for (const hit of tocHits) {
    const dest = destById.get(hit.bookmarkId);
    if (dest) addGoToLink(hit.page, hit, dest);
  }
  addOutline(pdf, PDFName, PDFString, outlineItems);
  return pdf.save();
}
