import { currentRound } from "@/lib/replay/sample";
import { liveSituation, liveTeams } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";
import { prettyMap, winReasonLabel } from "@/lib/weapons/weapons";

interface Props {
  replay: Replay;
  tick: number;
}

export function Hud({ replay, tick }: Props) {
  const sit = liveSituation(replay, tick);
  const teams = liveTeams(replay, tick);
  const round = currentRound(replay, tick);
  const clutchName =
    sit.clutch != null ? (replay.players[sit.clutch.player]?.name ?? "Player") : null;

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
        {round ? ` · ${round.is_knife ? "Knife" : `R${round.number}`}` : ""}
      </div>
      {sit.freeze != null && <div className="hud-freeze">Freeze {sit.freeze.toFixed(1)}s</div>}
      {sit.roundWin && (
        <div className={`hud-win ${sit.roundWin.winner === "CT" ? "ct" : "t"}`}>
          {sit.roundWin.winner} wins
          {sit.roundWin.reason ? ` · ${winReasonLabel(sit.roundWin.reason)}` : ""}
        </div>
      )}
      {sit.bomb && (
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
}
