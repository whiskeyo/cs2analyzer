export type MessageVars = Record<string, string | number>;

/**
 * Nested chrome catalogs. Both `en` and `pl` `satisfies Messages`, so a missing
 * Polish key is a type error. Phase 3+ surfaces (HUD, playbook, FAQ bodies) are
 * not in this shape yet.
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
    weaponsFrom: string;
    mitAnd: string;
    end: string;
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
    faqHintBefore: string;
    faqHintLink: string;
    faqHintAfter: string;
  };
  faq: {
    title: string;
    lead: string;
  };
  drop: {
    title: string;
    blurbBefore: string;
    blurbAfter: string;
    parsedLocal: string;
    savedLeadBefore: string;
    savedLeadAfter: string;
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
    restoreBefore: string;
    restoreAfter: string;
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
    languageEnglish: string;
    languagePolish: string;
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
}

/** `{name}` replacement only. Unknown names stay as `{name}`; extra vars are ignored. */
export function t(template: string, vars?: MessageVars): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (whole, name: string) => {
    if (Object.hasOwn(vars, name)) {
      return String(vars[name]);
    }
    return whole;
  });
}
