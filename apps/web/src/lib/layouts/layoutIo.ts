import { parseJson } from "@/lib/validate/json.ts";
import { parseMapLayout } from "./layout";
import type { MapLayout } from "./types";

export type LayoutTextResult =
  { ok: true; layout: MapLayout } | { ok: false; reason: "json" | "schema" };

export function parseLayoutText(text: string): LayoutTextResult {
  let raw: unknown;
  try {
    raw = parseJson(text);
  } catch {
    return { ok: false, reason: "json" };
  }
  const layout = parseMapLayout(raw);
  if (!layout) return { ok: false, reason: "schema" };
  return { ok: true, layout };
}

export function triggerLayoutDownload(mapId: string, text: string): void {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${mapId}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
