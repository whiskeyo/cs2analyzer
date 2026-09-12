/** Offscreen radar still for a playbook PDF page (canvas px). */
export const PLAYBOOK_PDF_RADAR_SIZE = 720;

export const PLAYBOOK_PDF_MIME = "application/pdf";

export const PLAYBOOK_PDF_FOOTER = "Exported from cs2analyzer.whiskeyo.pl";
export const PLAYBOOK_PDF_FOOTER_URL = "https://cs2analyzer.whiskeyo.pl";

/** App-like muted page fill (#10161c) — radar-adjacent, not stark white. */
export const PLAYBOOK_PDF_PAGE_BG = {
  r: 16 / 255,
  g: 22 / 255,
  b: 28 / 255,
} as const;
/** App `--text` (#e8eef4). */
export const PLAYBOOK_PDF_INK = {
  r: 232 / 255,
  g: 238 / 255,
  b: 244 / 255,
} as const;
/** App `--text-muted` (#8b98a5). */
export const PLAYBOOK_PDF_MUTED = {
  r: 139 / 255,
  g: 152 / 255,
  b: 165 / 255,
} as const;

/** Print-friendly paper (#f4f1ea), not stark white. */
export const PLAYBOOK_PDF_LIGHT_PAGE_BG = {
  r: 244 / 255,
  g: 241 / 255,
  b: 234 / 255,
} as const;
export const PLAYBOOK_PDF_LIGHT_INK = {
  r: 31 / 255,
  g: 33 / 255,
  b: 38 / 255,
} as const;
export const PLAYBOOK_PDF_LIGHT_MUTED = {
  r: 97 / 255,
  g: 102 / 255,
  b: 110 / 255,
} as const;

/** Drop below the text baseline for `__underline__`. */
export const PLAYBOOK_PDF_UNDERLINE_GAP = 1.5;

/** Fallback download stem when title and map slug to nothing. */
export const PLAYBOOK_PDF_FILE_FALLBACK = "playbook";

/** PDF points. A4 width / height used by pdf-lib `PageSizes.A4`. */
export const PLAYBOOK_PDF_MARGIN = 48;
export const PLAYBOOK_PDF_TITLE_SIZE = 22;
export const PLAYBOOK_PDF_HEADING_SIZE = 16;
export const PLAYBOOK_PDF_BODY_SIZE = 11;
export const PLAYBOOK_PDF_SMALL_SIZE = 10;
export const PLAYBOOK_PDF_FOOTER_SIZE = 8;
export const PLAYBOOK_PDF_LINE_GAP = 4;
export const PLAYBOOK_PDF_SECTION_GAP = 16;
/** Vertical gap between stacked Upper / Lower stills. */
export const PLAYBOOK_PDF_FLOOR_GAP = 12;
export const PLAYBOOK_PDF_FLOOR_LABEL_UPPER = "Upper";
export const PLAYBOOK_PDF_FLOOR_LABEL_LOWER = "Lower";
