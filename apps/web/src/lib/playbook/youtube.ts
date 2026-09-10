import { isRecord, isString } from "@/lib/validate/guards.ts";

export const YOUTUBE_VIDEO_ID_LENGTH = 11;
export const YOUTUBE_UNTITLED = "YouTube video";
export const YOUTUBE_EMBED_ORIGIN = "https://www.youtube-nocookie.com";
export const YOUTUBE_WATCH_ORIGIN = "https://www.youtube.com";
export const YOUTUBE_THUMB_ORIGIN = "https://i.ytimg.com";
export const YOUTUBE_OEMBED_URL = "https://www.youtube.com/oembed";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
  "youtu.be",
  "www.youtu.be",
]);

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

export interface ParsedYouTubeUrl {
  videoId: string;
  startSeconds?: number;
}

export function isYouTubeVideoId(value: string): boolean {
  return value.length === YOUTUBE_VIDEO_ID_LENGTH && VIDEO_ID_RE.test(value);
}

export function parseYouTubeUrl(raw: string): ParsedYouTubeUrl | null {
  const url = parseHttpUrl(raw);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const videoId = videoIdFromPath(host, url, parts);
  if (!videoId || !isYouTubeVideoId(videoId)) return null;
  const start = parseStartValue(
    url.searchParams.get("t") ?? url.searchParams.get("start") ?? timeFromHash(url.hash),
  );
  return start != null ? { videoId, startSeconds: start } : { videoId };
}

export function youtubeWatchUrl(videoId: string, startSeconds?: number): string {
  const url = new URL("/watch", YOUTUBE_WATCH_ORIGIN);
  url.searchParams.set("v", videoId);
  if (startSeconds != null && startSeconds > 0) url.searchParams.set("t", String(startSeconds));
  return url.href;
}

export function youtubeEmbedUrl(videoId: string, startSeconds?: number): string {
  const url = new URL(`/embed/${videoId}`, YOUTUBE_EMBED_ORIGIN);
  url.searchParams.set("rel", "0");
  if (startSeconds != null && startSeconds > 0) url.searchParams.set("start", String(startSeconds));
  return url.href;
}

export function youtubeThumbUrl(videoId: string): string {
  return `${YOUTUBE_THUMB_ORIGIN}/vi/${videoId}/hqdefault.jpg`;
}

export function sameYouTubeVideo(a: ParsedYouTubeUrl, b: ParsedYouTubeUrl): boolean {
  return a.videoId === b.videoId && (a.startSeconds ?? 0) === (b.startSeconds ?? 0);
}

export function formatVideoStart(seconds: number): string {
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const rest = seconds % SECONDS_PER_MINUTE;
  const mmss = `${hours > 0 ? String(minutes).padStart(2, "0") : String(minutes)}:${String(rest).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

export async function fetchYouTubeTitle(videoId: string): Promise<string | null> {
  const url = new URL(YOUTUBE_OEMBED_URL);
  url.searchParams.set("url", youtubeWatchUrl(videoId));
  url.searchParams.set("format", "json");
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!isRecord(data) || !isString(data.title)) return null;
    const title = data.title.trim();
    return title === "" ? null : title;
  } catch {
    return null;
  }
}

function videoIdFromPath(host: string, url: URL, parts: string[]): string | null {
  if (host === "youtu.be" || host === "www.youtu.be") return parts[0] ?? null;
  if (parts[0] === "watch") return url.searchParams.get("v") ?? parts[1] ?? null;
  if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live" || parts[0] === "v") {
    return parts[1] ?? null;
  }
  return url.searchParams.get("v");
}

function parseHttpUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  for (const candidate of [trimmed, `https://${trimmed}`]) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "http:" || url.protocol === "https:") return url;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

function timeFromHash(hash: string): string | null {
  if (!hash.startsWith("#")) return null;
  const body = hash.slice(1);
  if (body.startsWith("t=")) return decodeURIComponent(body.slice(2));
  return new URLSearchParams(body).get("t");
}

function parseStartValue(value: string | null): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number(trimmed);
    return seconds > 0 ? seconds : undefined;
  }
  const match = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || (match[1] == null && match[2] == null && match[3] == null)) return undefined;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const total = hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds;
  return total > 0 ? total : undefined;
}
