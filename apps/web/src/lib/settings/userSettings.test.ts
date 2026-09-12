import { describe, expect, it } from "vitest";
import { DEFAULT_LEAD_IN_SEC } from "@/lib/match/roundEvents";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { DEFAULT_LAYERS, DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import {
  DEFAULT_PLAYBACK_SPEED,
  DEFAULT_RADAR_GRAY,
  NOTE_MOMENT_MAX_SECONDS,
  NOTE_MOMENT_MIN_SECONDS,
  NOTE_MOMENT_SECONDS,
  PARSE_POOL_HARD_MAX,
  PARSE_POOL_MAX,
  PARSE_POOL_MIN,
  RADAR_GRAY_MAX,
  RADAR_GRAY_MIN,
  SAVED_NOTES_PAGE_SIZE,
  SAVED_NOTES_PAGE_SIZE_MAX,
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
import {
  USER_SETTINGS_SCHEMA,
  cloneUserSettings,
  defaultUserSettings,
  parseUserSettings,
} from "./userSettings";

describe("defaultUserSettings", () => {
  it("matches shipped app defaults", () => {
    const settings = defaultUserSettings(1_700_000_000_000);
    expect(settings).toEqual({
      schema: USER_SETTINGS_SCHEMA,
      updatedAt: 1_700_000_000_000,
      parsePoolMax: PARSE_POOL_MAX,
      sidebarWidth: SIDEBAR_DEFAULT_WIDTH,
      savedNotesPageSize: SAVED_NOTES_PAGE_SIZE,
      defaultPaletteId: "neon",
      defaultColor: "#ff2d6a",
      defaultFloorMode: "auto",
      defaultSummaryFilter: DEFAULT_SUMMARY_FILTER,
      defaultLayers: DEFAULT_LAYERS,
      defaultPlaybackSpeed: DEFAULT_PLAYBACK_SPEED,
      eventLeadInSec: DEFAULT_LEAD_IN_SEC,
      noteMomentSec: NOTE_MOMENT_SECONDS,
      habitsTrailWindowSec: SERIES_HABITS_WINDOW_SECONDS,
      seriesMaxFiles: SERIES_MAX_FILES,
      pdfTheme: "dark",
      pdfPhotos: "with",
      radarGray: DEFAULT_RADAR_GRAY,
    });
    expect(settings.defaultPaletteId).toBe(COLOR_PRESETS[0].id);
    expect(settings.defaultColor).toBe(COLOR_PRESETS[0].colors[0]);
    expect("roundAutoplay" in settings).toBe(false);
  });

  it("copies nested defaults so callers cannot mutate shipped objects", () => {
    const settings = defaultUserSettings();
    settings.defaultLayers.names = false;
    settings.defaultSummaryFilter.kinds.flash = false;
    expect(DEFAULT_LAYERS.names).toBe(true);
    expect(DEFAULT_SUMMARY_FILTER.kinds.flash).toBe(true);
  });
});

describe("parseUserSettings", () => {
  it("fills missing fields from defaults and ignores unknown keys", () => {
    const parsed = parseUserSettings({
      sidebarWidth: 520,
      roundAutoplay: true,
      id: "user",
    });
    expect(parsed.sidebarWidth).toBe(520);
    expect(parsed.parsePoolMax).toBe(PARSE_POOL_MAX);
    expect(parsed.eventLeadInSec).toBe(DEFAULT_LEAD_IN_SEC);
    expect(parsed.habitsTrailWindowSec).toBe(SERIES_HABITS_WINDOW_SECONDS);
    expect(parsed.pdfTheme).toBe("dark");
    expect(parsed.pdfPhotos).toBe("with");
    expect(parsed.radarGray).toBe(DEFAULT_RADAR_GRAY);
    expect(parsed.schema).toBe(USER_SETTINGS_SCHEMA);
    expect("roundAutoplay" in parsed).toBe(false);
    expect("id" in parsed).toBe(false);
  });

  it("clamps out-of-range numbers and rejects bad enums", () => {
    const parsed = parseUserSettings({
      parsePoolMax: 99,
      sidebarWidth: 12,
      savedNotesPageSize: 100,
      defaultPaletteId: "nope",
      defaultColor: "",
      defaultFloorMode: "roof",
      defaultPlaybackSpeed: 3,
      eventLeadInSec: 9,
      noteMomentSec: 400,
      habitsTrailWindowSec: 90,
      seriesMaxFiles: 1,
      pdfTheme: "sepia",
      pdfPhotos: "color",
      radarGray: 4,
    });
    expect(parsed.parsePoolMax).toBe(PARSE_POOL_HARD_MAX);
    expect(parsed.sidebarWidth).toBe(SIDEBAR_MIN_WIDTH);
    expect(parsed.savedNotesPageSize).toBe(SAVED_NOTES_PAGE_SIZE_MAX);
    expect(parsed.defaultPaletteId).toBe("neon");
    expect(parsed.defaultColor).toBe("#ff2d6a");
    expect(parsed.defaultFloorMode).toBe("auto");
    expect(parsed.defaultPlaybackSpeed).toBe(DEFAULT_PLAYBACK_SPEED);
    expect(parsed.eventLeadInSec).toBe(5);
    expect(parsed.noteMomentSec).toBe(NOTE_MOMENT_MAX_SECONDS);
    expect(parsed.habitsTrailWindowSec).toBe(SERIES_HABITS_WINDOW_MAX_SECONDS);
    expect(parsed.seriesMaxFiles).toBe(SERIES_MIN_FILES);
    expect(parsed.pdfTheme).toBe("dark");
    expect(parsed.pdfPhotos).toBe("with");
    expect(parsed.radarGray).toBe(RADAR_GRAY_MAX);
  });

  it("keeps a stored light PDF theme", () => {
    expect(parseUserSettings({ pdfTheme: "light" }).pdfTheme).toBe("light");
  });

  it("keeps a stored PDF photos choice", () => {
    expect(parseUserSettings({ pdfPhotos: "without" }).pdfPhotos).toBe("without");
    expect(parseUserSettings({ pdfPhotos: "with" }).pdfPhotos).toBe("with");
  });

  it("keeps a stored color map and migrates missing or invalid radarGray to full gray", () => {
    expect(parseUserSettings({ radarGray: 0 }).radarGray).toBe(RADAR_GRAY_MIN);
    expect(parseUserSettings({ radarGray: 0.35 }).radarGray).toBe(0.35);
    expect(parseUserSettings({}).radarGray).toBe(DEFAULT_RADAR_GRAY);
    expect(parseUserSettings({ radarGray: "gray" }).radarGray).toBe(DEFAULT_RADAR_GRAY);
    expect(parseUserSettings({ radarGray: Number.NaN }).radarGray).toBe(DEFAULT_RADAR_GRAY);
    expect(parseUserSettings({ radarGray: -2 }).radarGray).toBe(RADAR_GRAY_MIN);
  });

  it("keeps a stored series cap of 12 and clamps above the hard ceiling", () => {
    expect(parseUserSettings({ seriesMaxFiles: SERIES_MAX_FILES }).seriesMaxFiles).toBe(
      SERIES_MAX_FILES,
    );
    expect(parseUserSettings({ seriesMaxFiles: SERIES_MAX_FILES_HARD }).seriesMaxFiles).toBe(
      SERIES_MAX_FILES_HARD,
    );
    expect(parseUserSettings({ seriesMaxFiles: SERIES_MAX_FILES_HARD + 1 }).seriesMaxFiles).toBe(
      SERIES_MAX_FILES_HARD,
    );
  });

  it("clamps the low end of parse pool and moment length", () => {
    const parsed = parseUserSettings({
      parsePoolMax: 0,
      noteMomentSec: 0,
      habitsTrailWindowSec: 1,
      defaultPlaybackSpeed: 4,
      defaultFloorMode: "lower",
    });
    expect(parsed.parsePoolMax).toBe(PARSE_POOL_MIN);
    expect(parsed.noteMomentSec).toBe(NOTE_MOMENT_MIN_SECONDS);
    expect(parsed.habitsTrailWindowSec).toBe(SERIES_HABITS_WINDOW_MIN_SECONDS);
    expect(parsed.defaultPlaybackSpeed).toBe(4);
    expect(parsed.defaultFloorMode).toBe("lower");
  });

  it("merges partial layer and summary-filter objects", () => {
    const parsed = parseUserSettings({
      defaultLayers: { heatmap: true, names: false },
      defaultSummaryFilter: {
        t: false,
        kinds: { flash: false, molotov: false },
      },
    });
    expect(parsed.defaultLayers).toEqual({
      ...DEFAULT_LAYERS,
      heatmap: true,
      names: false,
    });
    expect(parsed.defaultSummaryFilter.t).toBe(false);
    expect(parsed.defaultSummaryFilter.ct).toBe(true);
    expect(parsed.defaultSummaryFilter.kinds.flash).toBe(false);
    expect(parsed.defaultSummaryFilter.kinds.molotov).toBe(false);
    expect(parsed.defaultSummaryFilter.kinds.incendiary).toBe(false);
  });

  it("returns defaults for a non-object blob", () => {
    expect(parseUserSettings(null).sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(parseUserSettings("nope").parsePoolMax).toBe(PARSE_POOL_MAX);
  });

  it("cloneUserSettings copies nested objects", () => {
    const original = defaultUserSettings();
    const copy = cloneUserSettings(original);
    copy.defaultLayers.cone = false;
    copy.defaultSummaryFilter.ct = false;
    expect(original.defaultLayers.cone).toBe(true);
    expect(original.defaultSummaryFilter.ct).toBe(true);
  });

  it("widens sidebar to the named max", () => {
    expect(parseUserSettings({ sidebarWidth: 900 }).sidebarWidth).toBe(SIDEBAR_MAX_WIDTH);
  });
});
