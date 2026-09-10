import { isMultiDemoSeries } from "@/lib/parse/seriesMode";
import { canonicalSeriesTeam, type DemoSeries } from "@/lib/parse/session";
import { playerIdentityKey, playerIndexForKey, playerTeamNameAt } from "@/lib/parse/seriesRoster";
import type { Replay } from "@/lib/replay/replayTypes";

export function indexForPlayerKey(replay: Replay, playerKey: string | null): number | null {
  if (!playerKey) return null;
  return playerIndexForKey(replay, playerKey);
}

/**
 * Radar pawn, scoreboard row, or spec-economy card (single-demo HUD).
 * Multi-demo also writes the habits player key so the series filter stays the source.
 */
export function radarSelectPatch(input: {
  index: number | null;
  series: DemoSeries | null;
  replay: Replay | null;
  tick: number;
}): {
  selected: number | null;
  playerKey?: string | null;
  focalTeam?: string;
} {
  const multi = isMultiDemoSeries(input.series);
  if (input.index == null) {
    return { selected: null, playerKey: multi ? null : undefined };
  }
  if (!multi || !input.replay || !input.series) {
    return { selected: input.index };
  }
  const key = playerIdentityKey(input.replay, input.index);
  const teamName = playerTeamNameAt(input.replay, input.index, input.tick);
  const canonical = teamName ? canonicalSeriesTeam(input.series, teamName) : "";
  return {
    selected: input.index,
    playerKey: key,
    focalTeam: canonical && canonical !== input.series.focalTeam ? canonical : undefined,
  };
}

/** Series player dropdown (multi-demo). Selected index is derived from the key. */
export function habitsKeyPatch(input: { playerKey: string | null; replay: Replay | null }): {
  selected: number | null;
  playerKey: string | null;
} {
  if (!input.playerKey || !input.replay) {
    return { selected: null, playerKey: input.playerKey };
  }
  return {
    selected: indexForPlayerKey(input.replay, input.playerKey),
    playerKey: input.playerKey,
  };
}

/** After a series file hop, keep the same Steam/name key and remap the slot. */
export function demoHopSelected(replay: Replay, playerKey: string | null): number | null {
  return indexForPlayerKey(replay, playerKey);
}
