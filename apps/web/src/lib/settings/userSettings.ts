import { clampLeadInSec, DEFAULT_LEAD_IN_SEC } from "@/lib/match/roundEvents";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import {
  DEFAULT_LAYERS,
  DEFAULT_SUMMARY_FILTER,
  type FloorMode,
  type MapLayers,
  type SummaryFilter,
} from "@/lib/notes/types";
import type { GrenadeKind } from "@/lib/replay/replayTypes";
import {
  DEFAULT_PLAYBACK_SPEED,
  NOTE_MOMENT_MAX_SECONDS,
  NOTE_MOMENT_MIN_SECONDS,
  NOTE_MOMENT_SECONDS,
  PARSE_POOL_HARD_MAX,
  PARSE_POOL_MAX,
  PARSE_POOL_MIN,
  PLAYBACK_SPEEDS,
  SAVED_NOTES_PAGE_SIZE,
  SAVED_NOTES_PAGE_SIZE_MAX,
  SAVED_NOTES_PAGE_SIZE_MIN,
  DEFAULT_RADAR_GRAY,
  RADAR_GRAY_MAX,
  RADAR_GRAY_MIN,
  SERIES_HABITS_WINDOW_MAX_SECONDS,
  SERIES_HABITS_WINDOW_MIN_SECONDS,
  SERIES_HABITS_WINDOW_SECONDS,
  SERIES_MAX_FILES,
  SERIES_MAX_FILES_HARD,
  SERIES_MIN_FILES,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/lib/shared/constants";
import { isFiniteNumber, isRecord, isString } from "@/lib/validate/guards.ts";

export const USER_SETTINGS_SCHEMA = 1;
export const USER_SETTINGS_ID = "user";

export const PDF_THEMES = ["dark", "light"] as const;
export type PdfTheme = (typeof PDF_THEMES)[number];
/** Dark matches the on-screen playbook; light is paper-friendly. */
export const DEFAULT_PDF_THEME: PdfTheme = "dark";

export const PDF_PHOTO_MODES = ["with", "without"] as const;
export type PdfPhotos = (typeof PDF_PHOTO_MODES)[number];
/** Embedded lineup stills under the radar; pins stay either way. */
export const DEFAULT_PDF_PHOTOS: PdfPhotos = "with";

const GRENADE_KINDS = Object.keys(DEFAULT_SUMMARY_FILTER.kinds) as GrenadeKind[];
const LAYER_KEYS = Object.keys(DEFAULT_LAYERS) as (keyof MapLayers)[];

export interface UserSettings {
  schema: number;
  updatedAt: number;
  parsePoolMax: number;
  sidebarWidth: number;
  savedNotesPageSize: number;
  defaultPaletteId: string;
  defaultColor: string;
  defaultFloorMode: FloorMode;
  defaultSummaryFilter: SummaryFilter;
  defaultLayers: MapLayers;
  defaultPlaybackSpeed: number;
  eventLeadInSec: number;
  noteMomentSec: number;
  habitsTrailWindowSec: number;
  seriesMaxFiles: number;
  pdfTheme: PdfTheme;
  /** Embed full lineup photos in the Playbook PDF. Pins stay on the still either way. */
  pdfPhotos: PdfPhotos;
  /** 0 = original map color, 1 = full grayscale. Applies to Analyzer, Playbook, PDF stills. */
  radarGray: number;
}

export type UserSettingsRecord = UserSettings & { id: typeof USER_SETTINGS_ID };

function defaultPaletteId(): string {
  return COLOR_PRESETS[0].id;
}

function defaultColor(): string {
  return COLOR_PRESETS[0].colors[0];
}

function cloneLayers(layers: MapLayers): MapLayers {
  return { ...layers };
}

function cloneSummaryFilter(filter: SummaryFilter): SummaryFilter {
  return { ...filter, kinds: { ...filter.kinds } };
}

export function cloneUserSettings(settings: UserSettings): UserSettings {
  return {
    ...settings,
    defaultLayers: cloneLayers(settings.defaultLayers),
    defaultSummaryFilter: cloneSummaryFilter(settings.defaultSummaryFilter),
  };
}

/** Shipped defaults — reset writes this, not an empty document. */
export function defaultUserSettings(now = Date.now()): UserSettings {
  return {
    schema: USER_SETTINGS_SCHEMA,
    updatedAt: now,
    parsePoolMax: PARSE_POOL_MAX,
    sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
    savedNotesPageSize: SAVED_NOTES_PAGE_SIZE,
    defaultPaletteId: defaultPaletteId(),
    defaultColor: defaultColor(),
    defaultFloorMode: "auto",
    defaultSummaryFilter: cloneSummaryFilter(DEFAULT_SUMMARY_FILTER),
    defaultLayers: cloneLayers(DEFAULT_LAYERS),
    defaultPlaybackSpeed: DEFAULT_PLAYBACK_SPEED,
    eventLeadInSec: DEFAULT_LEAD_IN_SEC,
    noteMomentSec: NOTE_MOMENT_SECONDS,
    habitsTrailWindowSec: SERIES_HABITS_WINDOW_SECONDS,
    seriesMaxFiles: SERIES_MAX_FILES,
    pdfTheme: DEFAULT_PDF_THEME,
    pdfPhotos: DEFAULT_PDF_PHOTOS,
    radarGray: DEFAULT_RADAR_GRAY,
  };
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function parseClampedInt(value: unknown, min: number, max: number, fallback: number): number {
  if (!isFiniteNumber(value)) {
    return fallback;
  }
  return clampInt(value, min, max);
}

function parseClampedNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (!isFiniteNumber(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function parsePaletteId(value: unknown): string {
  if (isString(value) && COLOR_PRESETS.some((preset) => preset.id === value)) {
    return value;
  }
  return defaultPaletteId();
}

function parseColor(value: unknown, fallback: string): string {
  return isString(value) && value.trim() !== "" ? value : fallback;
}

function parseFloorMode(value: unknown): FloorMode {
  return value === "upper" || value === "lower" || value === "auto" ? value : "auto";
}

function parsePdfTheme(value: unknown): PdfTheme {
  return value === "light" || value === "dark" ? value : DEFAULT_PDF_THEME;
}

function parsePdfPhotos(value: unknown): PdfPhotos {
  return value === "with" || value === "without" ? value : DEFAULT_PDF_PHOTOS;
}

function parsePlaybackSpeed(value: unknown): number {
  if (isFiniteNumber(value) && (PLAYBACK_SPEEDS as readonly number[]).includes(value)) {
    return value;
  }
  return DEFAULT_PLAYBACK_SPEED;
}

function parseLayers(value: unknown): MapLayers {
  const next = cloneLayers(DEFAULT_LAYERS);
  if (!isRecord(value)) {
    return next;
  }
  for (const key of LAYER_KEYS) {
    if (typeof value[key] === "boolean") {
      next[key] = value[key];
    }
  }
  return next;
}

function parseSummaryFilter(value: unknown): SummaryFilter {
  if (!isRecord(value)) {
    return cloneSummaryFilter(DEFAULT_SUMMARY_FILTER);
  }
  const kinds = { ...DEFAULT_SUMMARY_FILTER.kinds };
  const rawKinds = isRecord(value.kinds) ? value.kinds : {};
  for (const kind of GRENADE_KINDS) {
    if (typeof rawKinds[kind] === "boolean") {
      kinds[kind] = rawKinds[kind];
    }
  }
  kinds.incendiary = kinds.molotov;
  return {
    kinds,
    t: typeof value.t === "boolean" ? value.t : true,
    ct: typeof value.ct === "boolean" ? value.ct : true,
  };
}

/** Unknown fields are dropped; missing fields fill from shipped defaults. */
export function parseUserSettings(raw: unknown): UserSettings {
  const defaults = defaultUserSettings();
  if (!isRecord(raw)) {
    return defaults;
  }
  const paletteId = parsePaletteId(raw.defaultPaletteId);
  const preset = COLOR_PRESETS.find((row) => row.id === paletteId) ?? COLOR_PRESETS[0];
  return {
    schema: USER_SETTINGS_SCHEMA,
    updatedAt: isFiniteNumber(raw.updatedAt) ? raw.updatedAt : defaults.updatedAt,
    parsePoolMax: parseClampedInt(
      raw.parsePoolMax,
      PARSE_POOL_MIN,
      PARSE_POOL_HARD_MAX,
      defaults.parsePoolMax,
    ),
    sidebarWidth: parseClampedInt(
      raw.sidebarWidth,
      SIDEBAR_MIN_WIDTH,
      SIDEBAR_MAX_WIDTH,
      defaults.sidebarWidth,
    ),
    savedNotesPageSize: parseClampedInt(
      raw.savedNotesPageSize,
      SAVED_NOTES_PAGE_SIZE_MIN,
      SAVED_NOTES_PAGE_SIZE_MAX,
      defaults.savedNotesPageSize,
    ),
    defaultPaletteId: paletteId,
    defaultColor: parseColor(raw.defaultColor, preset.colors[0]),
    defaultFloorMode: parseFloorMode(raw.defaultFloorMode),
    defaultSummaryFilter: parseSummaryFilter(raw.defaultSummaryFilter),
    defaultLayers: parseLayers(raw.defaultLayers),
    defaultPlaybackSpeed: parsePlaybackSpeed(raw.defaultPlaybackSpeed),
    eventLeadInSec: isFiniteNumber(raw.eventLeadInSec)
      ? clampLeadInSec(raw.eventLeadInSec)
      : defaults.eventLeadInSec,
    noteMomentSec: parseClampedNumber(
      raw.noteMomentSec,
      NOTE_MOMENT_MIN_SECONDS,
      NOTE_MOMENT_MAX_SECONDS,
      defaults.noteMomentSec,
    ),
    habitsTrailWindowSec: parseClampedInt(
      raw.habitsTrailWindowSec,
      SERIES_HABITS_WINDOW_MIN_SECONDS,
      SERIES_HABITS_WINDOW_MAX_SECONDS,
      defaults.habitsTrailWindowSec,
    ),
    seriesMaxFiles: parseClampedInt(
      raw.seriesMaxFiles,
      SERIES_MIN_FILES,
      SERIES_MAX_FILES_HARD,
      defaults.seriesMaxFiles,
    ),
    pdfTheme: parsePdfTheme(raw.pdfTheme),
    pdfPhotos: parsePdfPhotos(raw.pdfPhotos),
    radarGray: parseClampedNumber(
      raw.radarGray,
      RADAR_GRAY_MIN,
      RADAR_GRAY_MAX,
      defaults.radarGray,
    ),
  };
}
