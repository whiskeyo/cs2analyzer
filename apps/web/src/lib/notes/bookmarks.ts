import { NOTE_BOOKMARK_TITLE, NOTE_MOMENT_SECONDS } from "@/lib/shared/constants";
import type { Round } from "@/lib/replay/replayTypes";
import { cloneNote, overlayWindowOf } from "./note";
import type { Bookmark, Note } from "./types";
import { withMoment } from "./visibility";

export function bookmarkTitle(mark: Bookmark): string {
  const text = mark.text.trim();
  return text !== "" ? text : NOTE_BOOKMARK_TITLE;
}

export function makeBookmark(
  color: string,
  tick: number,
  moment: boolean,
  roundEnd: number,
  tickRate: number,
  momentSec = NOTE_MOMENT_SECONDS,
): Bookmark {
  const base: Bookmark = { color, text: NOTE_BOOKMARK_TITLE, tick };
  if (moment) return withMoment(base, true, tick, roundEnd, tickRate, momentSec);
  return { ...base, start_tick: tick, end_tick: tick };
}

export function addBookmark(note: Note, mark: Bookmark): Note {
  const next = cloneNote(note);
  next.bookmarks.push(mark);
  return next;
}

export interface BookmarkScrubMark {
  index: number;
  color: string;
  title: string;
  /** Jump here when the mark is clicked. */
  tick: number;
  startAt: number;
  endAt: number;
  kind: "pin" | "span" | "round";
}

/** Current-round bookmarks along the scrubber (0–1). Hidden ones are omitted. */
export function roundBookmarkMarks(
  note: Note,
  round: Round,
  range: { min: number; max: number },
): BookmarkScrubMark[] {
  const span = range.max - range.min;
  if (span <= 0) return [];
  const at = (tick: number) => (Math.min(range.max, Math.max(range.min, tick)) - range.min) / span;
  const freeze = round.freeze_end_tick || round.start_tick;
  const out: BookmarkScrubMark[] = [];
  note.bookmarks.forEach((mark, index) => {
    if (mark.hidden) return;
    const title = bookmarkTitle(mark);
    const win = overlayWindowOf(mark);
    if (!win) {
      out.push({
        index,
        color: mark.color,
        title,
        tick: freeze,
        startAt: 0,
        endAt: 1,
        kind: "round",
      });
      return;
    }
    const startAt = at(win.start);
    const endAt = at(win.end);
    const pin = win.end <= win.start;
    out.push({
      index,
      color: mark.color,
      title,
      tick: win.start,
      startAt,
      endAt: pin ? startAt : endAt,
      kind: pin ? "pin" : "span",
    });
  });
  return out;
}
