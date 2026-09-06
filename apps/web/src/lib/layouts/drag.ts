import { parseJson } from "@/lib/validate/json.ts";

export interface CalloutDrag {
  ids: string[];
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
      "input, textarea, select, label.callout-pick, .callout-cluster-fold, .callout-cluster-nudge",
    ),
  );
}

function setRowsDraggable(cluster: HTMLElement, on: boolean) {
  cluster.querySelectorAll<HTMLElement>(".callout-row").forEach((row) => {
    row.draggable = on;
  });
}

export function lockCalloutDrag(cluster: HTMLElement, target: EventTarget | null, folder: boolean) {
  const el = eventElement(target);
  if (isDragControl(el)) return;
  const row = el?.closest(".callout-row");
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

export function unlockCalloutDrag(cluster: HTMLElement, folder: boolean) {
  cluster.draggable = folder;
  setRowsDraggable(cluster, true);
}

export function parseDrag(raw: string): CalloutDrag | null {
  try {
    const v = parseJson(raw) as CalloutDrag;
    if (Array.isArray(v.ids) && v.ids.every((id) => typeof id === "string")) return v;
  } catch {
    return null;
  }
  return null;
}
