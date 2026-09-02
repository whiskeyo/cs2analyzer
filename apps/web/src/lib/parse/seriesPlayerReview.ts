import {
  playerReview,
  type PlayerReview,
  type ReviewHeadline,
  type ReviewKind,
  type ReviewNote,
  type ReviewSeverity,
} from "@/lib/match/review";
import type { DemoSeries } from "@/lib/parse/session";
import { playerIndexForKey } from "@/lib/parse/seriesRoster";
import type { Replay } from "@/lib/replay/replayTypes";

export interface SeriesReviewDemoSlice {
  demoId: string;
  fileName: string;
  count: number;
  rounds: string[];
}

export interface SeriesReviewHeadline {
  severity: ReviewSeverity;
  kind: ReviewKind;
  text: string;
  totalCount: number;
  byDemo: SeriesReviewDemoSlice[];
}

export interface SeriesReviewNote extends ReviewNote {
  demoId: string;
  fileName: string;
  jumpTick: number;
}

export interface SeriesPlayerReviewResult {
  playerName: string;
  demoCount: number;
  headlines: SeriesReviewHeadline[];
  notesByDemo: { demoId: string; fileName: string; notes: SeriesReviewNote[] }[];
}

function matchEndTick(replay: Replay): number {
  let end = 0;
  for (const round of replay.rounds) {
    if (round.is_knife) continue;
    end = Math.max(end, round.end_tick);
  }
  return end;
}

function headlineMergeKey(headline: ReviewHeadline): string {
  return `${headline.severity}|${headline.text.replace(/\d+/g, "#")}`;
}

function teamLostSubcount(text: string): number {
  const match = text.match(/\((\d+) in rounds the team lost\)/);
  return match ? Number(match[1]) : 0;
}

function formatHeadlineTotal(template: string, total: number, teamLostSub: number): string {
  const base = template.replace(/\s*\(\d+ in rounds the team lost\)/, "");
  const out = base.replace(/\d+/, String(total));
  if (teamLostSub > 0) {
    return `${out} (${teamLostSub} in rounds the team lost)`;
  }
  return out;
}

function noteMatchesHeadline(note: ReviewNote, mergeKey: string): boolean {
  const key = mergeKey.toLowerCase();
  const hay = `${note.title} ${note.detail}`.toLowerCase();
  if (key.includes("opening duel") && key.includes("lost")) {
    return hay.includes("opening death") || note.title.toLowerCase().includes("opening");
  }
  if (key.includes("won") && key.includes("opening")) {
    return note.title.startsWith("Won the opening");
  }
  if (key.includes("traded") && key.includes("opener")) {
    return note.title.startsWith("Traded the opener");
  }
  if (key.includes("clutch") && key.includes("lost")) {
    return note.title.includes("1v") || hay.includes("lost 1v");
  }
  if (key.includes("clutch") && key.includes("won")) {
    return note.title.startsWith("Won a 1v");
  }
  if (key.includes("untraded")) return note.detail.includes("untraded");
  if (key.includes("flashed")) return note.detail.includes("flashed");
  if (key.includes("damage back") || key.includes("gunfight")) {
    return note.detail.includes("damage back");
  }
  if (key.includes("multi-kill") || key.includes("fed")) {
    return note.detail.includes("fed a");
  }
  if (key.includes("utility")) return note.detail.includes("died to");
  if (key.includes("nades")) return note.detail.includes("died holding");
  if (key.includes("eco round")) return note.title.includes("eco");
  if (key.includes("4k")) {
    return note.title.includes("k this round") || note.title === "Ace";
  }
  return false;
}

function roundsForHeadline(notes: SeriesReviewNote[], mergeKey: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const note of notes) {
    if (!noteMatchesHeadline(note, mergeKey)) continue;
    if (seen.has(note.roundLabel)) continue;
    seen.add(note.roundLabel);
    out.push(note.roundLabel);
  }
  return out;
}

function mergeHeadlines(
  slices: { demoId: string; fileName: string; review: PlayerReview; notes: SeriesReviewNote[] }[],
): SeriesReviewHeadline[] {
  const merged = new Map<
    string,
    {
      severity: ReviewSeverity;
      kind: ReviewKind;
      template: string;
      total: number;
      teamLostSub: number;
      byDemo: SeriesReviewDemoSlice[];
    }
  >();

  for (const slice of slices) {
    for (const headline of slice.review.headlines) {
      const key = headlineMergeKey(headline);
      const prev = merged.get(key);
      const rounds = roundsForHeadline(slice.notes, key);
      const demoSlice: SeriesReviewDemoSlice = {
        demoId: slice.demoId,
        fileName: slice.fileName,
        count: headline.count,
        rounds,
      };
      if (prev) {
        prev.total += headline.count;
        prev.teamLostSub += teamLostSubcount(headline.text);
        prev.byDemo.push(demoSlice);
      } else {
        merged.set(key, {
          severity: headline.severity,
          kind: headline.kind,
          template: headline.text,
          total: headline.count,
          teamLostSub: teamLostSubcount(headline.text),
          byDemo: [demoSlice],
        });
      }
    }
  }

  const rank = { good: 0, high: 1, mid: 2, low: 3 };
  return [...merged.entries()]
    .map(([, { severity, kind, template, total, teamLostSub, byDemo }]) => ({
      severity,
      kind,
      text: formatHeadlineTotal(template, total, teamLostSub),
      totalCount: total,
      byDemo: byDemo.sort((a, b) => a.fileName.localeCompare(b.fileName)),
    }))
    .sort(
      (a, b) =>
        rank[a.severity] - rank[b.severity] ||
        b.totalCount - a.totalCount ||
        a.text.localeCompare(b.text),
    );
}

/** Full-match player review merged across every demo the player appears in. */
export function seriesPlayerReview(
  series: DemoSeries,
  playerKey: string,
  playerName: string,
): SeriesPlayerReviewResult {
  const slices: {
    demoId: string;
    fileName: string;
    review: PlayerReview;
    notes: SeriesReviewNote[];
  }[] = [];

  for (const demo of series.demos) {
    const player = playerIndexForKey(demo.replay, playerKey);
    if (player == null) continue;
    const until = matchEndTick(demo.replay);
    const review = playerReview(demo.replay, player, until);
    const notes = review.notes.map((note) => ({
      ...note,
      demoId: demo.id,
      fileName: demo.fileName,
      jumpTick: note.tick,
    }));
    slices.push({ demoId: demo.id, fileName: demo.fileName, review, notes });
  }

  const notesByDemo = slices
    .map(({ demoId, fileName, notes }) => ({
      demoId,
      fileName,
      notes: notes.sort((a, b) => a.tick - b.tick),
    }))
    .sort((a, b) => a.fileName.localeCompare(b.fileName));

  return {
    playerName,
    demoCount: slices.length,
    headlines: mergeHeadlines(slices),
    notesByDemo,
  };
}
