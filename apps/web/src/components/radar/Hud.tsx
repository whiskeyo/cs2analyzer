import { memo } from "react";
import { useMessages, winReasonText } from "@/lib/i18n";
import { currentRound } from "@/lib/replay/sample";
import { liveSituation, liveTeams } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";
import { prettyMap } from "@/lib/weapons/weapons";

interface Props {
  replay: Replay;
  tick: number;
}

/** Memoised: every app state change re-renders the viewer, not just a new tick. */
export const Hud = memo(function Hud({ replay, tick }: Props) {
  const { messages, t } = useMessages();
  const sit = liveSituation(replay, tick);
  const teams = liveTeams(replay, tick);
  const round = currentRound(replay, tick);
  const clutchName =
    sit.clutch != null ? (replay.players[sit.clutch.player]?.name ?? messages.drop.player) : null;

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
        {round
          ? ` · ${round.is_knife ? messages.hud.knife : t(messages.hud.roundNumber, { number: round.number })}`
          : ""}
      </div>
      {sit.freeze != null && (
        <div className="hud-freeze">
          {t(messages.hud.freeze, { seconds: sit.freeze.toFixed(1) })}
        </div>
      )}
      {sit.roundWin && (
        <div className={`hud-win ${sit.roundWin.winner === "CT" ? "ct" : "t"}`}>
          {t(messages.hud.roundWin, { winner: sit.roundWin.winner })}
          {sit.roundWin.reason ? ` · ${winReasonText(messages, sit.roundWin.reason)}` : ""}
        </div>
      )}
      {sit.plant && (
        <div className={`hud-plant${sit.plant.remaining < 1 ? " hot" : ""}`}>
          {t(messages.hud.plant, { seconds: sit.plant.remaining.toFixed(1) })}
        </div>
      )}
      {sit.bomb && (
        <div className={`hud-bomb${sit.bomb.remaining < 10 ? " hot" : ""}`}>
          {t(messages.hud.c4, { seconds: sit.bomb.remaining.toFixed(1) })}
        </div>
      )}
      {sit.defuse && (
        <div className={`hud-defuse${sit.defuse.remaining < 2 ? " hot" : ""}`}>
          {t(sit.defuse.haskit ? messages.hud.defuseWithKit : messages.hud.defuse, {
            seconds: sit.defuse.remaining.toFixed(1),
          })}
        </div>
      )}
      {sit.clutch && clutchName && (
        <div className={`hud-clutch ${sit.clutch.side === "CT" ? "ct" : "t"}`}>
          {t(messages.hud.clutch, { name: clutchName, count: sit.clutch.vs })}
        </div>
      )}
    </div>
  );
});
