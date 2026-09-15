import { bookmarkTitle } from "@/lib/notes/bookmarks";
import { overlayWindowOf } from "@/lib/notes/note";
import { notesByRound } from "@/lib/notes/list";
import type { Bookmark, Drawing, Note, RoundNote } from "@/lib/notes/types";
import { roundLabel } from "@/lib/match/reviewItems/support";
import { roundClock } from "@/lib/match/roundEvents";
import { isPistolRoundNumber } from "@/lib/parse/roundTags";
import { playerLabel } from "@/lib/replay/playerLabel";
import {
  FLAG_CT,
  FLAG_PRESENT,
  type Replay,
  type Round,
  type Side,
} from "@/lib/replay/replayTypes";
import { currentRound, samplePlayers } from "@/lib/replay/sample";
import {
  COMPETITIVE_PLAYERS_PER_SIDE,
  ECO_MAX_EQUIPMENT,
  FORCE_BUY_MAX_EQUIPMENT,
  tickRate,
} from "@/lib/shared/constants";
import {
  computeStats,
  currentSide,
  formatAdr,
  formatKast,
  formatScorecard,
  liveScoreboardPlayers,
  liveTeams,
  matchEndTick,
  matchScorecard,
} from "@/lib/stats/stats";
import { prettyMap } from "@/lib/weapons/weapons";
import {
  MATCH_PDF_ECO_ECO,
  MATCH_PDF_ECO_FORCE,
  MATCH_PDF_ECO_FULL,
  MATCH_PDF_ECO_KNIFE,
  MATCH_PDF_ECO_PISTOL,
  MATCH_PDF_ENTRY_EMPTY,
  MATCH_PDF_FILE_FALLBACK,
} from "./constants";
import { formatPlaybookExportDate } from "./playbookReport";

export type MatchPdfNoteKind = "text" | "bookmark";

export interface MatchReportPlayer {
  name: string;
  side: Side;
  kills: number;
  deaths: number;
  assists: number;
  adr: string;
  kast: string;
  rating: string;
  entry: string;
}

export interface MatchReportNoteItem {
  title: string;
  kind: MatchPdfNoteKind;
}

export interface MatchReportRoundNotes {
  roundLabel: string;
  items: MatchReportNoteItem[];
}

export interface MatchReportBookmark {
  id: string;
  title: string;
  roundLabel: string;
  clock: string;
  economy: string;
  scoreLine: string;
  caption: string;
  tick: number;
  round: number;
}

export interface MatchReport {
  heading: string;
  mapLabel: string;
  fileName: string;
  scoreLine: string;
  exportedAt: number;
  exportedOn: string;
  fileStem: string;
  ctName: string;
  tName: string;
  ctScore: number;
  tScore: number;
  players: { ct: MatchReportPlayer[]; t: MatchReportPlayer[] };
  notes: MatchReportRoundNotes[];
  bookmarks: MatchReportBookmark[];
}

export function matchPdfStem(parts: readonly string[]): string {
  const slug = parts
    .join(" ")
    .normalize("NFKD")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return slug || MATCH_PDF_FILE_FALLBACK;
}

export function matchPdfFilename(report: Pick<MatchReport, "fileStem">): string {
  return `${report.fileStem}.pdf`;
}

export function matchDemoStem(fileName: string): string {
  const stem = fileName.replace(/\.dem$/i, "").trim();
  return stem || MATCH_PDF_FILE_FALLBACK;
}

export function matchPdfHeading(mapLabel: string, teamA: string, teamB: string): string {
  return `${mapLabel}: ${teamA} - ${teamB}`;
}

function entryCell(attempts: number, firstKills: number): string {
  return attempts > 0 ? `${firstKills}/${attempts}` : MATCH_PDF_ENTRY_EMPTY;
}

function teamBuyKind(replay: Replay, tick: number, ct: boolean): string {
  const players = samplePlayers(replay, tick).filter((p) => p.present && p.ct === ct);
  if (players.length === 0) return MATCH_PDF_ECO_ECO;
  const avg = players.reduce((sum, p) => sum + p.equip, 0) / players.length;
  if (avg < ECO_MAX_EQUIPMENT) return MATCH_PDF_ECO_ECO;
  if (avg < FORCE_BUY_MAX_EQUIPMENT) return MATCH_PDF_ECO_FORCE;
  return MATCH_PDF_ECO_FULL;
}

/** Economy tag for a bookmark caption. T-side buy, unless the round is a pistol or knife. */
export function matchRoundEconomy(replay: Replay, round: Round): string {
  if (round.is_knife) return MATCH_PDF_ECO_KNIFE;
  if (isPistolRoundNumber(round.number)) return MATCH_PDF_ECO_PISTOL;
  const freeze = round.freeze_end_tick || round.start_tick;
  return teamBuyKind(replay, freeze, false);
}

export function bookmarkStillTick(mark: Bookmark, round: Round): number {
  const win = overlayWindowOf(mark);
  if (win) return win.start;
  if (Number.isFinite(mark.tick)) return mark.tick;
  return round.freeze_end_tick || round.start_tick;
}

function roundForNote(replay: Replay, number: number): Round | undefined {
  return replay.rounds.find((row) => row.number === number);
}

function visibleTextTitles(note: Note): string[] {
  const titles: string[] = [];
  for (const group of note.groups) {
    if (group.hidden) continue;
    for (const drawing of group.drawings) {
      const title = textTitle(drawing);
      if (title) titles.push(title);
    }
  }
  for (const drawing of note.drawings) {
    const title = textTitle(drawing);
    if (title) titles.push(title);
  }
  return titles;
}

function textTitle(drawing: Drawing): string | null {
  if (drawing.hidden || drawing.type !== "text") return null;
  const title = drawing.text.trim();
  return title === "" ? null : title;
}

function noteItems(note: Note): MatchReportNoteItem[] {
  const items: MatchReportNoteItem[] = visibleTextTitles(note).map((title) => ({
    title,
    kind: "text",
  }));
  note.bookmarks.forEach((mark) => {
    if (mark.hidden) return;
    items.push({ title: bookmarkTitle(mark), kind: "bookmark" });
  });
  return items;
}

function presentSidesAtFrame(replay: Replay, frame: number): { ct: number; t: number } {
  const buf = replay.ticks;
  let ct = 0;
  let t = 0;
  const base = frame * buf.playerCount;
  for (let p = 0; p < buf.playerCount; p++) {
    const flag = buf.flags[base + p] ?? 0;
    if ((flag & FLAG_PRESENT) === 0) continue;
    if ((flag & FLAG_CT) !== 0) ct += 1;
    else t += 1;
  }
  return { ct, t };
}

/**
 * Last sampled frame where both sides still have a full competitive roster.
 * Counts `FLAG_PRESENT` only (dead pawns stay on the sheet). Falls back to
 * `matchEndTick` when the demo never has 5 CT + 5 T present at once.
 */
export function matchRosterTick(replay: Replay): number {
  const end = matchEndTick(replay);
  const buf = replay.ticks;
  for (let frame = buf.frameCount - 1; frame >= 0; frame--) {
    const tick = buf.ticks[frame] ?? 0;
    if (tick > end) continue;
    const sides = presentSidesAtFrame(replay, frame);
    if (sides.ct >= COMPETITIVE_PLAYERS_PER_SIDE && sides.t >= COMPETITIVE_PLAYERS_PER_SIDE) {
      return tick;
    }
  }
  return end;
}

function scoreboardPlayers(replay: Replay, tick: number): MatchReport["players"] {
  const stats = computeStats(replay, tick);
  const live = new Set(liveScoreboardPlayers(replay, tick));
  const rows = stats
    .filter((s) => live.has(s.player))
    .map((s) => ({
      s,
      side: currentSide(replay, s.player, tick),
    }));
  const toRow = (s: (typeof rows)[number]["s"], side: Side): MatchReportPlayer => ({
    name: playerLabel(replay.players[s.player]),
    side,
    kills: s.kills,
    deaths: s.deaths,
    assists: s.assists,
    adr: formatAdr(s.adr),
    kast: formatKast(s.kast),
    rating: s.rating.toFixed(2),
    entry: entryCell(s.entry_attempts, s.first_kills),
  });
  const ct = rows
    .filter((row) => row.side === "CT")
    .sort((a, b) => b.s.rating - a.s.rating)
    .map((row) => toRow(row.s, "CT"));
  const t = rows
    .filter((row) => row.side === "T")
    .sort((a, b) => b.s.rating - a.s.rating)
    .map((row) => toRow(row.s, "T"));
  return { ct, t };
}

function bookmarkCaption(parts: readonly string[]): string {
  return parts.filter((part) => part !== "").join(" · ");
}

function collectBookmarks(
  replay: Replay,
  notes: readonly RoundNote[],
  rate: number,
): MatchReportBookmark[] {
  const out: MatchReportBookmark[] = [];
  for (const row of notesByRound(notes)) {
    const round = roundForNote(replay, row.round);
    if (!round) continue;
    row.note.bookmarks.forEach((mark, index) => {
      if (mark.hidden) return;
      const tick = bookmarkStillTick(mark, round);
      const teams = liveTeams(replay, tick);
      const scoreLine = `${teams.ctName} ${teams.ct}-${teams.t} ${teams.tName}`;
      const label = roundLabel(round);
      const clock = roundClock(round, tick, rate);
      const economy = matchRoundEconomy(replay, round);
      const title = bookmarkTitle(mark);
      out.push({
        id: `${row.round}:${index}`,
        title,
        roundLabel: label,
        clock,
        economy,
        scoreLine,
        caption: bookmarkCaption([`${label} ${clock}`, economy, scoreLine]),
        tick,
        round: row.round,
      });
    });
  }
  return out;
}

function collectNotes(replay: Replay, notes: readonly RoundNote[]): MatchReportRoundNotes[] {
  const out: MatchReportRoundNotes[] = [];
  for (const row of notesByRound(notes)) {
    const items = noteItems(row.note);
    if (items.length === 0) continue;
    const round = roundForNote(replay, row.round);
    out.push({
      roundLabel: round ? roundLabel(round) : `R${row.round}`,
      items,
    });
  }
  return out;
}

/** Scorecard + notes + bookmark captions for the loaded Analyzer match. */
export function matchReport(
  replay: Replay,
  notes: readonly RoundNote[],
  fileName: string,
  exportedAt = Date.now(),
): MatchReport {
  const tick = matchRosterTick(replay);
  const card = matchScorecard(replay, tick);
  const teams = liveTeams(replay, tick);
  const mapLabel = prettyMap(replay.header.map_name);
  const demoStem = matchDemoStem(fileName);
  const atRound = currentRound(replay, tick);
  return {
    heading: matchPdfHeading(mapLabel, card.teamA, card.teamB),
    mapLabel,
    fileName: fileName.trim() || demoStem,
    scoreLine: formatScorecard(card),
    exportedAt,
    exportedOn: formatPlaybookExportDate(exportedAt),
    fileStem: matchPdfStem([mapLabel, card.teamA, card.teamB, demoStem]),
    ctName: atRound?.team_ct || teams.ctName,
    tName: atRound?.team_t || teams.tName,
    ctScore: teams.ct,
    tScore: teams.t,
    players: scoreboardPlayers(replay, tick),
    notes: collectNotes(replay, notes),
    bookmarks: collectBookmarks(replay, notes, tickRate(replay)),
  };
}
