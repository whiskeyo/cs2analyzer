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
/** Fit-to-width photo on a strat page; keep a still + notes readable above. */
export const PLAYBOOK_PDF_PHOTO_MAX_HEIGHT = 240;
/** Smallest clickable pin overlay on a still (PDF points). */
export const PLAYBOOK_PDF_PIN_HIT_MIN = 12;
export const PLAYBOOK_PDF_PHOTO_BACK = "Go back to strat";
/** Vector arrow beside the margin label — Liberation subset has no ↑. */
export const PLAYBOOK_PDF_PHOTO_BACK_ARROW_SIZE = 5;
export const PLAYBOOK_PDF_PHOTO_BACK_ARROW_GAP = 3;

export const MATCH_PDF_KICKER = "cs2analyzer match";
export const MATCH_PDF_SCOREBOARD = "Scoreboard";
export const MATCH_PDF_NOTES = "Notes";
export const MATCH_PDF_BOOKMARKS = "Bookmarks";
export const MATCH_PDF_NO_NOTES = "No notes on this match.";
export const MATCH_PDF_REOPEN = "Re-open the .dem in cs2analyzer to scrub.";
export const MATCH_PDF_FILE_FALLBACK = "match";
export const MATCH_PDF_BOOKMARK_TOOLTIP =
  "Bookmark this tick (Moment: a few seconds). Nothing is drawn on the radar. Only bookmarked rounds appear as pages in Export PDF.";
export const MATCH_PDF_COL_PLAYER = "Player";
export const MATCH_PDF_COL_K = "K";
export const MATCH_PDF_COL_D = "D";
export const MATCH_PDF_COL_A = "A";
export const MATCH_PDF_COL_ADR = "ADR";
export const MATCH_PDF_COL_KAST = "KAST";
export const MATCH_PDF_COL_RATING = "Rating";
export const MATCH_PDF_COL_ENTRY = "Entry";
export const MATCH_PDF_ENTRY_EMPTY = "—";
export const MATCH_PDF_ECO_PISTOL = "Pistol";
export const MATCH_PDF_ECO_ECO = "Eco";
export const MATCH_PDF_ECO_FORCE = "Force";
export const MATCH_PDF_ECO_FULL = "Full buy";
export const MATCH_PDF_ECO_KNIFE = "Knife";
export const MATCH_PDF_EXPORT_ERROR = "Could not export PDF.";

/** Radar clip video frames per second of demo time. */
export const CLIP_EXPORT_FPS = 60;

/** Longest continuous radar clip, in seconds of demo time. */
export const CLIP_EXPORT_MAX_SECONDS = 30;

/** Preset length for “last N seconds” in single playback. */
export const CLIP_EXPORT_DEFAULT_SECONDS = 15;

/** MediaRecorder target bitrate for a sharp 2D radar. */
export const CLIP_EXPORT_VIDEO_BITS_PER_SECOND = 8_000_000;

export const CLIP_EXPORT_NOT_READY = "Radar is not ready to record.";
export const CLIP_EXPORT_UNSUPPORTED = "This browser cannot record video.";
export const CLIP_EXPORT_FAILED = "Could not export the clip.";
export const CLIP_EXPORT_EMPTY = "The recording was empty.";
export const CLIP_EXPORT_TOO_SHORT = "Clip is too short.";
export const CLIP_EXPORT_NO_CANVAS = "This browser cannot record a canvas.";
