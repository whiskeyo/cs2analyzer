import { roundLabel } from "@/lib/match/reviewItems/support";
import { roundClock } from "@/lib/match/roundEvents";
import { emptyNote } from "@/lib/notes/note";
import {
  DEFAULT_LAYERS,
  DEFAULT_SUMMARY_FILTER,
  type DrawingGroup,
  type FloorMode,
  type MapLayers,
  type Note,
  type NoteRadarFx,
  type Piece,
  type SummaryFilter,
} from "@/lib/notes/types";
import type { RoundKind } from "@/lib/parse/roundTags";
import {
  DEFAULT_HABITS_NADE_FILTER,
  habitsNadeVisible,
  habitsNadeViewTick,
  overlayAtPlaySec,
  type HabitsNadeFilter,
  type HabitsTrail,
  type SeriesOverlay,
} from "@/lib/parse/seriesOverlay";
import { tickRate } from "@/lib/shared/constants";
import {
  buildRadarFrame,
  nadeRenderAt,
  T_COLOR,
  type NadeRender,
  type RadarFrame,
} from "@/lib/radar/radarFrame";
import type { MapCalibration, Replay, Side } from "@/lib/replay/replayTypes";
import { currentRound } from "@/lib/replay/sample";
import { matchScorecard } from "@/lib/stats/scorecard";
import { formatClock } from "@/lib/weapons/weapons";
import { tintForName } from "@/lib/notes/palettes";
import { addPage, playbookFloorLayer, renamePage, setPageFloor, setPageLayerNote } from "./pages";
import { createPlaybook, loadPlaybook, savePlaybook } from "./playbookStore";
import { makePiece } from "./pieces";
import { UNTITLED_PLAYBOOK, UNTITLED_STRAT, type Playbook, type PlaybookPage } from "./types";

/** Used when the loaded demo has no filename. */
export const SNAPSHOT_FALLBACK_FILE = "demo.dem";

/** Round label when the tick is not in a round. */
export const SNAPSHOT_UNKNOWN_ROUND = "R?";

function noteIsEmpty(note: Note): boolean {
  return (
    note.groups.length === 0 &&
    note.drawings.length === 0 &&
    note.pieces.length === 0 &&
    note.bookmarks.length === 0 &&
    note.radarFx == null
  );
}

function isBlankStrat(page: PlaybookPage): boolean {
  return (
    page.title === UNTITLED_STRAT &&
    noteIsEmpty(page.note) &&
    noteIsEmpty(page.lowerNote) &&
    page.body.trim() === "" &&
    page.videos.length === 0 &&
    page.lowerVideos.length === 0
  );
}

export function nadePiecePos(nade: NadeRender): { x: number; y: number } | null {
  if (nade.phase === "flight") {
    if (nade.head) return nade.head;
    return nade.trail[nade.trail.length - 1] ?? null;
  }
  if (nade.phase === "fires") return nade.centroid;
  return nade.at;
}

function nadeTrailPoints(
  nade: NadeRender,
  land: { x: number; y: number },
): { x: number; y: number }[] {
  const trail = nade.trail;
  if (trail.length === 0) return [];
  const last = trail[trail.length - 1];
  if (last && last.x === land.x && last.y === land.y) return trail.slice(0, -1);
  return trail;
}

export function nadeToPiece(nade: NadeRender): Piece | null {
  const at = nadePiecePos(nade);
  if (!at) return null;
  const trail = nadeTrailPoints(nade, at);
  return makePiece(nade.kind, at.x, at.y, {
    nadeStyle: nade.phase === "flight" ? "icon" : "effect",
    ...(trail.length > 0 ? { trail } : {}),
  });
}

export function radarFxIsEmpty(fx: NoteRadarFx): boolean {
  return (
    fx.deaths.length === 0 &&
    fx.opening == null &&
    fx.tracers.length === 0 &&
    fx.trails.length === 0 &&
    fx.heatmap.length === 0 &&
    fx.summary.length === 0 &&
    fx.cone == null &&
    fx.hits.length === 0 &&
    fx.flashes.length === 0
  );
}

export function frameToRadarFx(frame: RadarFrame): NoteRadarFx | undefined {
  const fx: NoteRadarFx = {
    deaths: frame.deaths.map((death) => ({
      x: death.x,
      y: death.y,
      line: death.line
        ? {
            from: { x: death.line.from.x, y: death.line.from.y },
            to: { x: death.line.to.x, y: death.line.to.y },
            color: death.line.color,
            alpha: death.line.alpha,
            lineWidth: death.line.lineWidth,
          }
        : null,
    })),
    opening: frame.opening
      ? {
          from: { x: frame.opening.from.x, y: frame.opening.from.y },
          to: { x: frame.opening.to.x, y: frame.opening.to.y },
          color: frame.opening.color,
        }
      : null,
    tracers: frame.tracers.map((row) => ({ ...row })),
    trails: frame.trails.map((row) => ({
      points: row.points.map((pt) => ({ x: pt.x, y: pt.y })),
      color: row.color,
    })),
    heatmap: frame.heatmap.map((row) => ({ ...row })),
    summary: frame.summary.map((row) => ({ ...row })),
    cone: frame.cone ? { ...frame.cone } : null,
    hits: frame.hits.map((row) => ({ ...row })),
    flashes: frame.flashes.map((row) => ({ ...row })),
  };
  return radarFxIsEmpty(fx) ? undefined : fx;
}

export function frameToPieces(frame: RadarFrame): Piece[] {
  const pieces: Piece[] = [];
  for (const pawn of frame.pawns) {
    const sampled = frame.players.find((row) => row.index === pawn.index);
    const name = pawn.name.trim();
    pieces.push(
      makePiece("pawn", pawn.x, pawn.y, {
        ...(sampled != null ? { z: sampled.z } : {}),
        yaw: pawn.yaw,
        side: pawn.color === T_COLOR ? "T" : "CT",
        ...(name ? { label: name } : {}),
        alive: pawn.alive,
        ...(pawn.carriesC4 ? { carriesC4: true } : {}),
      }),
    );
  }
  for (const nade of frame.nades) {
    const piece = nadeToPiece(nade);
    if (piece) pieces.push(piece);
  }
  if (frame.bomb.state === "planted" || frame.bomb.state === "loose") {
    pieces.push(makePiece("bomb", frame.bomb.x, frame.bomb.y));
  }
  return pieces;
}

export function snapshotFrame(
  replay: Replay,
  tick: number,
  cal: MapCalibration | undefined,
  opts?: {
    layers?: MapLayers;
    summaryFilter?: SummaryFilter;
    selected?: number | null;
    trails?: boolean;
    floorMode?: FloorMode;
  },
): { pieces: Piece[]; radarFx?: NoteRadarFx } {
  const frame = buildRadarFrame({
    replay,
    tick,
    layers: opts?.layers ?? {
      ...DEFAULT_LAYERS,
      heatmap: false,
      summary: false,
    },
    summaryFilter: opts?.summaryFilter ?? DEFAULT_SUMMARY_FILTER,
    selected: opts?.selected ?? null,
    trails: opts?.trails ?? false,
    floorMode: opts?.floorMode ?? "auto",
    cal,
    scale: 1,
  });
  return { pieces: frameToPieces(frame), radarFx: frameToRadarFx(frame) };
}

export function snapshotPieces(
  replay: Replay,
  tick: number,
  cal: MapCalibration | undefined,
): Piece[] {
  return snapshotFrame(replay, tick, cal).pieces;
}

export function snapshotStratTitle(opts: {
  teamA: string;
  teamB: string;
  fileName: string;
  roundLabel: string;
  clock: string;
}): string {
  return `${opts.teamA} - ${opts.teamB} (${opts.fileName}) · ${opts.roundLabel} ${opts.clock}`;
}

export function snapshotTitleFromReplay(replay: Replay, tick: number, fileName: string): string {
  const card = matchScorecard(replay, tick);
  const round = currentRound(replay, tick);
  const label = round ? roundLabel(round) : SNAPSHOT_UNKNOWN_ROUND;
  const clock = round ? roundClock(round, tick, tickRate(replay)) : formatClock(0);
  const name = fileName.trim() === "" ? SNAPSHOT_FALLBACK_FILE : fileName;
  return snapshotStratTitle({
    teamA: card.teamA,
    teamB: card.teamB,
    fileName: name,
    roundLabel: label,
    clock,
  });
}

export function addSnapshotPage(
  book: Playbook,
  title: string,
  pieces: Piece[],
  floor: FloorMode = "auto",
  radarFx?: NoteRadarFx,
  groups: DrawingGroup[] = [],
): Playbook {
  const note = {
    ...emptyNote(),
    pieces,
    groups,
    ...(radarFx ? { radarFx } : {}),
  };
  const layer = playbookFloorLayer(floor === "lower");
  const first = book.pages[0];
  if (book.pages.length === 1 && first && isBlankStrat(first)) {
    return setPageLayerNote(
      setPageFloor(renamePage(book, first.id, title), first.id, floor),
      first.id,
      layer,
      note,
    );
  }
  const withPage = addPage(book, title, floor);
  return setPageLayerNote(withPage, withPage.activePageId, layer, note);
}

export async function writeSnapshot(opts: {
  mapName: string;
  bookKey: string | null;
  newBookTitle?: string;
  stratTitle: string;
  pieces: Piece[];
  floor?: FloorMode;
  radarFx?: NoteRadarFx;
  groups?: DrawingGroup[];
}): Promise<{ book: Playbook; pageId: string }> {
  const loaded = opts.bookKey ? await loadPlaybook(opts.bookKey) : null;
  const book =
    loaded ?? (await createPlaybook(opts.mapName, opts.newBookTitle ?? UNTITLED_PLAYBOOK));
  const next = addSnapshotPage(
    book,
    opts.stratTitle,
    opts.pieces,
    opts.floor ?? "auto",
    opts.radarFx,
    opts.groups,
  );
  const saved = await savePlaybook(next);
  return { book: saved, pageId: saved.activePageId };
}

export function overlayTrailPiece(trail: HabitsTrail, side?: Side, color?: string): Piece | null {
  const last = trail.points.at(-1);
  const name = trail.playerName.trim();
  const tint = color ? { color } : {};
  if (trail.deathAt) {
    return makePiece("pawn", trail.deathAt.x, trail.deathAt.y, {
      ...(last != null ? { z: last.z, yaw: last.yaw } : {}),
      ...(name ? { label: name } : {}),
      alive: false,
      ...(side ? { side } : {}),
      ...tint,
    });
  }
  if (!last) return null;
  return makePiece("pawn", last.x, last.y, {
    z: last.z,
    yaw: last.yaw,
    ...(name ? { label: name } : {}),
    alive: true,
    ...(side ? { side } : {}),
    ...tint,
  });
}

export function overlayToPieces(
  overlay: SeriesOverlay,
  playSec: number,
  nadeFilter: HabitsNadeFilter = DEFAULT_HABITS_NADE_FILTER,
  nadesOn = true,
  side?: Side,
): Piece[] {
  return overlayToSnapshot(overlay, playSec, nadeFilter, nadesOn, side).pieces;
}

function uniqueSnapshotName(base: string, used: Set<string>): string {
  const stem = base.trim() === "" ? "Player" : base.trim();
  if (!used.has(stem)) {
    used.add(stem);
    return stem;
  }
  let n = 2;
  let next = `${stem} (${n})`;
  while (used.has(next)) {
    n += 1;
    next = `${stem} (${n})`;
  }
  used.add(next);
  return next;
}

function trailMatchKey(demoId: string, roundNumber: number, steamId: number): string | null {
  if (demoId === "" || steamId === 0) return null;
  return `${demoId}:${roundNumber}:${steamId}`;
}

export function overlayToSnapshot(
  overlay: SeriesOverlay,
  playSec: number,
  nadeFilter: HabitsNadeFilter = DEFAULT_HABITS_NADE_FILTER,
  nadesOn = true,
  side?: Side,
): { pieces: Piece[]; groups: DrawingGroup[]; radarFx?: NoteRadarFx } {
  const visible = overlayAtPlaySec(overlay, playSec);
  const pieces: Piece[] = [];
  const groups: DrawingGroup[] = [];
  const tints = new Map<string, string>();
  const usedNames = new Set<string>();
  const groupByTrail = new Map<string, string>();
  const trails: NoteRadarFx["trails"] = [];

  for (const trail of visible.trails) {
    const color = tintForName(trail.playerName, tints);
    const piece = overlayTrailPiece(trail, side, color);
    const fxTrail = {
      points: trail.points.map((pt) => ({ x: pt.x, y: pt.y })),
      color,
    };
    if (!piece) {
      trails.push(fxTrail);
      continue;
    }
    const groupName = uniqueSnapshotName(trail.playerName, usedNames);
    const groupId = crypto.randomUUID();
    piece.groupId = groupId;
    pieces.push(piece);
    groups.push({ id: groupId, name: groupName, drawings: [] });
    const key = trailMatchKey(trail.demoId, trail.roundNumber, trail.steamId);
    if (key) groupByTrail.set(key, groupId);
    trails.push({ ...fxTrail, groupId, label: groupName });
  }

  if (nadesOn) {
    for (const nade of visible.nades) {
      if (!habitsNadeVisible(nade.kind, nadeFilter)) continue;
      const render = nadeRenderAt(
        nade.grenade,
        habitsNadeViewTick(nade, playSec),
        nade.tps,
        1,
        nade.roundEndTick,
      );
      if (!render) continue;
      const piece = nadeToPiece(render);
      if (!piece) continue;
      const key =
        nade.demoId != null && nade.roundNumber != null && nade.steamId != null
          ? trailMatchKey(nade.demoId, nade.roundNumber, nade.steamId)
          : null;
      const groupId = key ? groupByTrail.get(key) : undefined;
      if (groupId) piece.groupId = groupId;
      pieces.push(piece);
    }
  }

  const deaths = visible.trails
    .filter((trail) => trail.deathAt)
    .map((trail) => ({
      x: trail.deathAt!.x,
      y: trail.deathAt!.y,
      line: null,
    }));
  const fx: NoteRadarFx = {
    deaths,
    opening: null,
    tracers: [],
    trails,
    heatmap: [],
    summary: [],
    cone: null,
    hits: [],
    flashes: [],
  };
  return { pieces, groups, radarFx: radarFxIsEmpty(fx) ? undefined : fx };
}

export function overlayToRadarFx(overlay: SeriesOverlay, playSec: number): NoteRadarFx | undefined {
  return overlayToSnapshot(overlay, playSec, DEFAULT_HABITS_NADE_FILTER, false).radarFx;
}

export function snapshotAggTitle(opts: {
  focalTeam: string;
  demoCount: number;
  side: Side;
  kind: RoundKind;
  playSec: number;
}): string {
  return `${opts.focalTeam} series (${opts.demoCount} demos) · ${opts.side} ${opts.kind} · ${formatClock(opts.playSec)}`;
}

export function snapshotFromAnalyzer(input: {
  replay: Replay;
  tick: number;
  fileName: string;
  floor: FloorMode;
  cal?: MapCalibration;
  mapName: string;
  overlay: SeriesOverlay | null;
  playSec: number;
  nadeFilter?: HabitsNadeFilter;
  nadesOn?: boolean;
  series?: {
    mapName: string;
    focalTeam: string;
    demos: { length: number };
  } | null;
  bucket?: { side: Side; kind: RoundKind } | null;
  layers?: MapLayers;
  summaryFilter?: SummaryFilter;
  selected?: number | null;
  trails?: boolean;
}): {
  mapName: string;
  pieces: Piece[];
  groups?: DrawingGroup[];
  stratTitle: string;
  floor: FloorMode;
  radarFx?: NoteRadarFx;
} {
  if (input.overlay) {
    const bucket = input.bucket;
    const snap = overlayToSnapshot(
      input.overlay,
      input.playSec,
      input.nadeFilter ?? DEFAULT_HABITS_NADE_FILTER,
      input.nadesOn ?? true,
      bucket?.side,
    );
    return {
      mapName: input.series?.mapName ?? input.mapName,
      pieces: snap.pieces,
      groups: snap.groups,
      radarFx: snap.radarFx,
      stratTitle: snapshotAggTitle({
        focalTeam: input.series?.focalTeam || "Team",
        demoCount: input.series?.demos.length ?? 1,
        side: bucket?.side ?? "CT",
        kind: bucket?.kind ?? "pistol",
        playSec: input.playSec,
      }),
      floor: input.floor,
    };
  }
  const snap = snapshotFrame(input.replay, input.tick, input.cal, {
    layers: input.layers,
    summaryFilter: input.summaryFilter,
    selected: input.selected,
    trails: input.trails,
    floorMode: input.floor,
  });
  return {
    mapName: input.mapName,
    pieces: snap.pieces,
    radarFx: snap.radarFx,
    stratTitle: snapshotTitleFromReplay(input.replay, input.tick, input.fileName),
    floor: input.floor,
  };
}
