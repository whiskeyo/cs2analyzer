import type { FloorMode, Note } from "@/lib/notes/types";

export const PLAYBOOK_SCHEMA = 1;
export const UNTITLED_STRAT = "Untitled strat";
export const UNTITLED_PLAYBOOK = "Untitled playbook";
export const COPY_SUFFIX = " copy";
export const PLAYBOOK_PREFERRED_MAP = "de_mirage";

export interface PlaybookPage {
  id: string;
  /** Strat name. Always set; default `UNTITLED_STRAT`. */
  title: string;
  floor: FloorMode;
  note: Note;
}

export interface Playbook {
  schema: number;
  key: string;
  mapName: string;
  title: string;
  savedAt: number;
  pages: PlaybookPage[];
  activePageId: string;
  paletteId: string;
  color: string;
}
