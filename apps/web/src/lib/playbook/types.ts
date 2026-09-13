import type { FloorMode, Note } from "@/lib/notes/types";

export const PLAYBOOK_SCHEMA = 4;
/** Oldest playbook JSON we still migrate (no `videos` on the page). */
export const PLAYBOOK_SCHEMA_MIN = 1;

export const PLAYBOOK_IMAGE_MIMES = ["image/png", "image/jpeg", "image/webp"] as const;
export type PlaybookImageMime = (typeof PLAYBOOK_IMAGE_MIMES)[number];
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

/** Local lineup still. Bytes live in the image IDB store, not on this row. */
export interface PlaybookImage {
  id: string;
  name: string;
  mime: PlaybookImageMime;
  /** World XY of the image center — same space as tokens / YouTube pins. */
  x: number;
  y: number;
  /** World-space size. Resize keeps the source aspect. */
  width: number;
  height: number;
}

export interface PlaybookPage {
  id: string;
  /** Strat name. Always set; default `UNTITLED_STRAT`. */
  title: string;
  /** Free-form notes for this strat. */
  body: string;
  floor: FloorMode;
  /** Drawings and tokens on the upper (or only) radar. */
  note: Note;
  videos: PlaybookYouTube[];
  images: PlaybookImage[];
  /** Drawings and tokens on the lower radar. Empty on single-level maps. */
  lowerNote: Note;
  lowerVideos: PlaybookYouTube[];
  lowerImages: PlaybookImage[];
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
