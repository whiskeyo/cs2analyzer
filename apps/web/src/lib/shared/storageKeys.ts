/**
 * Browser storage keys for preferences that `todos/USER-SETTINGS.md` will
 * fold into IndexedDB. Keep string values stable so a later migrator can
 * read today's localStorage / sessionStorage.
 *
 * Dead key (no UI write): `cs2analyzer.seriesTrailWindowSec` — do not reuse.
 */
export const STORAGE_KEYS = {
  sidebarWidth: "cs2analyzer.sidebarWidth",
  eventLeadInSec: "cs2analyzer.eventLeadInSec",
  roundAutoplay: "cs2analyzer.roundAutoplay",
  playbookTreeWidth: "cs2analyzer.playbookTreeWidth",
  playbookDetailWidth: "cs2analyzer.playbookDetailWidth",
  layoutsSidebarWidth: "cs2analyzer.layoutsSidebarWidth",
  playbookFocus: "cs2analyzer.playbook.focus",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export const SIDEBAR_WIDTH_STORAGE_KEY = STORAGE_KEYS.sidebarWidth;
export const LEAD_IN_STORAGE_KEY = STORAGE_KEYS.eventLeadInSec;
export const ROUND_AUTOPLAY_STORAGE_KEY = STORAGE_KEYS.roundAutoplay;
export const PLAYBOOK_TREE_WIDTH_STORAGE_KEY = STORAGE_KEYS.playbookTreeWidth;
export const PLAYBOOK_DETAIL_WIDTH_STORAGE_KEY = STORAGE_KEYS.playbookDetailWidth;
export const LAYOUTS_SIDEBAR_WIDTH_STORAGE_KEY = STORAGE_KEYS.layoutsSidebarWidth;
export const PLAYBOOK_FOCUS_KEY = STORAGE_KEYS.playbookFocus;
