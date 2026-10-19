import { memo } from "react";
import { currentRound } from "@/lib/replay/sample";
import { liveSituation, liveTeams, roundHudLabel, roundSidesSwapped } from "@/lib/stats/stats";
import type { Replay, Side } from "@/lib/replay/replayTypes";
import { prettyMap, winReasonLabel } from "@/lib/weapons/weapons";

interface Props {
  replay: Replay;
  tick: number;
  /**
   * Burned-in clip clock. When set, it replaces the live freeze and C4 chips
   * so a defuse or explosion keeps the fuse reading for the rest of the round.
   */
  clockLabel?: string;
  /** Starting-side team for the Review tab (follows the roster across swaps). */
  onTeamClick?: (startSide: Side) => void;
}

/** Live CT/T → starting side of that roster at `tick`. */
export function startingSideForLive(replay: Replay, tick: number, live: Side): Side {
  const round = currentRound(replay, tick);
  const swapped = round ? roundSidesSwapped(replay, round) : false;
  if (!swapped) return live;
  return live === "CT" ? "T" : "CT";
}

/** Memoised: every app state change re-renders the viewer, not just a new tick. */
export const Hud = memo(function Hud({ replay, tick, clockLabel, onTeamClick }: Props) {
  const sit = liveSituation(replay, tick);
  const teams = liveTeams(replay, tick);
  const round = currentRound(replay, tick);
  const clutchName =
    sit.clutch != null ? (replay.players[sit.clutch.player]?.name ?? "Player") : null;

  function teamButton(live: Side, name: string) {
    if (!onTeamClick) return name;
    return (
      <button
        type="button"
        className="hud-team"
        onClick={() => onTeamClick(startingSideForLive(replay, tick, live))}
      >
        {name}
      </button>
    );
  }

  return (
    <div className="radar-hud">
      <div className="hud-score">
        <span className="t">
          {teamButton("T", teams.tName)} {teams.t}
        </span>
        <span className="alive">
          {sit.tAlive} – {sit.ctAlive}
        </span>
        <span className="ct">
          {teams.ct} {teamButton("CT", teams.ctName)}
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
      {sit.bomb && !clockLabel && (
        <div className={`hud-bomb${sit.bomb.remaining < 10 ? " hot" : ""}`}>
          C4 {sit.bomb.remaining.toFixed(1)}s
        </div>
      )}
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
