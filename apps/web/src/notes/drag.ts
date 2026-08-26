import type { Stroke } from "../types";

export interface NoteDrag {
  round: number;
  indexes: number[];
}

export function indexesForDrag(index: number, selected: number[], strokes: Stroke[]): number[] {
  if (selected.includes(index)) {
    const round = strokes[index]?.round;
    return selected.filter((i) => strokes[i]?.round === round);
  }
  return [index];
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

export function parseDrag(raw: string): NoteDrag | null {
  try {
    const v = JSON.parse(raw) as NoteDrag;
    if (typeof v.round === "number" && Array.isArray(v.indexes)) return v;
  } catch {
    return null;
  }
  return null;
}
