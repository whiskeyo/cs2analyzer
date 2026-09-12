import { createElement, Fragment, type ReactNode } from "react";

export type MessageVars = Record<string, string | number>;

type FaqArticle = { question: string; body: string };

/**
 * Nested chrome catalogs. Each locale under `translations/` `satisfies Messages`,
 * so a missing Polish key is a type error. FAQ copy lives in
 * `translations/{locale}/faq.ts`.
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
