import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DemoSeries } from "@/lib/parse/session";
import {
  aggregateSeriesAction,
  aggregateSeriesUtil,
  collectSeriesActionBeats,
  collectSeriesRoundsByKind,
  collectSeriesUtilThrows,
  type SeriesActionBeatRow,
  type SeriesFilter,
  type SeriesRoundsByKind,
  type SeriesUtilThrow,
} from "@/lib/parse/seriesAnalysis";
import {
  buildSeriesOverlay,
  type HabitsTrail,
  type SeriesOverlay,
} from "@/lib/parse/seriesOverlay";
import { focalRosterForSeries } from "@/lib/parse/seriesRoster";
import { aggregateUtilSets, type UtilSetEntry } from "@/lib/parse/seriesUtilSets";
import { seriesDemoColors } from "@/lib/parse/seriesDemoColor";
import type { RoundKind } from "@/lib/parse/roundTags";
import type { MapPlaces } from "@/lib/match/sites";
import type { Side } from "@/lib/replay/replayTypes";

export type SeriesViewMode = "demos" | "aggregated";

export interface SeriesHabitsFilter {
  side: Side;
  kind: RoundKind;
  /** Focal-team player key (`steam:…` or `name:…`). Null = all roster players. */
  playerKey: string | null;
}

export interface SeriesHabitsState {
  filter: SeriesHabitsFilter;
  /** Roster-valid player key; cleared when the focal team changes drop the player. */
  playerKey: string | null;
  setSide: (side: Side) => void;
  setKind: (kind: RoundKind) => void;
  setPlayerKey: (playerKey: string | null) => void;
  seriesView: SeriesViewMode;
  setSeriesView: (view: SeriesViewMode) => void;
  /** True when aggregated mode is on (series-wide stats + round strip). */
  aggregated: boolean;
  overlayOn: boolean;
  setOverlayOn: (on: boolean) => void;
  bucketFilter: SeriesFilter;
  overlay: SeriesOverlay | null;
  util: ReturnType<typeof aggregateSeriesUtil> | null;
  action: ReturnType<typeof aggregateSeriesAction> | null;
  utilSets: { entries: UtilSetEntry[]; roundCount: number } | null;
  seriesUtilThrows: SeriesUtilThrow[];
  seriesActionBeats: SeriesActionBeatRow[];
  seriesRoundsByKind: SeriesRoundsByKind[];
  demoColors: Map<string, string>;
  focalPlayers: { key: string; name: string }[];
  jumpHabits: (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => void;
}

const DEFAULT_FILTER: SeriesHabitsFilter = { side: "CT", kind: "full", playerKey: null };

export function useSeriesHabits(opts: {
  series: DemoSeries | null;
  places: MapPlaces | null;
  activeDemoId: string | null;
  selectDemo: (id: string) => void;
  jump: (tick: number) => void;
}): SeriesHabitsState {
  const { series, places, activeDemoId, selectDemo, jump } = opts;
  const [filter, setFilter] = useState<SeriesHabitsFilter>(DEFAULT_FILTER);
  const [overlayOn, setOverlayOn] = useState(true);
  const [seriesView, setSeriesView] = useState<SeriesViewMode>("demos");
  const aggregated = seriesView === "aggregated";
  const pendingJumpRef = useRef<{ demoId: string; tick: number } | null>(null);

  const playerKey = useMemo(() => {
    if (!filter.playerKey || !series) return filter.playerKey;
    const roster = focalRosterForSeries(series);
    return roster.some((p) => p.key === filter.playerKey) ? filter.playerKey : null;
  }, [filter.playerKey, series]);

  const bucketFilter = useMemo(
    (): SeriesFilter => ({ side: filter.side, kind: filter.kind }),
    [filter.side, filter.kind],
  );

  const focalPlayers = useMemo(() => {
    if (!series) return [];
    return focalRosterForSeries(series);
  }, [series]);

  const overlay = useMemo(() => {
    if (!series || !overlayOn) return null;
    return buildSeriesOverlay(series, bucketFilter, playerKey);
  }, [series, overlayOn, bucketFilter, playerKey]);

  const util = useMemo(() => {
    if (!series) return null;
    return aggregateSeriesUtil(series, series.tagsByDemo, bucketFilter, places, playerKey);
  }, [series, bucketFilter, places, playerKey]);

  const action = useMemo(() => {
    if (!series) return null;
    return aggregateSeriesAction(series, series.tagsByDemo, bucketFilter, places);
  }, [series, bucketFilter, places]);

  const seriesUtilThrows = useMemo(() => {
    if (!series) return [];
    return collectSeriesUtilThrows(series, series.tagsByDemo, bucketFilter, places, playerKey);
  }, [series, bucketFilter, places, playerKey]);

  const seriesActionBeats = useMemo(() => {
    if (!series) return [];
    return collectSeriesActionBeats(series, series.tagsByDemo, bucketFilter, places);
  }, [series, bucketFilter, places]);

  const seriesRoundsByKind = useMemo(() => {
    if (!series) return [];
    return collectSeriesRoundsByKind(series);
  }, [series]);

  const demoColors = useMemo(() => {
    if (!series) return new Map<string, string>();
    return seriesDemoColors(series.demos.map((demo) => demo.id));
  }, [series]);

  const utilSets = useMemo(() => {
    if (!series) return null;
    return aggregateUtilSets(series, bucketFilter, places);
  }, [series, bucketFilter, places]);

  useEffect(() => {
    const pending = pendingJumpRef.current;
    if (!pending || activeDemoId !== pending.demoId) return;
    jump(pending.tick);
    pendingJumpRef.current = null;
  }, [activeDemoId, jump]);

  const jumpHabits = useCallback(
    (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => {
      if (!series) return;
      if (activeDemoId === target.demoId) {
        jump(target.jumpTick);
        return;
      }
      pendingJumpRef.current = { demoId: target.demoId, tick: target.jumpTick };
      selectDemo(target.demoId);
    },
    [series, activeDemoId, jump, selectDemo],
  );

  const setSide = useCallback((side: Side) => {
    setFilter((prev) => ({ ...prev, side }));
  }, []);

  const setKind = useCallback((kind: RoundKind) => {
    setFilter((prev) => ({ ...prev, kind }));
  }, []);

  const setPlayerKey = useCallback((playerKey: string | null) => {
    setFilter((prev) => ({ ...prev, playerKey }));
  }, []);

  return {
    filter,
    playerKey,
    setSide,
    setKind,
    setPlayerKey,
    seriesView,
    setSeriesView,
    aggregated,
    overlayOn,
    setOverlayOn,
    bucketFilter,
    overlay,
    util,
    action,
    utilSets,
    seriesUtilThrows,
    seriesActionBeats,
    seriesRoundsByKind,
    demoColors,
    focalPlayers,
    jumpHabits,
  };
}
