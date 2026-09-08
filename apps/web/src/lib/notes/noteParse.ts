import { NOTE_BOOKMARK_TITLE } from "@/lib/shared/constants";
import { isFiniteNumber, isRecord, isString } from "@/lib/validate/guards.ts";
import { emptyNote } from "./note";
import type {
  Bookmark,
  Drawing,
  DrawingGroup,
  DrawingShape,
  Note,
  NoteRadarFx,
  Piece,
  PieceKind,
  RoundNote,
} from "./types";

const PIECE_KINDS: readonly PieceKind[] = [
  "pawn",
  "smoke",
  "flash",
  "he",
  "molotov",
  "incendiary",
  "decoy",
  "bomb",
];

function isPoint(v: unknown): v is { x: number; y: number } {
  return isRecord(v) && isFiniteNumber(v.x) && isFiniteNumber(v.y);
}

function optionalTick(v: unknown): number | undefined {
  return isFiniteNumber(v) ? v : undefined;
}

function optionalSize(v: unknown): number | undefined {
  return isFiniteNumber(v) && v > 0 ? v : undefined;
}

function optionalString(v: unknown): string | undefined {
  return isString(v) && v.trim() !== "" ? v.trim() : undefined;
}

function withWindow<T extends object>(base: T, o: Record<string, unknown>): T {
  const start_tick = optionalTick(o.start_tick);
  const end_tick = optionalTick(o.end_tick);
  const hidden = o.hidden === true;
  return {
    ...base,
    ...(start_tick != null ? { start_tick } : {}),
    ...(end_tick != null ? { end_tick } : {}),
    ...(hidden ? { hidden: true } : {}),
  };
}

export function parseDrawingShape(v: unknown): DrawingShape | null {
  if (!isRecord(v) || !isString(v.color)) return null;
  if (v.type === "pen" && Array.isArray(v.points) && v.points.every(isPoint)) {
    return { type: "pen", color: v.color, points: v.points };
  }
  if (v.type === "arrow" && isPoint(v.from) && isPoint(v.to)) {
    return { type: "arrow", color: v.color, from: v.from, to: v.to };
  }
  if (
    v.type === "text" &&
    isFiniteNumber(v.x) &&
    isFiniteNumber(v.y) &&
    isString(v.text) &&
    v.text.trim() !== ""
  ) {
    const box_w = optionalSize(v.box_w);
    const box_h = optionalSize(v.box_h);
    return {
      type: "text",
      color: v.color,
      x: v.x,
      y: v.y,
      text: v.text,
      ...(box_w != null ? { box_w } : {}),
      ...(box_h != null ? { box_h } : {}),
    };
  }
  return null;
}

export function parseDrawing(v: unknown): Drawing | null {
  if (!isRecord(v)) return null;
  const nested = isRecord(v.shape) ? v.shape : isRecord(v.drawing) ? v.drawing : v;
  const shape = parseDrawingShape(nested);
  if (!shape) return null;
  return withWindow(shape, v);
}

function parseGroup(v: unknown): DrawingGroup | null {
  if (!isRecord(v) || !Array.isArray(v.drawings)) return null;
  const name = optionalString(v.name) ?? optionalString(v.id);
  if (!name) return null;
  const drawings: Drawing[] = [];
  for (const d of v.drawings) {
    const parsed = parseDrawing(d);
    if (parsed) drawings.push(parsed);
  }
  const id = optionalString(v.id) ?? name;
  return withWindow({ id, name, drawings }, v);
}

function parseBookmark(v: unknown): Bookmark | null {
  if (!isRecord(v) || !isString(v.color)) return null;
  const text = isString(v.text) && v.text.trim() !== "" ? v.text : NOTE_BOOKMARK_TITLE;
  const tick = optionalTick(v.tick) ?? optionalTick(v.start_tick);
  if (tick == null) return null;
  return withWindow({ color: v.color, text, tick }, v);
}

function parsePiece(v: unknown): Piece | null {
  if (!isRecord(v) || !isString(v.id) || v.id.trim() === "") return null;
  if (!isString(v.kind) || !PIECE_KINDS.includes(v.kind as PieceKind)) return null;
  if (!isFiniteNumber(v.x) || !isFiniteNumber(v.y)) return null;
  const piece: Piece = {
    id: v.id.trim(),
    kind: v.kind as PieceKind,
    x: v.x,
    y: v.y,
  };
  if (isFiniteNumber(v.z)) piece.z = v.z;
  if (isFiniteNumber(v.yaw)) piece.yaw = v.yaw;
  if (v.side === "CT" || v.side === "T") piece.side = v.side;
  const label = optionalString(v.label);
  if (label) piece.label = label;
  if (v.alive === false) piece.alive = false;
  if (v.alive === true) piece.alive = true;
  if (v.carriesC4 === true) piece.carriesC4 = true;
  const color = optionalString(v.color);
  if (color) piece.color = color;
  const groupId = optionalString(v.groupId);
  if (groupId) piece.groupId = groupId;
  if (v.nadeStyle === "icon" || v.nadeStyle === "effect") piece.nadeStyle = v.nadeStyle;
  if (Array.isArray(v.trail)) {
    const trail: { x: number; y: number }[] = [];
    for (const pt of v.trail) {
      if (isPoint(pt)) trail.push({ x: pt.x, y: pt.y });
    }
    if (trail.length > 0) piece.trail = trail;
  }
  return piece;
}

function parsePoint(v: unknown): { x: number; y: number } | null {
  return isPoint(v) ? { x: v.x, y: v.y } : null;
}

function parseRadarFx(v: unknown): NoteRadarFx | undefined {
  if (!isRecord(v)) return undefined;
  const deaths: NoteRadarFx["deaths"] = [];
  if (Array.isArray(v.deaths)) {
    for (const row of v.deaths) {
      if (!isRecord(row) || !isFiniteNumber(row.x) || !isFiniteNumber(row.y)) continue;
      let line: NoteRadarFx["deaths"][number]["line"] = null;
      if (isRecord(row.line) && isPoint(row.line.from) && isPoint(row.line.to)) {
        if (
          isString(row.line.color) &&
          isFiniteNumber(row.line.alpha) &&
          isFiniteNumber(row.line.lineWidth)
        ) {
          line = {
            from: { x: row.line.from.x, y: row.line.from.y },
            to: { x: row.line.to.x, y: row.line.to.y },
            color: row.line.color,
            alpha: row.line.alpha,
            lineWidth: row.line.lineWidth,
          };
        }
      }
      deaths.push({ x: row.x, y: row.y, line });
    }
  }
  let opening: NoteRadarFx["opening"] = null;
  if (
    isRecord(v.opening) &&
    isPoint(v.opening.from) &&
    isPoint(v.opening.to) &&
    isString(v.opening.color)
  ) {
    opening = {
      from: { x: v.opening.from.x, y: v.opening.from.y },
      to: { x: v.opening.to.x, y: v.opening.to.y },
      color: v.opening.color,
    };
  }
  const tracers: NoteRadarFx["tracers"] = [];
  if (Array.isArray(v.tracers)) {
    for (const row of v.tracers) {
      if (
        !isRecord(row) ||
        !isFiniteNumber(row.x) ||
        !isFiniteNumber(row.y) ||
        !isFiniteNumber(row.yaw) ||
        !isFiniteNumber(row.fade)
      ) {
        continue;
      }
      tracers.push({ x: row.x, y: row.y, yaw: row.yaw, fade: row.fade });
    }
  }
  const trails: NoteRadarFx["trails"] = [];
  if (Array.isArray(v.trails)) {
    for (const row of v.trails) {
      if (!isRecord(row) || !isString(row.color) || !Array.isArray(row.points)) continue;
      const points = row.points
        .map(parsePoint)
        .filter((p): p is { x: number; y: number } => p != null);
      if (points.length === 0) continue;
      const groupId = optionalString(row.groupId);
      const label = optionalString(row.label);
      trails.push({
        points,
        color: row.color,
        ...(groupId ? { groupId } : {}),
        ...(label ? { label } : {}),
      });
    }
  }
  const heatmap: NoteRadarFx["heatmap"] = [];
  if (Array.isArray(v.heatmap)) {
    for (const row of v.heatmap) {
      if (
        !isRecord(row) ||
        !isFiniteNumber(row.x) ||
        !isFiniteNumber(row.y) ||
        !isFiniteNumber(row.radius) ||
        !isString(row.color)
      ) {
        continue;
      }
      heatmap.push({ x: row.x, y: row.y, radius: row.radius, color: row.color });
    }
  }
  const summary: NoteRadarFx["summary"] = [];
  if (Array.isArray(v.summary)) {
    for (const row of v.summary) {
      if (
        !isRecord(row) ||
        !isFiniteNumber(row.x) ||
        !isFiniteNumber(row.y) ||
        !isFiniteNumber(row.radius) ||
        !isString(row.color)
      ) {
        continue;
      }
      summary.push({ x: row.x, y: row.y, radius: row.radius, color: row.color });
    }
  }
  let cone: NoteRadarFx["cone"] = null;
  if (
    isRecord(v.cone) &&
    isFiniteNumber(v.cone.x) &&
    isFiniteNumber(v.cone.y) &&
    isFiniteNumber(v.cone.yaw) &&
    isFiniteNumber(v.cone.radius) &&
    isString(v.cone.color)
  ) {
    cone = {
      x: v.cone.x,
      y: v.cone.y,
      yaw: v.cone.yaw,
      radius: v.cone.radius,
      color: v.cone.color,
    };
  }
  const hits: NoteRadarFx["hits"] = [];
  if (Array.isArray(v.hits)) {
    for (const row of v.hits) {
      if (
        !isRecord(row) ||
        !isFiniteNumber(row.x) ||
        !isFiniteNumber(row.y) ||
        !isFiniteNumber(row.innerRadius) ||
        !isFiniteNumber(row.ringRadius) ||
        !isFiniteNumber(row.innerAlpha) ||
        !isFiniteNumber(row.ringAlpha)
      ) {
        continue;
      }
      hits.push({
        x: row.x,
        y: row.y,
        innerRadius: row.innerRadius,
        ringRadius: row.ringRadius,
        innerAlpha: row.innerAlpha,
        ringAlpha: row.ringAlpha,
      });
    }
  }
  const flashes: NoteRadarFx["flashes"] = [];
  if (Array.isArray(v.flashes)) {
    for (const row of v.flashes) {
      if (
        !isRecord(row) ||
        !isFiniteNumber(row.x) ||
        !isFiniteNumber(row.y) ||
        !isFiniteNumber(row.intensity) ||
        !isFiniteNumber(row.pulseRadius) ||
        !isFiniteNumber(row.left)
      ) {
        continue;
      }
      flashes.push({
        x: row.x,
        y: row.y,
        intensity: row.intensity,
        pulseRadius: row.pulseRadius,
        left: row.left,
      });
    }
  }
  const fx: NoteRadarFx = {
    deaths,
    opening,
    tracers,
    trails,
    heatmap,
    summary,
    cone,
    hits,
    flashes,
  };
  if (
    deaths.length === 0 &&
    opening == null &&
    tracers.length === 0 &&
    trails.length === 0 &&
    heatmap.length === 0 &&
    summary.length === 0 &&
    cone == null &&
    hits.length === 0 &&
    flashes.length === 0
  ) {
    return undefined;
  }
  return fx;
}

export function parseNote(v: unknown): Note | null {
  if (!isRecord(v)) return null;
  const note = emptyNote();
  if (Array.isArray(v.groups)) {
    for (const g of v.groups) {
      const group = parseGroup(g);
      if (group) note.groups.push(group);
    }
  }
  if (Array.isArray(v.drawings) || Array.isArray(v.loose)) {
    const rows = Array.isArray(v.drawings) ? v.drawings : v.loose;
    if (Array.isArray(rows)) {
      for (const item of rows) {
        const parsed = parseDrawing(item);
        if (parsed) note.drawings.push(parsed);
      }
    }
  }
  if (Array.isArray(v.pieces)) {
    for (const p of v.pieces) {
      const piece = parsePiece(p);
      if (piece) note.pieces.push(piece);
    }
  }
  if (Array.isArray(v.bookmarks)) {
    for (const b of v.bookmarks) {
      const mark = parseBookmark(b);
      if (mark) note.bookmarks.push(mark);
    }
  }
  const radarFx = parseRadarFx(v.radarFx);
  if (radarFx) note.radarFx = radarFx;
  return note;
}

export function parseRoundNote(v: unknown): RoundNote | null {
  if (!isRecord(v) || !isFiniteNumber(v.round)) return null;
  const note = parseNote(v.note);
  if (!note) return null;
  return { round: v.round, note };
}

export function parseRoundNotes(v: unknown): RoundNote[] {
  if (!Array.isArray(v)) return [];
  const out: RoundNote[] = [];
  for (const row of v) {
    const parsed = parseRoundNote(row);
    if (parsed) out.push(parsed);
  }
  return out;
}
