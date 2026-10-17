import { useMemo, useState } from "react";
import { playerMarkColors } from "@/lib/players/playerColors";
import type { Replay } from "@/lib/replay/replayTypes";
import {
  TIMELINE_GROUPS,
  formatTimelineValue,
  plottedValue,
  statsTimeline,
  type TimelineColumn,
  type TimelineStatId,
} from "@/lib/stats/timeline";
import { TIMELINE_LAYOUT, plotRect, roundX } from "@/lib/stats/timelineChart";
import { StatsTimelineChart } from "./StatsTimelineChart";

interface Props {
  replay: Replay;
  /** Shared with the scoreboard. Omit both to keep the highlight local. */
  selected?: number | null;
  onSelect?: (player: number | null) => void;
  /** Dialog label target when the chart is shown in HomeModal. */
  headingId?: string;
  /** The dialog header already shows the title. */
  hideTitle?: boolean;
}

export function StatsTimeline({
  replay,
  selected: selectedProp,
  onSelect,
  headingId,
  hideTitle = false,
}: Props) {
  const columns = useMemo(() => statsTimeline(replay), [replay]);
  const colors = useMemo(() => playerMarkColors(replay.players), [replay.players]);
  const [stat, setStat] = useState<TimelineStatId>("adr");
  const [localSelected, setLocalSelected] = useState<number | null>(null);
  const selected = onSelect ? (selectedProp ?? null) : localSelected;
  const choose = (player: number) => {
    const next = selected === player ? null : player;
    if (onSelect) onSelect(next);
    else setLocalSelected(next);
  };
  const [hover, setHover] = useState<number | null>(null);
  const column = hover != null ? columns[hover] : undefined;
  const anchor =
    column != null && hover != null
      ? roundX(hover, columns.length, plotRect()) / TIMELINE_LAYOUT.width
      : 0.5;
  const left = Math.min(0.78, Math.max(0.22, anchor)) * 100;

  return (
    <section className="stats-timeline" aria-label="Stats timeline">
      {hideTitle ? null : (
        <h2 id={headingId} className="stats-timeline-title">
          Stats timeline
        </h2>
      )}
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
          {column ? <HoverCard column={column} stat={stat} colors={colors} left={left} /> : null}
          <StatsTimelineChart
            columns={columns}
            stat={stat}
            colors={colors}
            selected={selected}
            hover={hover}
            onSelect={choose}
            onHover={setHover}
            matchInfo={replay.match_info}
          />
        </div>
      )}
    </section>
  );
}

function HoverCard({
  column,
  stat,
  colors,
  left,
}: {
  column: TimelineColumn;
  stat: TimelineStatId;
  colors: readonly string[];
  left: number;
}) {
  const rows = [...column.rows].sort((a, b) => {
    const delta = plottedValue(b.values[stat]) - plottedValue(a.values[stat]);
    return delta || a.name.localeCompare(b.name);
  });
  const maxRound = Math.max(0, ...rows.map((row) => row.values[stat].round));
  return (
    <div className="stats-timeline-card" style={{ left: `${left}%` }} role="status">
      <div className="stats-timeline-card-head">
        <strong>Round {column.number}</strong>
      </div>
      <div className="stats-timeline-card-cols" aria-hidden="true">
        <span />
        <span>Player</span>
        <span />
        <span className="stats-timeline-card-num">Round</span>
        <span className="stats-timeline-card-num">Total</span>
      </div>
      {rows.map((row) => {
        const value = row.values[stat];
        const width = maxRound > 0 ? (value.round / maxRound) * 100 : 0;
        const color = colors[row.player] ?? "#d0d6dc";
        return (
          <div key={row.player} className="stats-timeline-card-row">
            <span className="stats-timeline-dot" style={{ background: color }} />
            <span className="stats-timeline-name">{row.name}</span>
            <span className="stats-timeline-bar" aria-hidden="true">
              <span style={{ width: `${width}%`, background: color }} />
            </span>
            <span className="stats-timeline-card-num">
              {formatTimelineValue(stat, value.round)}
            </span>
            <span className="stats-timeline-card-num stats-timeline-running">
              {formatTimelineValue(stat, value.running)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
