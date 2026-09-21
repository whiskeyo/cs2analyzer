import { addSnapshotPage } from "@/lib/playbook/snapshot";
import { newPlaybook } from "@/lib/playbook/pages";
import type { Drawing, DrawingGroup, FloorMode, NoteRadarFx, Piece } from "@/lib/notes/types";
import type { Playbook } from "@/lib/playbook/types";
import { TUTORIAL_PLAYBOOK_TITLE, tutorialPlaybookKey } from "./constants";
import { tutorialPlaybooks } from "./sample";

let live: Playbook[] | null = null;

function cloneBooks(books: Playbook[]): Playbook[] {
  return books.map((book) => structuredClone(book));
}

/** In-memory tutorial books, one per map that has content. Not IndexedDB. */
export function getTutorialPlaybooksLive(): Playbook[] {
  live ??= cloneBooks(tutorialPlaybooks);
  return live;
}

export function setTutorialPlaybooksLive(books: Playbook[]): void {
  live = books;
}

export function resetTutorialPlaybookLive(): void {
  live = null;
}

export function emptyTutorialPlaybook(mapName: string): Playbook {
  return { ...newPlaybook(mapName, TUTORIAL_PLAYBOOK_TITLE), key: tutorialPlaybookKey(mapName) };
}

export function getTutorialPlaybookForMap(mapName: string): Playbook | null {
  return getTutorialPlaybooksLive().find((book) => book.mapName === mapName) ?? null;
}

/** Display stub for the snapshot picker. Not written until Snapshot. */
export function tutorialSnapshotDestination(mapName: string): Playbook {
  return getTutorialPlaybookForMap(mapName) ?? emptyTutorialPlaybook(mapName);
}

export function writeTutorialSnapshot(opts: {
  mapName: string;
  stratTitle: string;
  pieces: Piece[];
  floor?: FloorMode;
  radarFx?: NoteRadarFx;
  groups?: DrawingGroup[];
  drawings?: Drawing[];
}): { book: Playbook; pageId: string } {
  const books = getTutorialPlaybooksLive();
  const current = getTutorialPlaybookForMap(opts.mapName) ?? emptyTutorialPlaybook(opts.mapName);
  const next = addSnapshotPage(
    current,
    opts.stratTitle,
    opts.pieces,
    opts.floor ?? "auto",
    opts.radarFx,
    opts.groups,
    opts.drawings,
  );
  setTutorialPlaybooksLive([...books.filter((book) => book.mapName !== opts.mapName), next]);
  return { book: next, pageId: next.activePageId };
}
