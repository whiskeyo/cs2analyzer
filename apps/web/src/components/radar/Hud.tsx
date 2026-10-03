import { memo } from "react";
import { plantedClock } from "@/lib/replay/plantedClock";
import { currentRound } from "@/lib/replay/sample";
import { BOMB_CLOCK_HOT_SECONDS, tickRate } from "@/lib/shared/constants";
import { liveSituation, liveTeams, roundHudLabel } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";
import { prettyMap, winReasonLabel } from "@/lib/weapons/weapons";

interface Props {
  replay: Replay;
  tick: number;
  /**
   * Burned-in clip clock. When set, it replaces the live freeze and C4 chips
   * so a defuse or explosion keeps the fuse reading for the rest of the round.
   */
  clockLabel?: string;
}

/** Memoised: every app state change re-renders the viewer, not just a new tick. */
export const Hud = memo(function Hud({ replay, tick, clockLabel }: Props) {
  const sit = liveSituation(replay, tick);
  const teams = liveTeams(replay, tick);
  const round = currentRound(replay, tick);
  const clutchName =
    sit.clutch != null ? (replay.players[sit.clutch.player]?.name ?? "Player") : null;
  const planted = round ? plantedClock(replay, round, tick, tickRate(replay)) : null;
  // Running fuse still follows `sit.bomb` (hidden on a CT wipe or a dead timer).
  // After a defuse or explosion the shared fuse label stays until the next round.
  const c4Label =
    !clockLabel && planted && (sit.bomb != null || planted.stopped != null)
      ? planted.clockLabel
      : null;
  const c4Hot = planted != null && Math.max(0, planted.remaining) < BOMB_CLOCK_HOT_SECONDS;

  return (
    <div className="radar-hud">
      <div className="hud-score">
        <span className="t">
          {teams.tName} {teams.t}
        </span>
        <span className="alive">
          {sit.tAlive} – {sit.ctAlive}
        </span>
        <span className="ct">
          {teams.ct} {teams.ctName}
        </span>
      </div>
      <div className="hud-meta">
        {prettyMap(replay.header.map_name)}
        {round ? ` · ${roundHudLabel(round)}` : ""}
        {clockLabel ? ` · ${clockLabel}` : ""}
      </div>
      {sit.freeze != null && !clockLabel && (
        <div className="hud-freeze">Freeze {sit.freeze.toFixed(1)}s</div>
      )}
      {sit.roundWin && (
        <div className={`hud-win ${sit.roundWin.winner === "CT" ? "ct" : "t"}`}>
          {sit.roundWin.winner} wins
          {sit.roundWin.reason ? ` · ${winReasonLabel(sit.roundWin.reason)}` : ""}
        </div>
      )}
      {sit.plant && (
        <div className={`hud-plant${sit.plant.remaining < 1 ? " hot" : ""}`}>
          Plant {sit.plant.remaining.toFixed(1)}s
        </div>
      )}
      {c4Label && <div className={`hud-bomb${c4Hot ? " hot" : ""}`}>{c4Label}</div>}
      {sit.defuse && (
        <div className={`hud-defuse${sit.defuse.remaining < 2 ? " hot" : ""}`}>
          Defuse {sit.defuse.remaining.toFixed(1)}s{sit.defuse.haskit ? " · kit" : ""}
        </div>
      )}
      {sit.clutch && clutchName && (
        <div className={`hud-clutch ${sit.clutch.side === "CT" ? "ct" : "t"}`}>
          {clutchName} 1v{sit.clutch.vs}
        </div>
      )}
    </div>
  );
});
