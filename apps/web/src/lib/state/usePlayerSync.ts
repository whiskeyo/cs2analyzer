import { useEffect, useRef } from "react";
import type { Replay } from "@/lib/replay/replayTypes";
import { isMultiDemoSeries } from "@/lib/parse/seriesMode";
import { canonicalSeriesTeam, type DemoSeries } from "@/lib/parse/session";
import { playerIdentityKey, playerIndexForKey, playerTeamNameAt } from "@/lib/parse/seriesRoster";

interface SyncSnapshot {
  selected: number | null;
  playerKey: string | null;
  demoId: string | null;
}

function trackPlayerFromRadar(
  replay: Replay,
  series: DemoSeries,
  player: number,
  tick: number,
  setFocalTeam: (name: string) => void,
): string {
  const key = playerIdentityKey(replay, player);
  const teamName = playerTeamNameAt(replay, player, tick);
  if (teamName) {
    const canonical = canonicalSeriesTeam(series, teamName);
    if (canonical !== series.focalTeam) {
      setFocalTeam(canonical);
    }
  }
  return key;
}

/** Keep GOTV selection and multi-demo player tracker aligned by Steam/name key. */
export function usePlayerSync(opts: {
  series: DemoSeries | null;
  replay: Replay | null;
  activeDemoId: string | null;
  tick: number;
  selected: number | null;
  select: (index: number | null) => void;
  playerKey: string | null;
  setPlayerKey: (key: string | null) => void;
  setFocalTeam: (name: string) => void;
}): void {
  const {
    series,
    replay,
    activeDemoId,
    tick,
    selected,
    select,
    playerKey,
    setPlayerKey,
    setFocalTeam,
  } = opts;
  const lastRef = useRef<SyncSnapshot | null>(null);
  const multi = isMultiDemoSeries(series);

  useEffect(() => {
    if (!multi || !replay || !series) {
      lastRef.current = null;
      return;
    }

    const snap = lastRef.current ?? { selected, playerKey, demoId: activeDemoId };
    if (!lastRef.current) {
      lastRef.current = snap;
      if (playerKey && selected == null) {
        const idx = playerIndexForKey(replay, playerKey);
        if (idx != null) {
          snap.selected = idx;
          select(idx);
        }
      } else if (selected != null && playerKey == null) {
        const key = trackPlayerFromRadar(replay, series, selected, tick, setFocalTeam);
        snap.playerKey = key;
        setPlayerKey(key);
      }
      return;
    }

    const demoChanged = activeDemoId !== snap.demoId;
    if (demoChanged) {
      snap.demoId = activeDemoId;
      snap.playerKey = playerKey;
      if (playerKey) {
        const idx = playerIndexForKey(replay, playerKey);
        if (idx != null && idx !== selected) {
          snap.selected = idx;
          select(idx);
        } else {
          snap.selected = selected;
        }
      } else {
        snap.selected = selected;
      }
      return;
    }

    const keyChanged = playerKey !== snap.playerKey;
    const selectedChanged = selected !== snap.selected;

    if (!keyChanged && !selectedChanged) return;

    // Dropdown / habits filter changed — wins over a stale selected snapshot.
    if (keyChanged) {
      snap.playerKey = playerKey;
      if (playerKey == null) {
        if (selected != null) {
          snap.selected = null;
          select(null);
        }
        return;
      }
      const idx = playerIndexForKey(replay, playerKey);
      if (idx != null && idx !== selected) {
        snap.selected = idx;
        select(idx);
      }
      return;
    }

    // Radar / scoreboard changed — switch focal team when picking the other roster.
    snap.selected = selected;
    if (selected == null) {
      if (playerKey != null) {
        snap.playerKey = null;
        setPlayerKey(null);
      }
      return;
    }

    const key = trackPlayerFromRadar(replay, series, selected, tick, setFocalTeam);
    if (key !== playerKey) {
      snap.playerKey = key;
      setPlayerKey(key);
    }
  }, [
    multi,
    replay,
    series,
    activeDemoId,
    tick,
    selected,
    playerKey,
    select,
    setPlayerKey,
    setFocalTeam,
  ]);
}
