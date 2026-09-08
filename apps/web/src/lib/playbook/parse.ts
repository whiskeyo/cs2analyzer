import { parseNote } from "@/lib/notes/noteParse";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import type { FloorMode } from "@/lib/notes/types";
import { emptyNote } from "@/lib/notes/note";
import { isFiniteNumber, isRecord, isString } from "@/lib/validate/guards.ts";
import { defaultPlaybookColor, defaultPlaybookPaletteId } from "./pages";
import {
  PLAYBOOK_SCHEMA,
  UNTITLED_PLAYBOOK,
  UNTITLED_STRAT,
  type Playbook,
  type PlaybookPage,
} from "./types";

function optionalNonEmpty(value: unknown): string | undefined {
  return isString(value) && value.trim() !== "" ? value.trim() : undefined;
}

function parseFloor(value: unknown): FloorMode {
  if (value === "upper" || value === "lower" || value === "auto") return value;
  return "auto";
}

function parsePaletteId(value: unknown): string {
  if (isString(value) && COLOR_PRESETS.some((preset) => preset.id === value)) return value;
  return defaultPlaybookPaletteId();
}

function parseColor(value: unknown): string {
  return optionalNonEmpty(value) ?? defaultPlaybookColor();
}

export function parsePlaybookPage(value: unknown): PlaybookPage | null {
  if (!isRecord(value)) return null;
  const id = optionalNonEmpty(value.id);
  if (!id) return null;
  const note = value.note == null ? emptyNote() : parseNote(value.note);
  if (!note) return null;
  return {
    id,
    title: optionalNonEmpty(value.title) ?? UNTITLED_STRAT,
    body: isString(value.body) ? value.body : "",
    floor: parseFloor(value.floor),
    note,
  };
}

export function parsePlaybook(value: unknown): Playbook | null {
  if (!isRecord(value)) return null;
  if (value.schema !== PLAYBOOK_SCHEMA) return null;
  const key = optionalNonEmpty(value.key);
  const mapName = optionalNonEmpty(value.mapName);
  if (!key || !mapName) return null;
  if (!Array.isArray(value.pages)) return null;
  const pages: PlaybookPage[] = [];
  for (const row of value.pages) {
    const page = parsePlaybookPage(row);
    if (page) pages.push(page);
  }
  if (pages.length === 0) return null;
  const first = pages[0];
  if (!first) return null;
  const active = optionalNonEmpty(value.activePageId);
  const activePageId = active && pages.some((p) => p.id === active) ? active : first.id;
  return {
    schema: PLAYBOOK_SCHEMA,
    key,
    mapName,
    title: optionalNonEmpty(value.title) ?? UNTITLED_PLAYBOOK,
    savedAt: isFiniteNumber(value.savedAt) ? value.savedAt : 0,
    sort: isFiniteNumber(value.sort)
      ? value.sort
      : isFiniteNumber(value.savedAt)
        ? value.savedAt
        : 0,
    pages,
    activePageId,
    paletteId: parsePaletteId(value.paletteId),
    color: parseColor(value.color),
  };
}
