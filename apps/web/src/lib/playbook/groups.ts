import { NOTE_GROUP_NAME_MAX } from "@/lib/shared/constants";
import { cloneNote } from "@/lib/notes/note";
import { nextGroupId } from "@/lib/notes/noteGroups";
import type { Drawing, Note } from "@/lib/notes/types";

function takeLooseDrawing(note: Note, index: number): Drawing | null {
  const drawing = note.drawings[index];
  if (!drawing) return null;
  note.drawings.splice(index, 1);
  return drawing;
}

function takeGroupedDrawing(note: Note, groupId: string, index: number): Drawing | null {
  const group = note.groups.find((row) => row.id === groupId);
  const drawing = group?.drawings[index];
  if (!group || !drawing) return null;
  group.drawings.splice(index, 1);
  return drawing;
}

export function groupOverlayItems(note: Note, ids: readonly string[]): Note {
  const unique = [...new Set(ids)];
  if (unique.length < 2) return note;
  const next = cloneNote(note);
  const drawings: Drawing[] = [];
  const pieceIds: string[] = [];
  const drawingIds = unique
    .filter((id) => id.startsWith("drawing:") || id.startsWith("group:"))
    .sort((a, b) => b.localeCompare(a));
  for (const id of drawingIds) {
    if (id.startsWith("drawing:")) {
      const index = Number(id.slice("drawing:".length));
      const drawing = takeLooseDrawing(next, index);
      if (drawing) drawings.push(drawing);
      continue;
    }
    const rest = id.slice("group:".length);
    const sep = rest.lastIndexOf(":");
    const groupId = rest.slice(0, sep);
    const index = Number(rest.slice(sep + 1));
    const drawing = takeGroupedDrawing(next, groupId, index);
    if (drawing) drawings.push(drawing);
  }
  for (const id of unique) {
    if (!id.startsWith("piece:")) continue;
    const pieceId = id.slice("piece:".length);
    const piece = next.pieces.find((row) => row.id === pieceId);
    if (piece) pieceIds.push(piece.id);
  }
  if (drawings.length + pieceIds.length < 2) return note;
  for (const pieceId of pieceIds) {
    const piece = next.pieces.find((row) => row.id === pieceId);
    if (piece) delete piece.groupId;
  }
  next.groups = next.groups.filter(
    (group) => group.drawings.length > 0 || groupHasPieces(next, group.id),
  );
  const groupId = nextGroupId(next);
  next.groups.push({ id: groupId, name: groupId, drawings: drawings.reverse() });
  for (const pieceId of pieceIds) {
    const piece = next.pieces.find((row) => row.id === pieceId);
    if (piece) piece.groupId = groupId;
  }
  return next;
}

function groupHasPieces(note: Note, groupId: string): boolean {
  return note.pieces.some((piece) => piece.groupId === groupId);
}

export function setGroupHidden(note: Note, groupId: string, hidden: boolean): Note {
  const next = cloneNote(note);
  const group = next.groups.find((row) => row.id === groupId);
  if (!group) return note;
  if (hidden) group.hidden = true;
  else delete group.hidden;
  return next;
}

export function renamePlaybookGroup(note: Note, groupId: string, name: string): Note {
  const nextName = name.trim().slice(0, NOTE_GROUP_NAME_MAX);
  const group = note.groups.find((row) => row.id === groupId);
  if (!group || nextName === "" || nextName === group.name) return note;
  const next = cloneNote(note);
  const target = next.groups.find((row) => row.id === groupId);
  if (!target) return note;
  target.name = nextName;
  return next;
}

export function ungroupPlaybookGroup(note: Note, groupId: string): Note {
  const group = note.groups.find((row) => row.id === groupId);
  if (!group) return note;
  const next = cloneNote(note);
  const index = next.groups.findIndex((row) => row.id === groupId);
  if (index < 0) return note;
  const [removed] = next.groups.splice(index, 1);
  if (removed) next.drawings.push(...removed.drawings);
  for (const piece of next.pieces) {
    if (piece.groupId === groupId) delete piece.groupId;
  }
  if (next.radarFx) {
    for (const trail of next.radarFx.trails) {
      if (trail.groupId === groupId) delete trail.groupId;
    }
  }
  return next;
}
