import { createElement, Fragment, type ReactNode } from "react";
import type { BombEventKind } from "@/lib/match/roundEvents";
import { windowKind } from "@/lib/notes/list";
import type { FloorMode } from "@/lib/notes/types";
import type { RoundKind } from "@/lib/parse/roundTags";
import type { GrenadeKind } from "@/lib/replay/replayTypes";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import {
  WIN_REASON_BOMB,
  WIN_REASON_CT_ELIM,
  WIN_REASON_CT_SURRENDER,
  WIN_REASON_DEFUSE,
  WIN_REASON_DRAW,
  WIN_REASON_TIME,
  WIN_REASON_T_ELIM,
  WIN_REASON_T_SURRENDER,
} from "@/lib/shared/constants";
import { en } from "./translations/en";
import { pl } from "./translations/pl";

export { en, pl };

export const LOCALES = ["en", "pl"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Endonyms for the Preferences picker. Adding a locale is one row here plus `translations/xx.ts`. */
export const LOCALE_ENDONYMS: Record<Locale, string> = {
  en: "English",
  pl: "Polski",
};

const LOCALE_TAGS: Record<Locale, string> = {
  en: "en-US",
  pl: "pl-PL",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Unknown or missing values become English. */
export function parseLocale(value: unknown): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** BCP 47 tag for `Intl` / `toLocaleString`. Unknown codes fall back to en-US. */
export function localeTag(locale: Locale): string {
  return LOCALE_TAGS[locale] ?? LOCALE_TAGS[DEFAULT_LOCALE];
}

export function localeEndonym(locale: Locale): string {
  return LOCALE_ENDONYMS[locale] ?? LOCALE_ENDONYMS[DEFAULT_LOCALE];
}

export type MessageVars = Record<string, string | number>;

type FaqArticle = { question: string; body: string };

/**
 * Nested chrome catalogs. Each locale file `satisfies Messages`, so a missing
 * Polish key is a type error. FAQ copy lives on `messages.faq`.
 *
 * Sentences that mix copy with links or `<code>` stay **one string per locale**
 * with `{slot}` placeholders so Polish can reorder freely. Do not split a
 * sentence across adjacent catalog keys.
 */
export interface Messages {
  nav: {
    site: string;
    analyzer: string;
    playbook: string;
    faq: string;
  };
  header: {
    homeAria: string;
    brand: string;
    preRelease: string;
    preReleaseTip: string;
    newDemo: string;
    exportCsv: string;
    exportCsvAggregatedTitle: string;
  };
  credits: {
    github: string;
    issues: string;
    donate: string;
    attribution: string;
  };
  home: {
    kicker: string;
    title: string;
    lead: string;
    featureRadar: string;
    featureScoreboard: string;
    featureHabits: string;
    featureKillfeed: string;
    featureMore: string;
    faqHint: string;
    faqLink: string;
  };
  faq: {
    title: string;
    lead: string;
    whatIs: FaqArticle;
    privacy: FaqArticle;
    whatToDrop: FaqArticle;
    savedNotes: FaqArticle;
    stats: {
      question: string;
      intro: string;
      adrHeading: string;
      adrBody: string;
      sidesHeading: string;
      sidesBody: string;
    };
    gotvOrPov: FaqArticle;
    browsers: FaqArticle;
    affiliation: FaqArticle;
    preRelease: FaqArticle;
    report: FaqArticle & { issuesLink: string };
  };
  drop: {
    title: string;
    blurb: string;
    parsedLocal: string;
    savedLead: string;
    savedTitle: string;
    unnamedDemo: string;
    drawingOne: string;
    drawingOther: string;
    linked: string;
    player: string;
    linkDemo: string;
    linkDemoTitle: string;
    deleteNotes: string;
    deleteNotesTitle: string;
    previous: string;
    next: string;
    unknownTime: string;
    restoreTitle: string;
    restoreBody: string;
    close: string;
  };
  parse: {
    percent: string;
    overall: string;
    done: string;
    error: string;
    queued: string;
  };
  settings: {
    aria: string;
    app: string;
    preferences: string;
    notes: string;
    exportNotes: string;
    importNotes: string;
    removeNotes: string;
    playbook: string;
    exportPlaybooks: string;
    importPlaybooks: string;
    importPlaybooksFile: string;
    removePlaybooks: string;
    development: string;
    layoutsEditor: string;
  };
  preferences: {
    title: string;
    lead: string;
    language: string;
    performance: string;
    parseWorkers: string;
    parseWorkersHint: string;
    parseWorkersWarn: string;
    maxDemos: string;
    maxDemosHint: string;
    layout: string;
    sidebarWidth: string;
    savedNotesPageSize: string;
    drawing: string;
    drawingHint: string;
    radar: string;
    radarHint: string;
    defaultFloor: string;
    floorAuto: string;
    floorUpper: string;
    floorLower: string;
    defaultLayers: string;
    layerGrenades: string;
    layerShots: string;
    layerDeaths: string;
    layerOpenings: string;
    layerNames: string;
    layerCone: string;
    layerHeatmap: string;
    layerSummary: string;
    defaultNadeSummary: string;
    playback: string;
    playbackHint: string;
    defaultSpeed: string;
    eventLeadIn: string;
    momentLength: string;
    close: string;
    resetAll: string;
    resetTitle: string;
    resetBody: string;
    cancel: string;
    resetConfirm: string;
  };
  hud: {
    knife: string;
    roundNumber: string;
    freeze: string;
    roundWin: string;
    plant: string;
    c4: string;
    defuse: string;
    defuseWithKit: string;
    clutch: string;
  };
  winReason: {
    bomb: string;
    defuse: string;
    ctElim: string;
    tElim: string;
    draw: string;
    time: string;
    tSurrender: string;
    ctSurrender: string;
    unknown: string;
    none: string;
  };
  nade: {
    smoke: string;
    molly: string;
    flash: string;
    he: string;
    decoy: string;
    incendiary: string;
  };
  bombEvent: {
    planted: string;
    defused: string;
    exploded: string;
    defusing: string;
    planting: string;
  };
  palette: {
    neon: string;
    heat: string;
    night: string;
    mark: string;
    cycleTitle: string;
    swatchTitle: string;
  };
  toolbar: {
    pan: string;
    draw: string;
    arrow: string;
    textNote: string;
    bookmarkTick: string;
    erase: string;
    undoDrawing: string;
    redoDrawing: string;
    clearRoundDrawings: string;
    resetView: string;
    snapshotPlaybook: string;
    trackPlayer: string;
    trail: string;
    momentHint: string;
  };
  textNote: {
    dragToMove: string;
    placeholder: string;
  };
  killfeed: {
    flashAssist: string;
    noScope: string;
    throughSmoke: string;
    wallbang: string;
    airborne: string;
    blind: string;
    headshot: string;
  };
  spectator: {
    cashInventory: string;
    boughtThisFreeze: string;
    lastHit: string;
    lastHitArmor: string;
    knife: string;
  };
  playback: {
    play: string;
    pause: string;
    prevRound: string;
    nextRound: string;
    prevKill: string;
    nextKill: string;
    stepBack: string;
    stepForward: string;
    skipFreeze: string;
    skipFreezeTitle: string;
    speed: string;
    roundTimeline: string;
    knife: string;
    freezeClock: string;
    autoplayOn: string;
    autoplayOff: string;
    roundStrip: string;
    roundHasExecute: string;
    roundHasNotes: string;
    bucketStepBack: string;
    bucketStepForward: string;
    bucketTimeline: string;
    seriesRoundsGroup: string;
    seriesBucketOverlay: string;
    seriesRoundChip: string;
  };
  timeline: {
    bombPlanted: string;
    bombDefused: string;
    bombExploded: string;
  };
  roundKind: {
    pistol: string;
    eco: string;
    force: string;
    full: string;
  };
  sidebar: {
    tabScore: string;
    tabReview: string;
    tabNotes: string;
    tabAction: string;
    tabUtility: string;
    tabRounds: string;
    tabWeapons: string;
    tabDisabledAggregated: string;
    resize: string;
    hintSelectPlayer: string;
    ratingThroughTick: string;
    weaponsHint: string;
    weaponsAll: string;
    weaponsRange: string;
    untilNow: string;
    allGame: string;
    colWeapon: string;
    colKills: string;
    colHeadshots: string;
    colDamage: string;
    scorePlayer: string;
    scoreKills: string;
    scoreDeaths: string;
    scoreAssists: string;
    scoreRating: string;
    scoreEntry: string;
    bot: string;
    detailKda: string;
    detailRatingImpact: string;
    detailPerRound: string;
    detailSideSplit: string;
    detailDamage: string;
    detailHsUtil: string;
    detailOpening: string;
    entrySuccess: string;
    teamEntryShare: string;
    detailTrades: string;
    detailFlashes: string;
    detailFlashAssists: string;
    detailNadesSurvived: string;
    detailClutches: string;
    detailMultis: string;
    detailPlants: string;
    notesEmpty: string;
    notesUsage: string;
    squash: string;
    group: string;
    ungroup: string;
    reviewEmpty: string;
    reviewHeader: string;
    reviewLive: string;
    reviewLiveDetail: string;
    reviewNoNotes: string;
    reviewSort: string;
    sortRound: string;
    sortSeverity: string;
    actionHint: string;
    actionFilters: string;
    allRounds: string;
    thisRound: string;
    sideBoth: string;
    allGroups: string;
    noRounds: string;
    kindExecute: string;
    kindPlant: string;
    kindRetake: string;
    kindFight: string;
    utilHeader: string;
    utilMatch: string;
    nadesHeading: string;
    thrownCount: string;
    siteSummary: string;
    nadeTypeFilters: string;
    showAllTypes: string;
    calloutFilters: string;
    showAllPositions: string;
    utilEmptyMatch: string;
    utilEmptyFilters: string;
    kickerEnemy: string;
    kickerTeam: string;
    leadIn: string;
    collapseRound: string;
    expandRound: string;
    noRoundEvents: string;
    defusingKit: string;
    seriesRoundCount: string;
    firstWaveSets: string;
    utilFrequency: string;
    actionBeats: string;
    emptyBucket: string;
    seriesFocalTeam: string;
    seriesUtilHeader: string;
    seriesUtilThrown: string;
    seriesUtilEmpty: string;
    seriesActionHeader: string;
    seriesActionEmpty: string;
    seriesReviewHeader: string;
    seriesReviewEmpty: string;
    seriesDemoNotes: string;
    roundLabel: string;
    squashDrawings: string;
    dropUngroup: string;
    dropNewGroup: string;
    showLayerMembers: string;
    hideLayerMembers: string;
    selectNamed: string;
    jumpToLayer: string;
    showLayerRadar: string;
    hideLayerRadar: string;
    showTimeline: string;
    hideTimeline: string;
    showRadar: string;
    hideRadar: string;
    removeBookmark: string;
    renameHint: string;
    bookmarkName: string;
    layerName: string;
    clockStart: string;
    clockEnd: string;
    clockLater: string;
    clockEarlier: string;
    clockPlayhead: string;
    clockIn: string;
    clockOut: string;
    clockWholeRound: string;
    clockRoundBtn: string;
    notePin: string;
    noteMoment: string;
    noteWholeRound: string;
    noteHidden: string;
  };
  dialog: {
    removeNotesTitle: string;
    removePlaybooksTitle: string;
    removeNotesBody: string;
    removePlaybooksBody: string;
    typeToConfirm: string;
    removeNotesPhrase: string;
    removePlaybooksPhrase: string;
    confirmPhrase: string;
    removeNotesConfirm: string;
    removePlaybooksConfirm: string;
  };
  analyzer: {
    series: string;
    mapSelect: string;
    seriesView: string;
    aggregated: string;
    taggedRounds: string;
    team: string;
    side: string;
    buy: string;
    player: string;
    focalTeam: string;
    habitsSide: string;
    habitsBuy: string;
    filterPlayer: string;
    allPlayers: string;
    overlay: string;
    arrows: string;
    trails: string;
    paths: string;
    heatmap: string;
    pathDisplay: string;
    bucketMeta: string;
    bucketMetaHeat: string;
    bucketMetaPaths: string;
    bucketMetaPathsOff: string;
    bucketMetaArrows: string;
    bucketMetaArrowsOff: string;
    bucketMetaNades: string;
    utilKinds: string;
    hideAllUtil: string;
    showUtil: string;
    utilOpacity: string;
    utilOpacityAria: string;
    switching: string;
    hotkeys: string;
  };
  headerMeta: {
    match: string;
    overtime: string;
  };
  pageTitle: {
    home: string;
    analyzer: string;
    playbook: string;
    faq: string;
  };
  playbook: {
    createTitle: string;
    createBlurb: string;
    createCta: string;
    createSubmit: string;
    createError: string;
    dialogTitle: string;
    dialogLead: string;
    fieldMap: string;
    fieldBookTitle: string;
    fieldStratName: string;
    untitledBook: string;
    untitledStrat: string;
    treeHeading: string;
    treeLead: string;
    treeAria: string;
    emptyMap: string;
    mapExpandTip: string;
    bookTip: string;
    stratTip: string;
    resizeTree: string;
    resizePanel: string;
    keysHint: string;
    menuNewBook: string;
    menuNewStrat: string;
    menuRename: string;
    menuDuplicateBook: string;
    menuDuplicateStrat: string;
    menuMoveUp: string;
    menuMoveDown: string;
    menuDeleteBook: string;
    menuDeleteStrat: string;
    stratHeading: string;
    stratNotes: string;
    stratNotesPlaceholder: string;
    onRadar: string;
    groupSelected: string;
    overlayEmpty: string;
    hidden: string;
    shown: string;
    toolsAria: string;
    toolPan: string;
    toolPen: string;
    toolArrow: string;
    toolEraser: string;
    toolUndo: string;
    toolRedo: string;
    toolResetView: string;
    nadeTrail: string;
    nadeIcon: string;
    nadeEffect: string;
    videoLabel: string;
    videoLinkAria: string;
    videoPlaceholder: string;
    videoAdd: string;
    videoAdding: string;
    videoEmpty: string;
    videoInvalid: string;
    videoDuplicate: string;
    videoPinTitle: string;
    videoPinLead: string;
    videoOpen: string;
    snapshotTitle: string;
    snapshotLead: string;
    snapshotBook: string;
    snapshotNewBook: string;
    snapshotSubmit: string;
    snapshotSaved: string;
    snapshotOpen: string;
    snapshotError: string;
    importTitle: string;
    importLead: string;
    importReplaceMine: string;
    importKeepBoth: string;
    importMerge: string;
    importReplace: string;
    importRename: string;
    importSkip: string;
    importSubmit: string;
    legendAria: string;
    fieldBookRename: string;
    snapshotNewTitle: string;
    labelNamed: string;
    removeNamed: string;
    groupName: string;
    groupNamed: string;
    showNamed: string;
    hideNamed: string;
    ungroupNamed: string;
    removeClip: string;
    newTitleFor: string;
    stratNamed: string;
  };
  notice: {
    noSavedNotesYet: string;
    exportedNotesOne: string;
    exportedNotesOther: string;
    exportNotesFailed: string;
    noSavedNotes: string;
    removedNotesOne: string;
    removedNotesOther: string;
    removeNotesFailed: string;
    notesNotJson: string;
    notesEmptyFile: string;
    importedNotesOne: string;
    importedNotesOther: string;
    linkedFileMismatch: string;
    linkDemoHint: string;
    pickFileMismatch: string;
    linkedDemo: string;
    linkCancelled: string;
    noPlaybooksYet: string;
    exportedPlaybooksOne: string;
    exportedPlaybooksOther: string;
    exportPlaybooksFailed: string;
    importedPlaybooksOne: string;
    importedPlaybooksOther: string;
    importPlaybooksFailed: string;
    playbooksNotJson: string;
    playbooksEmptyFile: string;
    playbookImportConflicts: string;
  };
}

const PLACEHOLDER = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

/**
 * Split `{name}` placeholders into mixed parts. Unknown names stay as `{name}`;
 * extra vars are ignored. Used by `t` (strings) and `tNodes` (React slots).
 */
export function interpolateParts<T>(template: string, vars?: Record<string, T>): (string | T)[] {
  if (!vars) {
    return [template];
  }
  const parts: (string | T)[] = [];
  let last = 0;
  const re = new RegExp(PLACEHOLDER.source, "g");
  let match = re.exec(template);
  while (match) {
    if (match.index > last) {
      parts.push(template.slice(last, match.index));
    }
    const name = match[1];
    if (Object.hasOwn(vars, name)) {
      parts.push(vars[name]);
    } else {
      parts.push(match[0]);
    }
    last = match.index + match[0].length;
    match = re.exec(template);
  }
  if (last < template.length) {
    parts.push(template.slice(last));
  }
  return parts.length > 0 ? parts : [template];
}

/** `{name}` replacement for string/number vars. */
export function t(template: string, vars?: MessageVars): string {
  return interpolateParts(template, vars)
    .map((part) => String(part))
    .join("");
}

/**
 * Same placeholders as `t`, but a slot may be a React node (links, `<code>`).
 * Locales own word order; the caller only supplies named slots.
 */
export function tNodes(template: string, slots?: Record<string, ReactNode>): ReactNode {
  return interpolateParts(template, slots).map((part, index) =>
    createElement(Fragment, { key: index }, part),
  );
}

/** Live catalogs. Adding a locale is `translations/xx.ts` + one `LOCALES` entry. */
export const catalogs: Record<Locale, Messages> = {
  en,
  pl,
};

export function catalogFor(locale: Locale): Messages {
  switch (locale) {
    case "pl":
      return catalogs.pl;
    case "en":
    default:
      return catalogs[DEFAULT_LOCALE];
  }
}

export function winReasonText(messages: Messages, code: number): string {
  switch (code) {
    case WIN_REASON_BOMB:
      return messages.winReason.bomb;
    case WIN_REASON_DEFUSE:
      return messages.winReason.defuse;
    case WIN_REASON_CT_ELIM:
      return messages.winReason.ctElim;
    case WIN_REASON_T_ELIM:
      return messages.winReason.tElim;
    case WIN_REASON_DRAW:
      return messages.winReason.draw;
    case WIN_REASON_TIME:
      return messages.winReason.time;
    case WIN_REASON_T_SURRENDER:
      return messages.winReason.tSurrender;
    case WIN_REASON_CT_SURRENDER:
      return messages.winReason.ctSurrender;
    default:
      return code ? t(messages.winReason.unknown, { code }) : messages.winReason.none;
  }
}

export function nadeLabel(messages: Messages, kind: GrenadeKind): string {
  switch (kind) {
    case "smoke":
      return messages.nade.smoke;
    case "molotov":
      return messages.nade.molly;
    case "incendiary":
      return messages.nade.incendiary;
    case "flash":
      return messages.nade.flash;
    case "he":
      return messages.nade.he;
    case "decoy":
      return messages.nade.decoy;
    default:
      return messages.nade.he;
  }
}

export function bombEventLabel(messages: Messages, kind: BombEventKind): string {
  switch (kind) {
    case "planted":
      return messages.bombEvent.planted;
    case "defused":
      return messages.bombEvent.defused;
    case "exploded":
      return messages.bombEvent.exploded;
    case "begin_defuse":
      return messages.bombEvent.defusing;
    case "begin_plant":
      return messages.bombEvent.planting;
    default:
      return messages.bombEvent.planted;
  }
}

export function windowKindText(
  messages: Messages,
  win: { start: number; end: number } | null,
): string {
  switch (windowKind(win)) {
    case "Pin":
      return messages.sidebar.notePin;
    case "Moment":
      return messages.sidebar.noteMoment;
    case "Whole round":
    default:
      return messages.sidebar.noteWholeRound;
  }
}

export function paletteLabel(messages: Messages, id: string): string {
  switch (id) {
    case "neon":
      return messages.palette.neon;
    case "heat":
      return messages.palette.heat;
    case "night":
      return messages.palette.night;
    case "mark":
      return messages.palette.mark;
    default:
      return messages.palette.neon;
  }
}

export function floorLabel(messages: Messages, mode: FloorMode): string {
  switch (mode) {
    case "upper":
      return messages.preferences.floorUpper;
    case "lower":
      return messages.preferences.floorLower;
    case "auto":
    default:
      return messages.preferences.floorAuto;
  }
}

export function roundKindLabel(messages: Messages, kind: RoundKind): string {
  switch (kind) {
    case "pistol":
      return messages.roundKind.pistol;
    case "eco":
      return messages.roundKind.eco;
    case "force":
      return messages.roundKind.force;
    case "full":
    default:
      return messages.roundKind.full;
  }
}

export interface MessagesApi {
  locale: Locale;
  messages: Messages;
  t: typeof t;
  tNodes: typeof tNodes;
}

/**
 * Live catalog for `settings.locale`. Unknown codes and a missing provider
 * fall back to English so tests and first paint stay on the default locale.
 */
export function useMessages(): MessagesApi {
  const { settings } = useUserSettings();
  const locale = settings.locale ?? DEFAULT_LOCALE;
  return { locale, messages: catalogFor(locale), t, tNodes };
}
