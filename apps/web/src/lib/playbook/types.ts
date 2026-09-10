import type { FloorMode, Note } from "@/lib/notes/types";

export const PLAYBOOK_SCHEMA = 2;
/** Oldest playbook JSON we still migrate (no `videos` on the page). */
export const PLAYBOOK_SCHEMA_MIN = 1;
export const UNTITLED_STRAT = "Untitled strat";
export const UNTITLED_PLAYBOOK = "Untitled playbook";
export const COPY_SUFFIX = " copy";
export const PLAYBOOK_PREFERRED_MAP = "de_mirage";

/** Tutorial / lineup clip attached to a playbook strat. */
export interface PlaybookYouTube {
  id: string;
  videoId: string;
  url: string;
  title: string;
  /** World XY — same space as playbook tokens. */
  x: number;
  y: number;
  startSeconds?: number;
}

export interface PlaybookPage {
  id: string;
  /** Strat name. Always set; default `UNTITLED_STRAT`. */
  title: string;
  /** Free-form notes for this strat. */
  body: string;
  floor: FloorMode;
  note: Note;
  videos: PlaybookYouTube[];
}

export interface Playbook {
  schema: number;
  key: string;
  mapName: string;
  title: string;
  savedAt: number;
  /** Order among playbooks on the same map. Lower is higher in the tree. */
  sort: number;
  pages: PlaybookPage[];
  activePageId: string;
  paletteId: string;
  color: string;
}
