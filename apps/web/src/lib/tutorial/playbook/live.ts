import { addSnapshotPage } from "@/lib/playbook/snapshot";
import type { Drawing, DrawingGroup, FloorMode, NoteRadarFx, Piece } from "@/lib/notes/types";
import type { Playbook } from "@/lib/playbook/types";
import { tutorialPlaybook } from "./sample";

let live: Playbook | null = null;

/** In-memory tutorial book. Snapshots during the tour append here, not IndexedDB. */
export function getTutorialPlaybookLive(): Playbook {
  live ??= structuredClone(tutorialPlaybook);
  return live;
}

export function setTutorialPlaybookLive(book: Playbook): void {
  live = book;
}

export function resetTutorialPlaybookLive(): void {
  live = null;
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
  const current = getTutorialPlaybookLive();
  const tagged = current.mapName === opts.mapName ? current : { ...current, mapName: opts.mapName };
  const next = addSnapshotPage(
    tagged,
    opts.stratTitle,
    opts.pieces,
    opts.floor ?? "auto",
    opts.radarFx,
    opts.groups,
    opts.drawings,
  );
  setTutorialPlaybookLive(next);
  return { book: next, pageId: next.activePageId };
}
