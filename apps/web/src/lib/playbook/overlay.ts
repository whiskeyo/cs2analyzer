import { cloneNote } from "@/lib/notes/note";
import type { Drawing, Note, Piece } from "@/lib/notes/types";
import { pieceKindLabel, pieceLabel, removePiece } from "./pieces";
import { radarFxIsEmpty } from "./snapshot";

export type OverlayKind = "piece" | "drawing" | "fx";

export type OverlayRow = {
  id: string;
  kind: OverlayKind;
  label: string;
  detail?: string;
  piece?: Piece;
};

function drawingLabel(drawing: Drawing): string {
  if (drawing.type === "pen") return "Pen";
  if (drawing.type === "arrow") return "Arrow";
  const text = drawing.text.trim();
  return text === "" ? "Text" : `Text “${text}”`;
}

export function overlayRows(note: Note): OverlayRow[] {
  const rows: OverlayRow[] = [];
  for (const piece of note.pieces) {
    rows.push({
      id: `piece:${piece.id}`,
      kind: "piece",
      label: pieceKindLabel(piece.kind),
      detail: pieceLabel(piece),
      piece,
    });
  }
  for (const group of note.groups) {
    group.drawings.forEach((drawing, index) => {
      rows.push({
        id: `group:${group.id}:${index}`,
        kind: "drawing",
        label: drawingLabel(drawing),
        detail: group.name,
      });
    });
  }
  note.drawings.forEach((drawing, index) => {
    rows.push({
      id: `drawing:${index}`,
      kind: "drawing",
      label: drawingLabel(drawing),
    });
  });
  note.bookmarks.forEach((bookmark, index) => {
    const text = bookmark.text.trim();
    rows.push({
      id: `bookmark:${index}`,
      kind: "drawing",
      label: text === "" ? "Bookmark" : text,
    });
  });
  const fx = note.radarFx;
  if (!fx) return rows;
  fx.deaths.forEach((death, index) => {
    rows.push({
      id: `fx:death:${index}`,
      kind: "fx",
      label: death.line ? "Kill" : "Death",
    });
  });
  if (fx.opening) {
    rows.push({ id: "fx:opening", kind: "fx", label: "FK/FD" });
  }
  fx.tracers.forEach((_, index) => {
    rows.push({ id: `fx:tracer:${index}`, kind: "fx", label: "Tracer" });
  });
  fx.trails.forEach((_, index) => {
    rows.push({ id: `fx:trail:${index}`, kind: "fx", label: "Player trail" });
  });
  if (fx.heatmap.length > 0) {
    rows.push({
      id: "fx:heatmap",
      kind: "fx",
      label: `Heatmap (${fx.heatmap.length})`,
    });
  }
  if (fx.summary.length > 0) {
    rows.push({
      id: "fx:summary",
      kind: "fx",
      label: `Summary (${fx.summary.length})`,
    });
  }
  if (fx.cone) {
    rows.push({ id: "fx:cone", kind: "fx", label: "View cone" });
  }
  fx.hits.forEach((_, index) => {
    rows.push({ id: `fx:hit:${index}`, kind: "fx", label: "Hit" });
  });
  fx.flashes.forEach((_, index) => {
    rows.push({ id: `fx:flash:${index}`, kind: "fx", label: "Flash" });
  });
  return rows;
}

function indexedId(prefix: string, id: string): number | null {
  if (!id.startsWith(prefix)) return null;
  const n = Number(id.slice(prefix.length));
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function dropFxArray<T>(items: T[], index: number): T[] | null {
  if (index >= items.length) return null;
  return items.filter((_, i) => i !== index);
}

export function removeOverlay(note: Note, id: string): Note {
  if (id.startsWith("piece:")) {
    return removePiece(note, id.slice("piece:".length));
  }
  const next = cloneNote(note);
  if (id.startsWith("group:")) {
    const rest = id.slice("group:".length);
    const sep = rest.lastIndexOf(":");
    const groupId = rest.slice(0, sep);
    const index = Number(rest.slice(sep + 1));
    const group = next.groups.find((row) => row.id === groupId);
    if (!group || !Number.isInteger(index) || index < 0 || index >= group.drawings.length) {
      return note;
    }
    group.drawings.splice(index, 1);
    if (group.drawings.length === 0) {
      next.groups = next.groups.filter((row) => row.id !== groupId);
    }
    return next;
  }
  const drawingIndex = indexedId("drawing:", id);
  if (drawingIndex != null) {
    if (drawingIndex >= next.drawings.length) return note;
    next.drawings.splice(drawingIndex, 1);
    return next;
  }
  const bookmarkIndex = indexedId("bookmark:", id);
  if (bookmarkIndex != null) {
    if (bookmarkIndex >= next.bookmarks.length) return note;
    next.bookmarks.splice(bookmarkIndex, 1);
    return next;
  }
  const fx = next.radarFx;
  if (!fx) return note;
  if (id === "fx:opening") {
    if (!fx.opening) return note;
    fx.opening = null;
    return radarFxIsEmpty(fx) ? omitRadarFx(next) : next;
  }
  if (id === "fx:cone") {
    if (!fx.cone) return note;
    fx.cone = null;
    return radarFxIsEmpty(fx) ? omitRadarFx(next) : next;
  }
  if (id === "fx:heatmap") {
    if (fx.heatmap.length === 0) return note;
    fx.heatmap = [];
    return radarFxIsEmpty(fx) ? omitRadarFx(next) : next;
  }
  if (id === "fx:summary") {
    if (fx.summary.length === 0) return note;
    fx.summary = [];
    return radarFxIsEmpty(fx) ? omitRadarFx(next) : next;
  }
  const deathIndex = indexedId("fx:death:", id);
  if (deathIndex != null) {
    const deaths = dropFxArray(fx.deaths, deathIndex);
    if (!deaths) return note;
    fx.deaths = deaths;
    return radarFxIsEmpty(fx) ? omitRadarFx(next) : next;
  }
  const tracerIndex = indexedId("fx:tracer:", id);
  if (tracerIndex != null) {
    const tracers = dropFxArray(fx.tracers, tracerIndex);
    if (!tracers) return note;
    fx.tracers = tracers;
    return radarFxIsEmpty(fx) ? omitRadarFx(next) : next;
  }
  const trailIndex = indexedId("fx:trail:", id);
  if (trailIndex != null) {
    const trails = dropFxArray(fx.trails, trailIndex);
    if (!trails) return note;
    fx.trails = trails;
    return radarFxIsEmpty(fx) ? omitRadarFx(next) : next;
  }
  const hitIndex = indexedId("fx:hit:", id);
  if (hitIndex != null) {
    const hits = dropFxArray(fx.hits, hitIndex);
    if (!hits) return note;
    fx.hits = hits;
    return radarFxIsEmpty(fx) ? omitRadarFx(next) : next;
  }
  const flashIndex = indexedId("fx:flash:", id);
  if (flashIndex != null) {
    const flashes = dropFxArray(fx.flashes, flashIndex);
    if (!flashes) return note;
    fx.flashes = flashes;
    return radarFxIsEmpty(fx) ? omitRadarFx(next) : next;
  }
  return note;
}

function omitRadarFx(note: Note): Note {
  delete note.radarFx;
  return note;
}
