import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import { DEFAULT_PDF_THEME, type PdfTheme } from "@/lib/settings/userSettings";
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
  PLAYBOOK_PDF_UNDERLINE_GAP,
} from "./constants";
import { addGoToLink, addOutline, addUriLink } from "./pdfLinks";
import { loadPlaybookPdfFontBytes, registerPlaybookPdfFontkit } from "./pdfFonts";
import { wrapMarkupParagraph, type PdfMarkupFonts } from "./pdfMarkup";
import type { PlaybookReport, PlaybookReportPage } from "./playbookReport";
import { pdfSafeText, wrapPdfText } from "./pdfText";

export { pdfSafeText, wrapPdfText } from "./pdfText";

export interface PlaybookPageStills {
  readonly upper?: Uint8Array;
  readonly lower?: Uint8Array;
}

export type PlaybookPdfSnapshots = Readonly<Record<string, PlaybookPageStills>>;

interface PdfLib {
  PDFDocument: (typeof import("pdf-lib"))["PDFDocument"];
  PDFName: (typeof import("pdf-lib"))["PDFName"];
  PDFString: (typeof import("pdf-lib"))["PDFString"];
  PageSizes: (typeof import("pdf-lib"))["PageSizes"];
  rgb: (typeof import("pdf-lib"))["rgb"];
}

type DocFonts = PdfMarkupFonts;

interface TocHit {
  pageId: string;
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
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

function drawMarkup(writer: Writer, text: string, size: number): void {
  const height = lineHeight(size);
  for (const paragraph of text.split(/\r?\n/)) {
    const wrapped = wrapMarkupParagraph(writer.fonts, paragraph, size, writer.layout.contentWidth);
    for (const runs of wrapped) {
      ensureSpace(writer, height);
      let x = writer.layout.left;
      const baseline = writer.y - size;
      for (const run of runs) {
        writer.page.drawText(run.text, {
          x,
          y: baseline,
          size,
          font: run.font,
          color: writer.colors.ink,
        });
        const width = run.font.widthOfTextAtSize(run.text, size);
        if (run.underline) {
          const y = baseline - PLAYBOOK_PDF_UNDERLINE_GAP;
          writer.page.drawLine({
            start: { x, y },
            end: { x: x + width, y },
            thickness: 0.7,
            color: writer.colors.ink,
          });
        }
        x += width;
      }
      writer.y -= height;
    }
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

function drawCover(writer: Writer, report: PlaybookReport): TocHit[] {
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
      report.heading,
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
    [report.exportedOn],
    PLAYBOOK_PDF_BODY_SIZE,
    writer.fonts.regular,
    writer.colors.muted,
  );
  drawGap(writer);
  drawLines(writer, ["Strats"], PLAYBOOK_PDF_BODY_SIZE, writer.fonts.bold, writer.colors.ink);
  const hits: TocHit[] = [];
  const size = PLAYBOOK_PDF_BODY_SIZE;
  report.pages.forEach((page, index) => {
    const lines = wrapPdfText(
      writer.fonts.regular,
      `${index + 1}. ${page.title}`,
      size,
      writer.layout.contentWidth,
    );
    const blockHeight = Math.max(lines.length, 1) * lineHeight(size);
    ensureSpace(writer, blockHeight);
    const hitPage = writer.page;
    const top = writer.y;
    drawLines(writer, lines, size, writer.fonts.regular, writer.colors.ink);
    hits.push({
      pageId: page.id,
      page: hitPage,
      x: writer.layout.left,
      y: writer.y,
      width: writer.layout.contentWidth,
      height: top - writer.y,
    });
  });
  return hits;
}

/** Fit-to-width slot so one or two stills fill the leftover page under the header. */
export function playbookRadarMaxSize(
  contentWidth: number,
  pageBudget: number,
  floorCount: number,
  labeled: boolean,
): { maxW: number; maxH: number } {
  if (floorCount <= 0) return { maxW: contentWidth, maxH: 0 };
  const labels = labeled ? floorCount * lineHeight(PLAYBOOK_PDF_SMALL_SIZE) : 0;
  const gaps = Math.max(0, floorCount - 1) * PLAYBOOK_PDF_FLOOR_GAP;
  const imgBudget = Math.max(0, pageBudget - labels - gaps - PLAYBOOK_PDF_SECTION_GAP);
  return { maxW: contentWidth, maxH: imgBudget / floorCount };
}

export function centerOnContent(left: number, contentWidth: number, width: number): number {
  return left + (contentWidth - width) / 2;
}

function radarPageBudget(writer: Writer): number {
  return writer.y - writer.layout.bottom;
}

function drawCenteredRadar(writer: Writer, image: PDFImage, maxW: number, maxH: number): number {
  const dims = image.scaleToFit(maxW, maxH);
  writer.page.drawImage(image, {
    x: centerOnContent(writer.layout.left, writer.layout.contentWidth, dims.width),
    y: writer.y - dims.height,
    width: dims.width,
    height: dims.height,
  });
  return dims.height;
}

function drawRadars(writer: Writer, stills: EmbeddedStills | undefined): void {
  if (!stills?.upper && !stills?.lower) return;
  const floors: { image: PDFImage; label: string | null }[] = [];
  if (stills.upper && stills.lower) {
    floors.push({ image: stills.upper, label: PLAYBOOK_PDF_FLOOR_LABEL_UPPER });
    floors.push({ image: stills.lower, label: PLAYBOOK_PDF_FLOOR_LABEL_LOWER });
  } else if (stills.upper) {
    floors.push({ image: stills.upper, label: null });
  } else if (stills.lower) {
    floors.push({ image: stills.lower, label: null });
  }
  const labeled = floors.some((floor) => floor.label !== null);
  const labelSize = PLAYBOOK_PDF_SMALL_SIZE;
  const labelH = lineHeight(labelSize);

  const stackHeight = (budget: number): number => {
    const slot = playbookRadarMaxSize(writer.layout.contentWidth, budget, floors.length, labeled);
    let height = PLAYBOOK_PDF_SECTION_GAP;
    floors.forEach((floor, index) => {
      if (floor.label) height += labelH;
      height += floor.image.scaleToFit(slot.maxW, slot.maxH).height;
      if (index < floors.length - 1) height += PLAYBOOK_PDF_FLOOR_GAP;
    });
    return height;
  };

  if (writer.y - stackHeight(radarPageBudget(writer)) < writer.layout.bottom) {
    writer.page = writer.addPage();
    writer.y = writer.layout.top;
  }
  const slot = playbookRadarMaxSize(
    writer.layout.contentWidth,
    radarPageBudget(writer),
    floors.length,
    labeled,
  );
  floors.forEach((floor, index) => {
    if (floor.label) {
      const dims = floor.image.scaleToFit(slot.maxW, slot.maxH);
      writer.page.drawText(floor.label, {
        x: centerOnContent(writer.layout.left, writer.layout.contentWidth, dims.width),
        y: writer.y - labelSize,
        size: labelSize,
        font: writer.fonts.regular,
        color: writer.colors.muted,
      });
      writer.y -= labelH;
    }
    writer.y -= drawCenteredRadar(writer, floor.image, slot.maxW, slot.maxH);
    if (index < floors.length - 1) writer.y -= PLAYBOOK_PDF_FLOOR_GAP;
  });
  writer.y -= PLAYBOOK_PDF_SECTION_GAP;
}

function drawStrat(
  writer: Writer,
  report: PlaybookReport,
  page: PlaybookReportPage,
  stills: EmbeddedStills | undefined,
): PDFPage {
  writer.page = writer.addPage();
  const dest = writer.page;
  writer.y = writer.layout.top;
  drawLines(
    writer,
    wrapPdfText(
      writer.fonts.regular,
      report.heading,
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
    drawMarkup(writer, page.body, PLAYBOOK_PDF_BODY_SIZE);
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
  return dest;
}

export async function buildPlaybookPdf(
  report: PlaybookReport,
  snapshots: PlaybookPdfSnapshots = {},
  theme: PdfTheme = DEFAULT_PDF_THEME,
): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFString, PageSizes, rgb } = (await import("pdf-lib")) as PdfLib;
  const pdf = await PDFDocument.create();
  await registerPlaybookPdfFontkit(pdf);
  const fontBytes = await loadPlaybookPdfFontBytes();
  const fonts: DocFonts = {
    regular: await pdf.embedFont(fontBytes.regular, { subset: true }),
    bold: await pdf.embedFont(fontBytes.bold, { subset: true }),
    italic: await pdf.embedFont(fontBytes.italic, { subset: true }),
    boldItalic: await pdf.embedFont(fontBytes.boldItalic, { subset: true }),
  };
  const colors = themePalette(theme, rgb);
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
  const tocHits = drawCover(writer, report);
  const destById = new Map<string, PDFPage>();
  const outlineItems: { title: string; page: PDFPage }[] = [];
  for (const page of report.pages) {
    const dest = drawStrat(writer, report, page, images.get(page.id));
    destById.set(page.id, dest);
    outlineItems.push({ title: page.title, page: dest });
  }
  for (const hit of tocHits) {
    const dest = destById.get(hit.pageId);
    if (dest) addGoToLink(hit.page, hit, dest);
  }
  addOutline(pdf, PDFName, PDFString, outlineItems);
  return pdf.save();
}
