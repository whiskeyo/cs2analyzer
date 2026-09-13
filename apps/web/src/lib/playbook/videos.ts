import { PIECE_HIT_PX } from "./pieces";
import type { PlaybookYouTube } from "./types";

/** Canvas size of the YouTube pin (matches a nade token). */
export const YOUTUBE_PIN_WIDTH = 18;
export const YOUTUBE_PIN_HEIGHT = 13;

/** World-unit gap when stacking pins added from the sidebar. */
export const YOUTUBE_PIN_STACK = 240;

/** Pointer slop: treat as a click, not a drag. */
export const YOUTUBE_CLICK_PX = 4;

export const YOUTUBE_RED = "#ff0000";
export const YOUTUBE_PLAY = "#ffffff";

export function hitTestVideo(
  videos: readonly PlaybookYouTube[],
  screen: { x: number; y: number },
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  hitPx = PIECE_HIT_PX,
): PlaybookYouTube | null {
  const radiusSq = hitPx * hitPx;
  for (let i = videos.length - 1; i >= 0; i--) {
    const clip = videos[i]!;
    const at = toScreen(clip.x, clip.y);
    const dx = at.x - screen.x;
    const dy = at.y - screen.y;
    if (dx * dx + dy * dy <= radiusSq) return clip;
  }
  return null;
}

export function moveVideo(
  videos: readonly PlaybookYouTube[],
  id: string,
  x: number,
  y: number,
): PlaybookYouTube[] {
  return videos.map((clip) => (clip.id === id ? { ...clip, x, y } : clip));
}

export function removeVideo(videos: readonly PlaybookYouTube[], id: string): PlaybookYouTube[] {
  return videos.filter((clip) => clip.id !== id);
}

/** 1-based index when a floor has more than one clip; otherwise omit. */
export function playbookVideoPinIndex(
  videos: readonly PlaybookYouTube[],
  id: string,
): number | null {
  if (videos.length < 2) return null;
  const index = videos.findIndex((clip) => clip.id === id);
  return index >= 0 ? index + 1 : null;
}

export function nextVideoPin(
  videos: readonly PlaybookYouTube[],
  fallback: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const last = videos[videos.length - 1];
  if (!last) return fallback;
  return { x: last.x + YOUTUBE_PIN_STACK, y: last.y };
}
