import { parseNote } from "@/lib/notes/noteParse";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import type { FloorMode } from "@/lib/notes/types";
import { emptyNote } from "@/lib/notes/note";
import { isFiniteNumber, isRecord, isString } from "@/lib/validate/guards.ts";
import { defaultPlaybookColor, defaultPlaybookPaletteId } from "./pages";
import {
  PLAYBOOK_SCHEMA,
  PLAYBOOK_SCHEMA_MIN,
  PLAYBOOK_IMAGE_MIMES,
  UNTITLED_PLAYBOOK,
  UNTITLED_STRAT,
  type Playbook,
  type PlaybookImage,
  type PlaybookImageMime,
  type PlaybookPage,
  type PlaybookYouTube,
} from "./types";
import { isYouTubeVideoId, youtubeWatchUrl } from "./youtube";

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
  const lowerNote = value.lowerNote == null ? emptyNote() : parseNote(value.lowerNote);
  if (!lowerNote) return null;
  return {
    id,
    title: optionalNonEmpty(value.title) ?? UNTITLED_STRAT,
    body: isString(value.body) ? value.body : "",
    floor: parseFloor(value.floor),
    note,
    videos: parseVideos(value.videos),
    images: parseImages(value.images),
    lowerNote,
    lowerVideos: parseVideos(value.lowerVideos),
    lowerImages: parseImages(value.lowerImages),
  };
}

export function isPlaybookSchema(value: unknown): value is number {
  return (
    isFiniteNumber(value) &&
    Number.isInteger(value) &&
    value >= PLAYBOOK_SCHEMA_MIN &&
    value <= PLAYBOOK_SCHEMA
  );
}

export function parsePlaybook(value: unknown): Playbook | null {
  if (!isRecord(value)) return null;
  if (!isPlaybookSchema(value.schema)) return null;
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

function parseVideos(value: unknown): PlaybookYouTube[] {
  if (!Array.isArray(value)) return [];
  const videos: PlaybookYouTube[] = [];
  for (const row of value) {
    const clip = parsePlaybookYouTube(row);
    if (clip) videos.push(clip);
  }
  return videos;
}

function parsePlaybookYouTube(value: unknown): PlaybookYouTube | null {
  if (!isRecord(value)) return null;
  const id = optionalNonEmpty(value.id);
  const videoId = optionalNonEmpty(value.videoId);
  if (!id || !videoId || !isYouTubeVideoId(videoId)) return null;
  const startSeconds = parseStartSeconds(value.startSeconds);
  const title = optionalNonEmpty(value.title) ?? "";
  return {
    id,
    videoId,
    url: youtubeWatchUrl(videoId, startSeconds),
    title: title === "" ? videoId : title,
    x: isFiniteNumber(value.x) ? value.x : 0,
    y: isFiniteNumber(value.y) ? value.y : 0,
    ...(startSeconds != null ? { startSeconds } : {}),
  };
}

function parseStartSeconds(value: unknown): number | undefined {
  if (!isFiniteNumber(value) || !Number.isInteger(value) || value <= 0) return undefined;
  return value;
}

function parseImages(value: unknown): PlaybookImage[] {
  if (!Array.isArray(value)) return [];
  const images: PlaybookImage[] = [];
  for (const row of value) {
    const image = parsePlaybookImage(row);
    if (image) images.push(image);
  }
  return images;
}

function parseImageMime(value: unknown): PlaybookImageMime | null {
  if (!isString(value)) return null;
  const mime = value === "image/jpg" ? "image/jpeg" : value;
  return (PLAYBOOK_IMAGE_MIMES as readonly string[]).includes(mime)
    ? (mime as PlaybookImageMime)
    : null;
}

function parsePlaybookImage(value: unknown): PlaybookImage | null {
  if (!isRecord(value)) return null;
  const id = optionalNonEmpty(value.id);
  const mime = parseImageMime(value.mime);
  if (!id || !mime) return null;
  const name = optionalNonEmpty(value.name) ?? "image";
  return {
    id,
    name,
    mime,
    x: isFiniteNumber(value.x) ? value.x : 0,
    y: isFiniteNumber(value.y) ? value.y : 0,
  };
}
