import { parseJson } from "@/lib/validate/json.ts";
import { refsEqual, type NoteItemRef } from "./noteGroups";

export interface NotePick {
  round: number;
  ref: NoteItemRef;
}

export interface NoteDrag {
  round: number;
  refs: NoteItemRef[];
}

export function pickKey(pick: NotePick): string {
  if (pick.ref.kind === "group") {
    return `${pick.round}:g:${pick.ref.groupIndex}:${pick.ref.drawingIndex}`;
  }
  return `${pick.round}:${pick.ref.kind}:${pick.ref.index}`;
}

export function picksEqual(a: NotePick, b: NotePick): boolean {
  return a.round === b.round && refsEqual(a.ref, b.ref);
}

export function refsForDrag(ref: NoteItemRef, selected: NotePick[], round: number): NoteItemRef[] {
  if (selected.some((pick) => pick.round === round && refsEqual(pick.ref, ref))) {
    return selected.filter((pick) => pick.round === round).map((pick) => pick.ref);
  }
  return [ref];
}

export function eventElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

export function isDragControl(target: EventTarget | null): boolean {
  const el = eventElement(target);
  if (!el) return false;
  return Boolean(
    el.closest(
      "input, textarea, select, label.note-pick, .note-io, .note-eye, .note-remove, .note-cluster-fold, .note-cluster-count",
    ),
  );
}

function setRowsDraggable(cluster: HTMLElement, on: boolean) {
  cluster.querySelectorAll<HTMLElement>(".note-row").forEach((row) => {
    row.draggable = on;
  });
}

/** Freeze folder vs row before HTML5's move threshold, so a downward grab still picks up the box. */
export function lockNoteDrag(cluster: HTMLElement, target: EventTarget | null, folder: boolean) {
  const el = eventElement(target);
  if (isDragControl(el)) return;
  const row = el?.closest(".note-row");
  if (row instanceof HTMLElement && cluster.contains(row)) {
    cluster.draggable = false;
    setRowsDraggable(cluster, false);
    row.draggable = true;
    return;
  }
  if (!folder) return;
  cluster.draggable = true;
  setRowsDraggable(cluster, false);
}

export function unlockNoteDrag(cluster: HTMLElement, folder: boolean) {
  cluster.draggable = folder;
  setRowsDraggable(cluster, true);
}

function parseRef(v: unknown): NoteItemRef | null {
  if (!v || typeof v !== "object") return null;
  const row = v as {
    kind?: unknown;
    index?: unknown;
    groupIndex?: unknown;
    drawingIndex?: unknown;
  };
  if (row.kind === "loose" && typeof row.index === "number")
    return { kind: "loose", index: row.index };
  if (row.kind === "bookmark" && typeof row.index === "number") {
    return { kind: "bookmark", index: row.index };
  }
  if (
    row.kind === "group" &&
    typeof row.groupIndex === "number" &&
    typeof row.drawingIndex === "number"
  ) {
    return { kind: "group", groupIndex: row.groupIndex, drawingIndex: row.drawingIndex };
  }
  return null;
}

export function parseDrag(raw: string): NoteDrag | null {
  try {
    const v = parseJson(raw) as NoteDrag;
    if (typeof v.round !== "number" || !Array.isArray(v.refs)) return null;
    const refs = v.refs.map(parseRef).filter((ref): ref is NoteItemRef => ref != null);
    if (refs.length !== v.refs.length) return null;
    return { round: v.round, refs };
  } catch {
    return null;
  }
}
