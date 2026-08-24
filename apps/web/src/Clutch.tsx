import { useMemo, useState } from "react";
import { clutchAttempts, liveClutch, type ClutchAttempt } from "./clutches";
import type { Replay } from "./types";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
  onSelect: (index: number) => void;
}

type Filter = "all" | "won" | "lost" | "1v1" | "1v2" | "1v3";

function matches(c: ClutchAttempt, filter: Filter): boolean {
  if (filter === "won") return c.won;
  if (filter === "lost") return !c.won;
  if (filter === "1v1") return c.vs === 1;
  if (filter === "1v2") return c.vs === 2;
  if (filter === "1v3") return c.vs >= 3;
  return true;
}

function title(c: ClutchAttempt): string {
  return `${c.name} 1v${c.vs} ${c.won ? "won" : "lost"}`;
}

export function Clutch({ replay, tick, selected, onJump, onSelect }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const live = liveClutch(replay, tick);
  const rows = useMemo(() => {
    const all = clutchAttempts(replay, tick);
    const scoped = selected != null ? all.filter((c) => c.player === selected) : all;
    return scoped.filter((c) => matches(c, filter));
  }, [replay, tick, selected, filter]);
  const wins = rows.filter((c) => c.won).length;

  return (
    <div className="review">
      <p className="tab-hint">
        1vX attempts through this tick. Jump to the moment the clutch started.
        {selected != null ? ` Showing ${replay.players[selected]?.name}.` : ""}
      </p>
      <div className="filters" role="toolbar" aria-label="Clutch filters">
        {(
          [
            ["all", "All"],
            ["won", "Won"],
            ["lost", "Lost"],
            ["1v1", "1v1"],
            ["1v2", "1v2"],
            ["1v3", "1v3+"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`filter${filter === id ? " on" : ""}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {live && (selected == null || live.player === selected) && (
        <button
          type="button"
          className="review-note on"
          onClick={() => {
            onSelect(live.player);
            onJump(live.tick);
          }}
        >
          <span className="pill review-round">Live</span>
          <span className="review-copy">
            <span className="review-title">
              {live.name} 1v{live.vs}
            </span>
            <span className="review-detail">in progress · {live.side}</span>
          </span>
        </button>
      )}
      {rows.length === 0 ? (
        <p className="muted tab-hint">No completed clutches through this tick.</p>
      ) : (
        <>
          <p className="muted tab-hint">
            {wins}/{rows.length} won
            {filter !== "all" ? ` in this filter` : ""}
          </p>
          <ul className="review-notes">
            {rows.map((c) => (
              <li key={`${c.round}-${c.player}-${c.tick}`}>
                <button
                  type="button"
                  className={`review-note ${c.won ? "good" : "high"}`}
                  onClick={() => {
                    onSelect(c.player);
                    onJump(c.tick);
                  }}
                >
                  <span className="pill review-round">{c.roundLabel}</span>
                  <span className="review-copy">
                    <span className="review-title">{title(c)}</span>
                    <span className="review-detail">{c.side} · jump to start</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
