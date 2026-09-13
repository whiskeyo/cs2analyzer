import type { PDFFont, PDFImage, PDFPage, RGB } from "pdf-lib";
import type { PlaybookFloorLayer } from "@/lib/playbook/pages";
import type { MapCalibration } from "@/lib/replay/replayTypes";
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
  PLAYBOOK_PDF_PHOTO_MAX_HEIGHT,
  playbookPdfPhotoBackLabel,
  PLAYBOOK_PDF_SECTION_GAP,
  PLAYBOOK_PDF_SMALL_SIZE,
  PLAYBOOK_PDF_TITLE_SIZE,
} from "./constants";
import { addGoToLink, addOutline, addUriLink, type PdfLinkHit } from "./pdfLinks";
import { loadPlaybookPdfFontBytes, registerPlaybookPdfFontkit } from "./pdfFonts";
import {
  embedPhotos,
  embedSnapshots,
  type EmbeddedStills,
  type PlaybookPdfPhotos,
  type PlaybookPdfSnapshots,
} from "./playbookPdfEmbed";
import { playbookPdfPinHit } from "./playbookPdfPins";
import type { PlaybookReport, PlaybookReportPage, PlaybookReportPhoto } from "./playbookReport";
import { pdfSafeText, wrapPdfText } from "./pdfText";

export { pdfSafeText, wrapPdfText } from "./pdfText";
export type {
  PlaybookPageStills,
  PlaybookPdfPhotos,
  PlaybookPdfSnapshots,
} from "./playbookPdfEmbed";

interface PdfLib {
  PDFDocument: (typeof import("pdf-lib"))["PDFDocument"];
  PDFName: (typeof import("pdf-lib"))["PDFName"];
  PDFString: (typeof import("pdf-lib"))["PDFString"];
  PageSizes: (typeof import("pdf-lib"))["PageSizes"];
  rgb: (typeof import("pdf-lib"))["rgb"];
  degrees: (typeof import("pdf-lib"))["degrees"];
}

interface DocFonts {
  regular: PDFFont;
  bold: PDFFont;
}

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

interface StillPlacement {
  floor: PlaybookFloorLayer;
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PhotoDest {
  page: PDFPage;
  y: number;
}

interface PhotoNav {
  dests: Map<string, PhotoDest>;
  backHits: PdfLinkHit[];
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
  degrees: PdfLib["degrees"];
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

function drawGap(writer: Writer, gap = PLAYBOOK_PDF_SECTION_GAP): void {
  writer.y -= gap;
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

/** 90° CCW in the left page margin, centered on the photo. */
export function playbookPdfPhotoBackPlacement(
  photo: { y: number; height: number },
  labelWidth: number,
  labelSize: number,
  margin = PLAYBOOK_PDF_MARGIN,
): { textX: number; textY: number; x: number; y: number; width: number; height: number } {
  const textX = margin / 2 + labelSize / 2;
  const textY = labelWidth >= photo.height ? photo.y : photo.y + (photo.height - labelWidth) / 2;
  return {
    textX,
    textY,
    x: textX - labelSize,
    y: textY,
    width: labelSize,
    height: labelWidth,
  };
}

function radarPageBudget(writer: Writer): number {
  return writer.y - writer.layout.bottom;
}

function drawCenteredRadar(
  writer: Writer,
  image: PDFImage,
  maxW: number,
  maxH: number,
): { x: number; y: number; width: number; height: number } {
  const dims = image.scaleToFit(maxW, maxH);
  const x = centerOnContent(writer.layout.left, writer.layout.contentWidth, dims.width);
  const y = writer.y - dims.height;
  writer.page.drawImage(image, {
    x,
    y,
    width: dims.width,
    height: dims.height,
  });
  return { x, y, width: dims.width, height: dims.height };
}

function drawRadars(writer: Writer, stills: EmbeddedStills | undefined): StillPlacement[] {
  if (!stills?.upper && !stills?.lower) return [];
  const floors: { image: PDFImage; label: string | null; floor: PlaybookFloorLayer }[] = [];
  if (stills.upper && stills.lower) {
    floors.push({
      image: stills.upper,
      label: PLAYBOOK_PDF_FLOOR_LABEL_UPPER,
      floor: "upper",
    });
    floors.push({
      image: stills.lower,
      label: PLAYBOOK_PDF_FLOOR_LABEL_LOWER,
      floor: "lower",
    });
  } else if (stills.upper) {
    floors.push({ image: stills.upper, label: null, floor: "upper" });
  } else if (stills.lower) {
    floors.push({ image: stills.lower, label: null, floor: "lower" });
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
  const placed: StillPlacement[] = [];
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
    const rect = drawCenteredRadar(writer, floor.image, slot.maxW, slot.maxH);
    placed.push({ floor: floor.floor, page: writer.page, ...rect });
    writer.y -= rect.height;
    if (index < floors.length - 1) writer.y -= PLAYBOOK_PDF_FLOOR_GAP;
  });
  writer.y -= PLAYBOOK_PDF_SECTION_GAP;
  return placed;
}

function pinHitsOnStills(
  stills: readonly StillPlacement[],
  photos: readonly PlaybookReportPhoto[],
  cal: MapCalibration | undefined,
): (PdfLinkHit & { photoId: string })[] {
  if (!cal) return [];
  const hits: (PdfLinkHit & { photoId: string })[] = [];
  for (const still of stills) {
    for (const photo of photos) {
      if (photo.floor !== still.floor) continue;
      hits.push({
        photoId: photo.id,
        page: still.page,
        ...playbookPdfPinHit(photo, cal, still),
      });
    }
  }
  return hits;
}

function drawPhotos(
  writer: Writer,
  photos: readonly PlaybookReportPhoto[],
  embedded: ReadonlyMap<string, PDFImage>,
): PhotoNav {
  const dests = new Map<string, PhotoDest>();
  const backHits: PdfLinkHit[] = [];
  const backSize = PLAYBOOK_PDF_SMALL_SIZE;
  const backLabel = playbookPdfPhotoBackLabel();
  for (const photo of photos) {
    const image = embedded.get(photo.id);
    if (!image) continue;
    const dims = image.scaleToFit(writer.layout.contentWidth, PLAYBOOK_PDF_PHOTO_MAX_HEIGHT);
    const caption = wrapPdfText(
      writer.fonts.regular,
      photo.name,
      PLAYBOOK_PDF_SMALL_SIZE,
      writer.layout.contentWidth,
    );
    const captionH = Math.max(caption.length, 1) * lineHeight(PLAYBOOK_PDF_SMALL_SIZE);
    ensureSpace(writer, captionH + dims.height + PLAYBOOK_PDF_LINE_GAP);
    dests.set(photo.id, { page: writer.page, y: writer.y });
    drawLines(writer, caption, PLAYBOOK_PDF_SMALL_SIZE, writer.fonts.regular, writer.colors.muted);
    const photoY = writer.y - dims.height;
    writer.page.drawImage(image, {
      x: centerOnContent(writer.layout.left, writer.layout.contentWidth, dims.width),
      y: photoY,
      width: dims.width,
      height: dims.height,
    });
    writer.y -= dims.height;
    const labelWidth = writer.fonts.regular.widthOfTextAtSize(backLabel, backSize);
    const back = playbookPdfPhotoBackPlacement(
      { y: photoY, height: dims.height },
      labelWidth,
      backSize,
    );
    writer.page.drawText(backLabel, {
      x: back.textX,
      y: back.textY,
      size: backSize,
      font: writer.fonts.regular,
      color: writer.colors.muted,
      rotate: writer.degrees(90),
    });
    backHits.push({
      page: writer.page,
      x: back.x,
      y: back.y,
      width: back.width,
      height: back.height,
    });
    drawGap(writer, PLAYBOOK_PDF_LINE_GAP);
  }
  return { dests, backHits };
}

function wirePhotoLinks(
  stratDest: PDFPage,
  pinHits: readonly (PdfLinkHit & { photoId: string })[],
  nav: PhotoNav,
): void {
  for (const hit of pinHits) {
    const dest = nav.dests.get(hit.photoId);
    if (!dest) continue;
    addGoToLink(hit.page, hit, dest.page, dest.y);
  }
  for (const hit of nav.backHits) {
    addGoToLink(hit.page, hit, stratDest);
  }
}

function drawStrat(
  writer: Writer,
  report: PlaybookReport,
  page: PlaybookReportPage,
  stills: EmbeddedStills | undefined,
  photos: ReadonlyMap<string, PDFImage>,
  cal?: MapCalibration,
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
  const stillPlaced = drawRadars(writer, stills);
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
  const photoNav = drawPhotos(writer, page.photos, photos);
  wirePhotoLinks(dest, pinHitsOnStills(stillPlaced, page.photos, cal), photoNav);
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
  photoBytes: PlaybookPdfPhotos = {},
  cal?: MapCalibration,
): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFString, PageSizes, rgb, degrees } = (await import(
    "pdf-lib"
  )) as PdfLib;
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
  const images = await embedSnapshots(pdf, snapshots);
  const photos = await embedPhotos(pdf, report, photoBytes);

  const writer = {
    fonts,
    colors,
    layout,
    footer: PLAYBOOK_PDF_FOOTER,
    footerUri: PLAYBOOK_PDF_FOOTER_URL,
    PDFString,
    degrees,
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
    const dest = drawStrat(writer, report, page, images.get(page.id), photos, cal);
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
