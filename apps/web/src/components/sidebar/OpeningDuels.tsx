import { useMemo } from "react";
import { openingDuels, type OpeningDuelRow } from "@/lib/match/openings";
import { currentRound } from "@/lib/replay/sample";
import type { Replay } from "@/lib/replay/replayTypes";

interface Props {
  replay: Replay;
  tick: number;
  onJump: (tick: number) => void;
}

function outcome(teamWon: boolean | null): string {
  if (teamWon == null) return "";
  return teamWon ? " · won the round" : " · lost the round";
}

function rowClass(row: OpeningDuelRow, tick: number, liveRound: number | null): string {
  const pending = tick < row.tick;
  const on = !pending && liveRound === row.round;
  return `review-note opening-duel${on ? " on" : ""}${pending ? " pending" : ""}`;
}

/** Match-wide opening list. Single demo only — the caller hides this in Aggregated. */
export function OpeningDuels({ replay, tick, onJump }: Props) {
  const rows = useMemo(() => openingDuels(replay), [replay]);
  const liveRound = currentRound(replay, tick)?.number ?? null;

  return (
    <section className="opening-duels" aria-label="Opening duels">
      <h3 className="util-head">Opening duels</h3>
      <p className="tab-hint">
        First kill of each round. Click a row to jump there. With FK on, the radar marks the killer
        and the victim.
      </p>
      {rows.length === 0 ? (
        <p className="muted tab-hint">No opening duels in this match.</p>
      ) : (
        <ul className="review-notes">
          {rows.map((row) => (
            <li key={row.round}>
              <button
                type="button"
                className={rowClass(row, tick, liveRound)}
                onClick={() => onJump(row.tick)}
              >
                <span className="pill review-round">{row.roundLabel}</span>
                <span className={`pill ${row.side === "CT" ? "ct" : "t"}`}>{row.side}</span>
                <span className="review-copy">
                  <span className="review-title">
                    {row.killer} killed {row.victim}
                  </span>
                  <span className="review-detail">
                    {row.weapon}
                    {outcome(row.teamWon)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
