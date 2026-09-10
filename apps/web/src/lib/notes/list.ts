import { NOTE_BOOKMARK_TITLE } from "@/lib/shared/constants";
import { bookmarkTitle } from "./bookmarks";
import type { NoteItemRef } from "./noteGroups";
import type { Drawing, Note, RoundNote } from "./types";

export function drawingTitle(drawing: Drawing): string {
  if (drawing.type === "text") return drawing.text;
  if (drawing.type === "pen") return "Pen";
  return "Arrow";
}

export function itemTitle(note: Note, ref: NoteItemRef): string {
  if (ref.kind === "bookmark") {
    const mark = note.bookmarks[ref.index];
    return mark ? bookmarkTitle(mark) : NOTE_BOOKMARK_TITLE;
  }
  const drawing =
    ref.kind === "loose"
      ? note.drawings[ref.index]
      : note.groups[ref.groupIndex]?.drawings[ref.drawingIndex];
  return drawing ? drawingTitle(drawing) : "";
}

export function itemColor(note: Note, ref: NoteItemRef): string {
  if (ref.kind === "bookmark") return note.bookmarks[ref.index]?.color ?? "#fff";
  const drawing =
    ref.kind === "loose"
      ? note.drawings[ref.index]
      : note.groups[ref.groupIndex]?.drawings[ref.drawingIndex];
  return drawing?.color ?? "#fff";
}

export function itemHidden(note: Note, ref: NoteItemRef): boolean {
  if (ref.kind === "bookmark") return Boolean(note.bookmarks[ref.index]?.hidden);
  if (ref.kind === "loose") return Boolean(note.drawings[ref.index]?.hidden);
  const group = note.groups[ref.groupIndex];
  const drawing = group?.drawings[ref.drawingIndex];
  return Boolean(group?.hidden || drawing?.hidden);
}

export function windowKind(win: { start: number; end: number } | null): string {
  if (!win) return "Whole round";
  if (win.end <= win.start) return "Pin";
  return "Moment";
}

export function groupLabel(id: string): string {
  const m = /^g(\d+)$/.exec(id);
  return m ? `Group ${m[1]}` : id;
}

export interface NoteListItem {
  ref: NoteItemRef;
  title: string;
  color: string;
  hidden: boolean;
  type: Drawing["type"] | "bookmark";
}

export interface NoteListCluster {
  groupIndex: number | null;
  groupId: string | null;
  groupName: string | null;
  groupHidden: boolean;
  items: NoteListItem[];
}

function listItem(note: Note, ref: NoteItemRef, type: NoteListItem["type"]): NoteListItem {
  return {
    ref,
    title: itemTitle(note, ref),
    color: itemColor(note, ref),
    hidden: itemHidden(note, ref),
    type,
  };
}

export function clusterNote(note: Note): NoteListCluster[] {
  const clustered: NoteListCluster[] = note.groups.map((group, groupIndex) => ({
    groupIndex,
    groupId: group.id,
    groupName: group.name,
    groupHidden: Boolean(group.hidden),
    items: group.drawings.map((drawing, drawingIndex) =>
      listItem(note, { kind: "group", groupIndex, drawingIndex }, drawing.type),
    ),
  }));
  const loose: NoteListItem[] = [
    ...note.drawings.map((drawing, index) =>
      listItem(note, { kind: "loose", index }, drawing.type),
    ),
    ...note.bookmarks.map((_, index) => listItem(note, { kind: "bookmark", index }, "bookmark")),
  ];
  if (loose.length > 0) {
    clustered.push({
      groupIndex: null,
      groupId: null,
      groupName: null,
      groupHidden: false,
      items: loose,
    });
  }
  return clustered;
}

export function notesByRound(rows: readonly RoundNote[]): RoundNote[] {
  return [...rows].sort((a, b) => a.round - b.round);
}
