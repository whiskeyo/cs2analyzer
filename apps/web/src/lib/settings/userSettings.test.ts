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
  PATH_BRANCH_MERGE_DISTANCE,
  PATH_BRANCH_MERGE_MAX,
  PATH_BRANCH_MERGE_MIN,
  PATH_BRANCH_MIN_SHARE,
  PATH_BRANCH_MIN_SHARE_MAX,
  PATH_BRANCH_MIN_SHARE_MIN,
  PATH_BRANCH_STEP_DISTANCE,
  PATH_BRANCH_STEP_GAP,
  PATH_BRANCH_STEP_MIN,
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
  applyUserSettingsPatch,
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
      defaultDrawTool: "pan",
      defaultSidebarTab: "score",
      defaultFloorMode: "auto",
      defaultSummaryFilter: DEFAULT_SUMMARY_FILTER,
      defaultLayers: DEFAULT_LAYERS,
      defaultPlaybackSpeed: DEFAULT_PLAYBACK_SPEED,
      eventLeadInSec: DEFAULT_LEAD_IN_SEC,
      noteMomentSec: NOTE_MOMENT_SECONDS,
      habitsTrailWindowSec: SERIES_HABITS_WINDOW_SECONDS,
      pathBranchMergeDistance: PATH_BRANCH_MERGE_DISTANCE,
      pathBranchStepDistance: PATH_BRANCH_STEP_DISTANCE,
      pathBranchMinShare: PATH_BRANCH_MIN_SHARE,
      skipKnifeOnOpen: true,
      seriesMaxFiles: SERIES_MAX_FILES,
      pdfTheme: "dark",
      pdfPhotos: "with",
      radarGray: DEFAULT_RADAR_GRAY,
      tutorialCompleted: false,
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
    expect(parsed.pathBranchMergeDistance).toBe(PATH_BRANCH_MERGE_DISTANCE);
    expect(parsed.pathBranchStepDistance).toBe(PATH_BRANCH_STEP_DISTANCE);
    expect(parsed.pathBranchMinShare).toBe(PATH_BRANCH_MIN_SHARE);
    expect(parsed.skipKnifeOnOpen).toBe(true);
    expect(parsed.pdfTheme).toBe("dark");
    expect(parsed.pdfPhotos).toBe("with");
    expect(parsed.radarGray).toBe(DEFAULT_RADAR_GRAY);
    expect(parsed.tutorialCompleted).toBe(false);
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
      defaultDrawTool: "eraser",
      defaultSidebarTab: "clutch",
      defaultPlaybackSpeed: 3,
      skipKnifeOnOpen: "yes",
      eventLeadInSec: 9,
      noteMomentSec: 400,
      habitsTrailWindowSec: 90,
      pathBranchMergeDistance: 9000,
      pathBranchStepDistance: 9000,
      pathBranchMinShare: 1,
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
    expect(parsed.defaultDrawTool).toBe("pan");
    expect(parsed.defaultSidebarTab).toBe("score");
    expect(parsed.defaultPlaybackSpeed).toBe(DEFAULT_PLAYBACK_SPEED);
    expect(parsed.skipKnifeOnOpen).toBe(true);
    expect(parsed.eventLeadInSec).toBe(5);
    expect(parsed.noteMomentSec).toBe(NOTE_MOMENT_MAX_SECONDS);
    expect(parsed.habitsTrailWindowSec).toBe(SERIES_HABITS_WINDOW_MAX_SECONDS);
    expect(parsed.pathBranchMergeDistance).toBe(PATH_BRANCH_MERGE_MAX);
    expect(parsed.pathBranchStepDistance).toBeLessThan(parsed.pathBranchMergeDistance);
    expect(parsed.pathBranchMinShare).toBe(PATH_BRANCH_MIN_SHARE_MAX);
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
      pathBranchMergeDistance: 1,
      pathBranchStepDistance: 1,
      pathBranchMinShare: -0.2,
      defaultPlaybackSpeed: 4,
      defaultFloorMode: "lower",
      defaultDrawTool: "pen",
      defaultSidebarTab: "notes",
    });
    expect(parsed.parsePoolMax).toBe(PARSE_POOL_MIN);
    expect(parsed.noteMomentSec).toBe(NOTE_MOMENT_MIN_SECONDS);
    expect(parsed.habitsTrailWindowSec).toBe(SERIES_HABITS_WINDOW_MIN_SECONDS);
    expect(parsed.pathBranchMergeDistance).toBe(PATH_BRANCH_MERGE_MIN);
    expect(parsed.pathBranchStepDistance).toBe(PATH_BRANCH_STEP_MIN);
    expect(parsed.pathBranchMinShare).toBe(PATH_BRANCH_MIN_SHARE_MIN);
    expect(parsed.defaultPlaybackSpeed).toBe(4);
    expect(parsed.defaultFloorMode).toBe("lower");
    expect(parsed.defaultDrawTool).toBe("pen");
    expect(parsed.defaultSidebarTab).toBe("notes");
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

  it("applyUserSettingsPatch resolves a function against the current document", () => {
    const current = defaultUserSettings();
    const fromFn = applyUserSettingsPatch(current, (settings) => ({
      defaultSummaryFilter: { ...settings.defaultSummaryFilter, t: false },
    }));
    expect(fromFn.defaultSummaryFilter?.t).toBe(false);
    expect(fromFn.defaultSummaryFilter?.ct).toBe(true);
    expect(applyUserSettingsPatch(current, { sidebarWidth: 520 }).sidebarWidth).toBe(520);
  });

  it("widens sidebar to the named max", () => {
    expect(parseUserSettings({ sidebarWidth: 900 }).sidebarWidth).toBe(SIDEBAR_MAX_WIDTH);
  });

  it("keeps skipKnifeOnOpen false when stored", () => {
    expect(parseUserSettings({ skipKnifeOnOpen: false }).skipKnifeOnOpen).toBe(false);
  });

  it("treats a missing tutorialCompleted key as not completed", () => {
    expect(parseUserSettings({}).tutorialCompleted).toBe(false);
    expect(parseUserSettings({ tutorialCompleted: true }).tutorialCompleted).toBe(true);
    expect(parseUserSettings({ tutorialCompleted: "yes" }).tutorialCompleted).toBe(false);
  });

  it("clamps Overall path knobs and keeps step below merge", () => {
    const stored = parseUserSettings({
      pathBranchMergeDistance: 400,
      pathBranchStepDistance: 192,
      pathBranchMinShare: 0.1,
    });
    expect(stored.pathBranchMergeDistance).toBe(400);
    expect(stored.pathBranchStepDistance).toBe(192);
    expect(stored.pathBranchMinShare).toBe(0.1);

    const squeezed = parseUserSettings({
      pathBranchMergeDistance: 128,
      pathBranchStepDistance: 400,
    });
    expect(squeezed.pathBranchMergeDistance).toBe(128);
    expect(squeezed.pathBranchStepDistance).toBe(128 - PATH_BRANCH_STEP_GAP);
    expect(squeezed.pathBranchMinShare).toBe(PATH_BRANCH_MIN_SHARE);
  });

  it("drops a leftover livePawnLegend field", () => {
    expect("livePawnLegend" in parseUserSettings({ livePawnLegend: true })).toBe(false);
  });
});
