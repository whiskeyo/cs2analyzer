import { createElement, Fragment, type ReactNode } from "react";

export type MessageVars = Record<string, string | number>;

/**
 * Nested chrome catalogs. Both `en` and `pl` `satisfies Messages`, so a missing
 * Polish key is a type error. FAQ article bodies stay English (Phase 4).
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
