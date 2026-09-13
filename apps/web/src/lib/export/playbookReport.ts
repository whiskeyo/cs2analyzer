import type { FloorMode, Note } from "@/lib/notes/types";
import type { PlaybookFloorLayer } from "@/lib/playbook/pages";
import type {
  Playbook,
  PlaybookImage,
  PlaybookImageMime,
  PlaybookPage,
  PlaybookYouTube,
} from "@/lib/playbook/types";
import { youtubeWatchUrl } from "@/lib/playbook/youtube";
import { prettyMap } from "@/lib/weapons/weapons";
import { PLAYBOOK_PDF_FILE_FALLBACK } from "./constants";

export interface PlaybookReportClip {
  title: string;
  url: string;
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

function clipFromVideo(clip: PlaybookYouTube): PlaybookReportClip | null {
  const stored = clip.url.trim();
  if (stored !== "") return { title: clip.title.trim(), url: stored };
  if (clip.videoId.trim() === "") return null;
  return {
    title: clip.title.trim(),
    url: youtubeWatchUrl(clip.videoId, clip.startSeconds),
  };
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
  const clips: PlaybookReportClip[] = [];
  for (const clip of [...page.videos, ...page.lowerVideos]) {
    const row = clipFromVideo(clip);
    if (row) clips.push(row);
  }
  return {
    id: page.id,
    title: page.title,
    body: page.body.trim(),
    clips,
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
