import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
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
  clampSeriesTrailWindowSec,
  DEFAULT_HABITS_NADE_FILTER,
  type HabitsNadeFilter,
  type HabitsNadeKind,
  type HabitsTrail,
  type SeriesOverlay,
  type SeriesOverlayDisplay,
} from "@/lib/parse/seriesOverlay";
import { focalRosterForSeries } from "@/lib/parse/seriesRoster";
import { aggregateUtilSets, type UtilSetEntry } from "@/lib/parse/seriesUtilSets";
import { seriesDemoColors } from "@/lib/parse/seriesDemoColor";
import type { RoundKind } from "@/lib/parse/roundTags";
import type { MapPlaces } from "@/lib/match/sites";
import type { Side } from "@/lib/replay/replayTypes";
import { SERIES_HABITS_WINDOW_SECONDS } from "@/lib/shared/constants";
import {
  tutorialLocksSeriesToAggregatedFull,
  tutorialSeriesHabitsTags,
  TUTORIAL_AGGREGATED_LOCK_NOTICE,
} from "@/lib/tutorial/activeRound";

export type SeriesViewMode = "demos" | "aggregated";

export interface BucketOverlaySelection {
  kind: RoundKind;
  side: Side;
}

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
  /** Active bucket overlay (all rounds of one buy + side). Null = GOTV playback. */
  bucketOverlay: BucketOverlaySelection | null;
  selectBucketOverlay: (kind: RoundKind, side: Side) => void;
  /** Set bucket overlay without toggling off (tutorial enter, StrictMode). */
  ensureBucketOverlay: (kind: RoundKind, side: Side) => void;
  /** Freeze-relative playhead for bucket overlay (0 … bucketWindowSec). */
  bucketPlaySec: number;
  bucketPlaySecRef: MutableRefObject<number>;
  setBucketPlaySec: (sec: number | ((prev: number) => number)) => void;
  /** Max seconds after freeze for the active bucket (longest matched round). */
  bucketWindowSec: number;
  /** Player-path display: individual trails or the Overall path tree. */
  overlayDisplay: SeriesOverlayDisplay;
  setOverlayDisplay: (display: SeriesOverlayDisplay) => void;
  /** Freeze-relative path polylines (default off). */
  overlayTrails: boolean;
  setOverlayTrails: (on: boolean) => void;
  /** Player arrow at each path head (default on). */
  overlayArrows: boolean;
  setOverlayArrows: (on: boolean) => void;
  nadeFilter: HabitsNadeFilter;
  setNadeKind: (kind: HabitsNadeKind, on: boolean) => void;
  nadesOn: boolean;
  setNadesOn: (on: boolean) => void;
  nadeOpacity: number;
  setNadeOpacity: (opacity: number) => void;
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
  playRound: (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => void;
}

const DEFAULT_FILTER: SeriesHabitsFilter = { side: "CT", kind: "full", playerKey: null };

/**
 * Habits filters survive demo hops inside a series (same overlay query).
 * They are not reset here when `series` identity changes — drop a new series
 * to get a new hook instance / default filter.
 */
export function useSeriesHabits(opts: {
  series: DemoSeries | null;
  places: MapPlaces | null;
  activeDemoId: string | null;
  selectDemo: (id: string) => void;
  jump: (tick: number) => void;
  trailWindowSec?: number;
  pathBranchMergeDistance?: number;
  pathBranchStepDistance?: number;
  pathBranchMinShare?: number;
  onLockedNavigation?: (notice: string) => void;
}): SeriesHabitsState {
  const { series, places, activeDemoId, selectDemo, jump, onLockedNavigation } = opts;
  const locked = tutorialLocksSeriesToAggregatedFull(series);
  const trailWindowSec = clampSeriesTrailWindowSec(
    opts.trailWindowSec ?? SERIES_HABITS_WINDOW_SECONDS,
  );
  const [filter, setFilter] = useState<SeriesHabitsFilter>(DEFAULT_FILTER);
  const [overlayOn, setOverlayOn] = useState(true);
  const [bucketOverlay, setBucketOverlay] = useState<BucketOverlaySelection | null>(null);
  const [bucketPlaySec, setBucketPlaySecState] = useState(0);
  const bucketPlaySecRef = useRef(0);
  const bucketWindowSecRef = useRef(0);
  const [overlayDisplay, setOverlayDisplay] = useState<SeriesOverlayDisplay>("trails");
  const [overlayTrails, setOverlayTrails] = useState(false);
  const [overlayArrows, setOverlayArrows] = useState(true);
  const [nadeFilter, setNadeFilter] = useState<HabitsNadeFilter>(DEFAULT_HABITS_NADE_FILTER);
  const [nadesOn, setNadesOn] = useState(true);
  const [nadeOpacity, setNadeOpacity] = useState(0.4);
  const [seriesView, setSeriesView] = useState<SeriesViewMode>("demos");
  const aggregated = seriesView === "aggregated";
  const pendingJumpRef = useRef<{ demoId: string; tick: number } | null>(null);

  const playerKey = useMemo(() => {
    if (!filter.playerKey || !series) return filter.playerKey;
    const roster = focalRosterForSeries(series);
    return roster.some((p) => p.key === filter.playerKey) ? filter.playerKey : null;
  }, [filter.playerKey, series]);

  const bucketFilter = useMemo((): SeriesFilter => {
    if (bucketOverlay) return { side: bucketOverlay.side, kind: bucketOverlay.kind };
    return { side: filter.side, kind: filter.kind };
  }, [bucketOverlay, filter.side, filter.kind]);

  const focalPlayers = useMemo(() => {
    if (!series) return [];
    return focalRosterForSeries(series);
  }, [series]);

  const overlaySeries = useMemo(() => {
    if (!series) return null;
    const tagsByDemo = tutorialSeriesHabitsTags(series);
    if (tagsByDemo === series.tagsByDemo) return series;
    return { ...series, tagsByDemo };
  }, [series]);

  const overlay = useMemo(() => {
    if (!overlaySeries || !aggregated || !overlayOn || !bucketOverlay) return null;
    return buildSeriesOverlay(overlaySeries, bucketFilter, playerKey, trailWindowSec, {
      mergeDistance: opts.pathBranchMergeDistance,
      stepDistance: opts.pathBranchStepDistance,
      minShare: opts.pathBranchMinShare,
    });
  }, [
    overlaySeries,
    aggregated,
    overlayOn,
    bucketOverlay,
    bucketFilter,
    playerKey,
    trailWindowSec,
    opts.pathBranchMergeDistance,
    opts.pathBranchStepDistance,
    opts.pathBranchMinShare,
  ]);

  const bucketWindowSec = overlay?.windowSec ?? 0;

  useEffect(() => {
    bucketWindowSecRef.current = bucketWindowSec;
    if (bucketPlaySecRef.current > bucketWindowSec) {
      bucketPlaySecRef.current = bucketWindowSec;
      setBucketPlaySecState(bucketWindowSec);
    }
  }, [bucketWindowSec]);

  const util = useMemo(() => {
    if (!overlaySeries || !aggregated) return null;
    return aggregateSeriesUtil(
      overlaySeries,
      overlaySeries.tagsByDemo,
      bucketFilter,
      places,
      playerKey,
    );
  }, [overlaySeries, aggregated, bucketFilter, places, playerKey]);

  const action = useMemo(() => {
    if (!overlaySeries || !aggregated) return null;
    return aggregateSeriesAction(overlaySeries, overlaySeries.tagsByDemo, bucketFilter, places);
  }, [overlaySeries, aggregated, bucketFilter, places]);

  const seriesUtilThrows = useMemo(() => {
    if (!overlaySeries || !aggregated) return [];
    return collectSeriesUtilThrows(
      overlaySeries,
      overlaySeries.tagsByDemo,
      bucketFilter,
      places,
      playerKey,
    );
  }, [overlaySeries, aggregated, bucketFilter, places, playerKey]);

  const seriesActionBeats = useMemo(() => {
    if (!overlaySeries || !aggregated) return [];
    return collectSeriesActionBeats(overlaySeries, overlaySeries.tagsByDemo, bucketFilter, places);
  }, [overlaySeries, aggregated, bucketFilter, places]);

  const seriesRoundsByKind = useMemo(() => {
    if (!series) return [];
    return collectSeriesRoundsByKind(series);
  }, [series]);

  const demoColors = useMemo(() => {
    if (!series) return new Map<string, string>();
    return seriesDemoColors(series.demos.map((demo) => demo.id));
  }, [series]);

  const utilSets = useMemo(() => {
    if (!overlaySeries || !aggregated) return null;
    return aggregateUtilSets(overlaySeries, bucketFilter, places);
  }, [overlaySeries, aggregated, bucketFilter, places]);

  useLayoutEffect(() => {
    const pending = pendingJumpRef.current;
    if (!pending || activeDemoId !== pending.demoId) return;
    jump(pending.tick);
    pendingJumpRef.current = null;
  }, [activeDemoId, jump]);

  const jumpToDemoRound = useCallback(
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

  const rejectLockedNav = useCallback(() => {
    onLockedNavigation?.(TUTORIAL_AGGREGATED_LOCK_NOTICE);
  }, [onLockedNavigation]);

  const resetBucketPlaySec = useCallback(() => {
    bucketPlaySecRef.current = 0;
    setBucketPlaySecState(0);
  }, []);

  const playRound = useCallback(
    (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => {
      if (locked) {
        rejectLockedNav();
        return;
      }
      setBucketOverlay(null);
      resetBucketPlaySec();
      jumpToDemoRound(target);
    },
    [jumpToDemoRound, locked, rejectLockedNav, resetBucketPlaySec],
  );

  const selectBucketOverlay = useCallback(
    (kind: RoundKind, side: Side) => {
      if (locked) {
        if (kind !== "full") {
          rejectLockedNav();
          return;
        }
        setFilter((prev) => ({ ...prev, kind, side }));
        setBucketOverlay({ kind, side });
        setOverlayOn(true);
        return;
      }
      setFilter((prev) => ({ ...prev, kind, side }));
      setBucketOverlay((prev) => {
        if (prev?.kind === kind && prev.side === side) return null;
        return { kind, side };
      });
      resetBucketPlaySec();
      setOverlayOn(true);
    },
    [locked, rejectLockedNav, resetBucketPlaySec],
  );

  const ensureBucketOverlay = useCallback((kind: RoundKind, side: Side) => {
    setFilter((prev) =>
      prev.kind === kind && prev.side === side ? prev : { ...prev, kind, side },
    );
    setBucketOverlay((prev) => {
      if (prev?.kind === kind && prev.side === side) return prev;
      return { kind, side };
    });
    setOverlayOn(true);
  }, []);

  const setSide = useCallback(
    (side: Side) => {
      setFilter((prev) => ({ ...prev, side }));
      if (locked) {
        setBucketOverlay({ kind: "full", side });
        setOverlayOn(true);
        return;
      }
      setBucketOverlay(null);
    },
    [locked],
  );

  const setKind = useCallback(
    (kind: RoundKind) => {
      if (locked) {
        if (kind !== "full") {
          rejectLockedNav();
          return;
        }
        setFilter((prev) => ({ ...prev, kind }));
        setBucketOverlay((prev) => ({ kind: "full", side: prev?.side ?? "CT" }));
        setOverlayOn(true);
        return;
      }
      setFilter((prev) => ({ ...prev, kind }));
      setBucketOverlay(null);
    },
    [locked, rejectLockedNav],
  );

  const setPlayerKey = useCallback((playerKey: string | null) => {
    setFilter((prev) => ({ ...prev, playerKey }));
  }, []);

  const setBucketPlaySec = useCallback((sec: number | ((prev: number) => number)) => {
    setBucketPlaySecState((prev) => {
      const raw = typeof sec === "function" ? sec(prev) : sec;
      const max = bucketWindowSecRef.current;
      const next = Math.max(0, Math.min(max, raw));
      bucketPlaySecRef.current = next;
      return next;
    });
  }, []);

  const setNadeKind = useCallback((kind: HabitsNadeKind, on: boolean) => {
    setNadeFilter((prev) => ({ ...prev, [kind]: on }));
  }, []);

  const setOverlayOnWrapped = useCallback(
    (on: boolean) => {
      if (locked && !on) {
        rejectLockedNav();
        return;
      }
      setOverlayOn(on);
    },
    [locked, rejectLockedNav],
  );

  const setSeriesViewWrapped = useCallback(
    (view: SeriesViewMode) => {
      if (locked && view !== "aggregated") {
        rejectLockedNav();
        return;
      }
      setSeriesView(view);
      if (view !== "aggregated") setBucketOverlay(null);
    },
    [locked, rejectLockedNav],
  );

  return {
    filter,
    playerKey,
    setSide,
    setKind,
    setPlayerKey,
    seriesView,
    setSeriesView: setSeriesViewWrapped,
    aggregated,
    overlayOn,
    setOverlayOn: setOverlayOnWrapped,
    bucketOverlay,
    selectBucketOverlay,
    ensureBucketOverlay,
    bucketPlaySec,
    bucketPlaySecRef,
    setBucketPlaySec,
    bucketWindowSec,
    overlayDisplay,
    setOverlayDisplay,
    overlayTrails,
    setOverlayTrails,
    overlayArrows,
    setOverlayArrows,
    nadeFilter,
    setNadeKind,
    nadesOn,
    setNadesOn,
    nadeOpacity,
    setNadeOpacity,
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
    playRound,
  };
}
