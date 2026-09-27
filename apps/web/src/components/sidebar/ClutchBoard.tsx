import { useMemo, useState } from "react";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";
import { clutchBoard } from "@/lib/match/clutches";
import { currentRound } from "@/lib/replay/sample";
import type { Replay } from "@/lib/replay/replayTypes";
import { prettyWeapon } from "@/lib/weapons/weapons";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
  onSelect: (index: number) => void;
}

type ResultFilter = "all" | "won" | "lost";

export function ClutchBoard({ replay, tick, selected, onJump, onSelect }: Props) {
  const [thisRound, setThisRound] = useState(false);
  const [result, setResult] = useState<ResultFilter>("all");
  const live = currentRound(replay, tick);
  const rows = useMemo(() => clutchBoard(replay), [replay]);
  const roundN = thisRound ? (live && !live.is_knife ? live.number : -1) : null;
  const shown = rows.filter((row) => {
    if (roundN != null && row.round !== roundN) return false;
    if (result === "won" && !row.won) return false;
    if (result === "lost" && row.won) return false;
    return true;
  });
  const wins = rows.filter((row) => row.won).length;

  return (
    <div className="review">
      <p className="tab-hint">
        1v2 and harder, won or lost. Click a row — or its radar marker — to jump to the start.
      </p>
      <h3 className="util-head">
        Clutches{" "}
        <span className="muted">
          {rows.length} · {wins} won
        </span>
      </h3>
      <div className="filters" role="toolbar" aria-label="Clutch filters">
        <button
          type="button"
          className={`filter${thisRound ? "" : " on"}`}
          onClick={() => setThisRound(false)}
        >
          All rounds
        </button>
        <button
          type="button"
          className={`filter${thisRound ? " on" : ""}`}
          onClick={() => setThisRound(true)}
        >
          This round
        </button>
        <span className="filter-gap" />
        <button
          type="button"
          className={`filter${result === "all" ? " on" : ""}`}
          onClick={() => setResult("all")}
        >
          Both
        </button>
        <button
          type="button"
          className={`filter${result === "won" ? " on" : ""}`}
          onClick={() => setResult("won")}
        >
          Won
        </button>
        <button
          type="button"
          className={`filter${result === "lost" ? " on" : ""}`}
          onClick={() => setResult("lost")}
        >
          Lost
        </button>
      </div>
      {shown.length === 0 ? (
        <p className="muted tab-hint">
          {rows.length === 0
            ? "No 1v2+ clutches in this match."
            : "No clutches match these filters."}
        </p>
      ) : (
        <ul className="review-notes">
          {shown.map((row) => {
            const pending = row.tick > tick;
            const watching =
              live != null &&
              !live.is_knife &&
              live.number === row.round &&
              tick >= row.tick &&
              (selected == null || selected === row.player);
            const weaponLabel = row.weapon ? prettyWeapon(row.weapon) : "—";
            return (
              <li key={`${row.round}-${row.player}-${row.tick}`}>
                <button
                  type="button"
                  className={`review-note ${row.won ? "good" : "high"}${pending ? " pending" : ""}${watching ? " on" : ""}`}
                  onClick={() => {
                    onSelect(row.player);
                    onJump(row.tick);
                  }}
                >
                  <span className="pill review-round">{row.roundLabel}</span>
                  <span className="review-copy">
                    <span className="review-title util-nade-title">
                      {row.weapon ? <WeaponIcon weapon={row.weapon} /> : null}
                      {row.name} · 1v{row.vs}
                    </span>
                    <span className="review-detail">
                      {weaponLabel} · {row.won ? "Won" : "Lost"} · tick {row.tick}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
