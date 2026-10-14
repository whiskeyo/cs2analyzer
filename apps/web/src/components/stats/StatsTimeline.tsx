import { useMemo, useState } from "react";
import { ECONOMY_BUY_LABEL } from "@/lib/match/economy";
import type { Replay } from "@/lib/replay/replayTypes";
import {
  TIMELINE_GROUPS,
  formatTimelineValue,
  plottedValue,
  statsTimeline,
  type TimelineColumn,
  type TimelineStatId,
} from "@/lib/stats/timeline";
import { TIMELINE_LAYOUT, playerColor, plotRect, roundX } from "@/lib/stats/timelineChart";
import { StatsTimelineChart } from "./StatsTimelineChart";

interface Props {
  replay: Replay;
}

export function StatsTimeline({ replay }: Props) {
  const columns = useMemo(() => statsTimeline(replay), [replay]);
  const [stat, setStat] = useState<TimelineStatId>("adr");
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const reference = selected ?? columns[0]?.rows[0]?.player ?? null;
  const column = hover != null ? columns[hover] : undefined;
  const anchor =
    column != null && hover != null
      ? roundX(hover, columns.length, plotRect()) / TIMELINE_LAYOUT.width
      : 0.5;
  const left = Math.min(0.78, Math.max(0.22, anchor)) * 100;

  return (
    <section className="stats-timeline" aria-label="Stats timeline">
      <h2 className="stats-timeline-title">Stats timeline</h2>
      <div className="stats-timeline-toolbar">
        <div className="stats-timeline-groups">
          {TIMELINE_GROUPS.map((group) => (
            <div key={group.label} className="stats-timeline-group">
              <span className="stats-timeline-group-label">{group.label}</span>
              {group.stats.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`filter${stat === item.id ? " on" : ""}`}
                  aria-pressed={stat === item.id}
                  onClick={() => setStat(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
      {columns.length === 0 ? (
        <p className="muted tab-hint">No competitive rounds to chart.</p>
      ) : (
        <div className="stats-timeline-stage" onPointerLeave={() => setHover(null)}>
          {column && reference != null ? (
            <HoverCard column={column} stat={stat} reference={reference} left={left} />
          ) : null}
          <StatsTimelineChart
            columns={columns}
            stat={stat}
            selected={selected}
            hover={hover}
            onSelect={(player) => setSelected((current) => (current === player ? null : player))}
            onHover={setHover}
          />
        </div>
      )}
    </section>
  );
}

function HoverCard({
  column,
  stat,
  reference,
  left,
}: {
  column: TimelineColumn;
  stat: TimelineStatId;
  reference: number;
  left: number;
}) {
  const rows = [...column.rows].sort((a, b) => {
    const delta = plottedValue(b.values[stat]) - plottedValue(a.values[stat]);
    return delta || a.name.localeCompare(b.name);
  });
  const maxRound = Math.max(0, ...rows.map((row) => row.values[stat].round));
  const focus = column.rows.find((row) => row.player === reference);
  return (
    <div className="stats-timeline-card" style={{ left: `${left}%` }} role="status">
      <div className="stats-timeline-card-head">
        <strong>Round {column.number}</strong>
        {focus ? (
          <span className={`pill ${focus.side === "CT" ? "ct" : "t"}`}>{focus.side}</span>
        ) : null}
        {focus?.buy ? <span className="pill">{ECONOMY_BUY_LABEL[focus.buy]}</span> : null}
        {focus?.won === true ? <span className="stats-timeline-result win">Won</span> : null}
        {focus?.won === false ? <span className="stats-timeline-result loss">Lost</span> : null}
      </div>
      <div className="stats-timeline-card-cols" aria-hidden="true">
        <span />
        <span>Player</span>
        <span />
        <span>Round</span>
        <span>Total</span>
      </div>
      {rows.map((row) => {
        const value = row.values[stat];
        const width = maxRound > 0 ? (value.round / maxRound) * 100 : 0;
        const color = playerColor(row.player);
        return (
          <div key={row.player} className="stats-timeline-card-row">
            <span className="stats-timeline-dot" style={{ background: color }} />
            <span className="stats-timeline-name">{row.name}</span>
            <span className="stats-timeline-bar" aria-hidden="true">
              <span style={{ width: `${width}%`, background: color }} />
            </span>
            <span>{formatTimelineValue(stat, value.round)}</span>
            <span className="stats-timeline-running">
              {formatTimelineValue(stat, value.running)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
