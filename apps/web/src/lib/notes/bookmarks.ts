import { NOTE_BOOKMARK_TITLE } from "@/lib/shared/constants";
import type { Round } from "@/lib/replay/replayTypes";
import type { Stroke } from "@/lib/notes/types";
import { overlayWindow, withMoment } from "./visibility";

export type BookmarkStroke = Extract<Stroke, { type: "bookmark" }>;

export function isBookmarkStroke(st: Stroke): st is BookmarkStroke {
  return st.type === "bookmark";
}

export function makeBookmarkStroke(
  color: string,
  round: number,
  tick: number,
  moment: boolean,
  roundEnd: number,
  tickRate: number,
): Stroke {
  const base: Stroke = { type: "bookmark", color, round, text: NOTE_BOOKMARK_TITLE };
  if (moment) return withMoment(base, true, tick, roundEnd, tickRate);
  return { ...base, start_tick: tick, end_tick: tick };
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

function bookmarkTitle(st: BookmarkStroke): string {
  const text = st.text.trim();
  return text !== "" ? text : NOTE_BOOKMARK_TITLE;
}

/** Current-round bookmarks along the scrubber (0–1). Hidden ones are omitted. */
export function roundBookmarkMarks(
  strokes: readonly Stroke[],
  round: Round,
  range: { min: number; max: number },
): BookmarkScrubMark[] {
  const span = range.max - range.min;
  if (span <= 0) return [];
  const at = (tick: number) => (Math.min(range.max, Math.max(range.min, tick)) - range.min) / span;
  const freeze = round.freeze_end_tick || round.start_tick;
  const out: BookmarkScrubMark[] = [];
  strokes.forEach((st, index) => {
    if (!isBookmarkStroke(st) || st.round !== round.number || st.hidden) return;
    const title = bookmarkTitle(st);
    const win = overlayWindow(st, strokes);
    if (!win) {
      out.push({
        index,
        color: st.color,
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
      color: st.color,
      title,
      tick: win.start,
      startAt,
      endAt: pin ? startAt : endAt,
      kind: pin ? "pin" : "span",
    });
  });
  return out;
}
