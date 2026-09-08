import { COLOR_PRESETS } from "@/lib/notes/palettes";
import type { PlaybookTool } from "./pieces";

export const PLAYBOOK_TOOL_KEYS: Record<string, PlaybookTool> = {
  v: "pan",
  d: "pen",
  a: "arrow",
  e: "eraser",
  q: "pawn-ct",
  w: "pawn-t",
  s: "smoke",
  f: "flash",
  h: "he",
  m: "molotov",
  i: "incendiary",
  y: "decoy",
  b: "bomb",
};

export const PLAYBOOK_COLOR_KEYS = ["6", "7", "8", "9", "0"] as const;

export const PLAYBOOK_KEYS_HINT =
  "V pan · D pen · A arrow · E eraser · Q/W pawns · S F H M I Y nades · B bomb · N trail · G effect · R reset · [ ] palette · 6–0 colors · Ctrl+Z undo · Ctrl+Y redo · Esc cancel";

export const LAYOUT_KEYS_HINT =
  "1 pan · 2 polygon · 3 rect · 4 circle · 5 select · R reset view · G group · U ungroup · Ctrl+S save · Esc cancel · Del delete";

export function typingInField(): boolean {
  const el = document.activeElement;
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

export function cyclePaletteId(current: string, delta: -1 | 1): string {
  const index = COLOR_PRESETS.findIndex((preset) => preset.id === current);
  const from = index < 0 ? 0 : index;
  const next = (from + delta + COLOR_PRESETS.length) % COLOR_PRESETS.length;
  return COLOR_PRESETS[next]?.id ?? COLOR_PRESETS[0]!.id;
}

export function colorAtSwatch(paletteId: string, index: number): string | null {
  const preset = COLOR_PRESETS.find((row) => row.id === paletteId) ?? COLOR_PRESETS[0];
  return preset?.colors[index] ?? null;
}
