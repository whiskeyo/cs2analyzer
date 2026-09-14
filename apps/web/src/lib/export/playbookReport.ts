import type { FloorMode, Note } from "@/lib/notes/types";
import type { PlaybookFloorLayer } from "@/lib/playbook/pages";
import type {
  Playbook,
  PlaybookImage,
  PlaybookImageMime,
  PlaybookPage,
  PlaybookYouTube,
} from "@/lib/playbook/types";
import { playbookVideoWatchUrl } from "@/lib/playbook/videos";
import { YOUTUBE_UNTITLED } from "@/lib/playbook/youtube";
import { prettyMap } from "@/lib/weapons/weapons";
import { PLAYBOOK_PDF_FILE_FALLBACK } from "./constants";

export interface PlaybookReportClip {
  title: string;
  url: string;
  x: number;
  y: number;
  floor: PlaybookFloorLayer;
  /** 1-based index in that floor's video list (matches the pin badge). */
  index: number;
}

export interface PlaybookReportPhoto {
  id: string;
  name: string;
  mime: PlaybookImageMime;
  x: number;
  y: number;
  floor: PlaybookFloorLayer;
}

export interface PlaybookReportPage {
  id: string;
  title: string;
  body: string;
  clips: PlaybookReportClip[];
  photos: PlaybookReportPhoto[];
  floor: FloorMode;
  note: Note;
}

export interface PlaybookReport {
  title: string;
  mapName: string;
  mapLabel: string;
  /** Human map + playbook, e.g. `Nuke: default executes`. */
  heading: string;
  exportedAt: number;
  exportedOn: string;
  fileStem: string;
  pages: PlaybookReportPage[];
}

export function playbookPdfHeading(mapLabel: string, playbookName: string): string {
  return `${mapLabel}: ${playbookName}`;
}

/** UTC calendar day so PDF fixtures do not depend on the runner timezone. */
export function formatPlaybookExportDate(exportedAt: number): string {
  return new Date(exportedAt).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function playbookPdfStem(title: string, mapLabel: string): string {
  const slug = `${mapLabel} ${title}`
    .normalize("NFKD")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return slug || PLAYBOOK_PDF_FILE_FALLBACK;
}

export function playbookPdfFilename(report: Pick<PlaybookReport, "fileStem">): string {
  return `${report.fileStem}.pdf`;
}

function clipFromVideo(
  clip: PlaybookYouTube,
  floor: PlaybookFloorLayer,
  index: number,
): PlaybookReportClip | null {
  const url = playbookVideoWatchUrl(clip);
  if (!url) return null;
  return {
    title: clip.title.trim(),
    url,
    x: clip.x,
    y: clip.y,
    floor,
    index,
  };
}

/** Current floor first, then the other floor — same order as photos. */
export function playbookPageClips(page: PlaybookPage): PlaybookReportClip[] {
  const upper = clipsFromVideos(page.videos, "upper");
  const lower = clipsFromVideos(page.lowerVideos, "lower");
  return page.floor === "lower" ? [...lower, ...upper] : [...upper, ...lower];
}

function clipsFromVideos(
  videos: readonly PlaybookYouTube[],
  floor: PlaybookFloorLayer,
): PlaybookReportClip[] {
  const clips: PlaybookReportClip[] = [];
  videos.forEach((clip, i) => {
    const row = clipFromVideo(clip, floor, i + 1);
    if (row) clips.push(row);
  });
  return clips;
}

/** Always `N - title`, even when the pin badge is omitted. */
export function playbookReportClipLine(clip: PlaybookReportClip): string {
  const title = clip.title === "" ? YOUTUBE_UNTITLED : clip.title;
  return `${clip.index} - ${title}`;
}

function photoFromImage(image: PlaybookImage, floor: PlaybookFloorLayer): PlaybookReportPhoto {
  return {
    id: image.id,
    name: image.name,
    mime: image.mime,
    x: image.x,
    y: image.y,
    floor,
  };
}

/** Current floor first, then the other floor — same order a coach sees on the board. */
export function playbookPagePhotos(page: PlaybookPage): PlaybookReportPhoto[] {
  const upper = page.images.map((image) => photoFromImage(image, "upper"));
  const lower = page.lowerImages.map((image) => photoFromImage(image, "lower"));
  return page.floor === "lower" ? [...lower, ...upper] : [...upper, ...lower];
}

export function playbookReportPage(page: PlaybookPage): PlaybookReportPage {
  return {
    id: page.id,
    title: page.title,
    body: page.body.trim(),
    clips: playbookPageClips(page),
    photos: playbookPagePhotos(page),
    floor: page.floor,
    note: page.note,
  };
}

/** Cover + one section per strat. Input is the in-memory book; nothing is uploaded. */
export function playbookReport(book: Playbook, exportedAt = Date.now()): PlaybookReport {
  const mapLabel = prettyMap(book.mapName);
  return {
    title: book.title,
    mapName: book.mapName,
    mapLabel,
    heading: playbookPdfHeading(mapLabel, book.title),
    exportedAt,
    exportedOn: formatPlaybookExportDate(exportedAt),
    fileStem: playbookPdfStem(book.title, mapLabel),
    pages: book.pages.map(playbookReportPage),
  };
}
