import { useMemo } from "react";
import type { TimelineColumn, TimelineStatId } from "@/lib/stats/timeline";
import { formatTimelineValue, plottedValue, timelineStat } from "@/lib/stats/timeline";
import {
  TIMELINE_LAYOUT,
  axisScale,
  economyBreakAfter,
  nearestRoundIndex,
  percentAxis,
  plotRect,
  roundX,
  smoothLinePath,
  valueToY,
  type TimelinePoint,
} from "@/lib/stats/timelineChart";

interface Props {
  columns: TimelineColumn[];
  stat: TimelineStatId;
  colors: readonly string[];
  selected: number | null;
  hover: number | null;
  onSelect: (player: number) => void;
  onHover: (index: number | null) => void;
}

function markColor(colors: readonly string[], player: number): string {
  return colors[player] ?? "#d0d6dc";
}

interface LineSeries {
  player: number;
  name: string;
  points: TimelinePoint[];
  path: string;
}

export function StatsTimelineChart({
  columns,
  stat,
  colors,
  selected,
  hover,
  onSelect,
  onHover,
}: Props) {
  const layout = TIMELINE_LAYOUT;
  const plot = plotRect(layout);
  const rows = columns[0]?.rows ?? [];
  const reference = selected ?? rows[0]?.player ?? 0;
  const scale = useMemo(() => {
    let peak = 0;
    for (const column of columns) {
      for (const row of column.rows) {
        peak = Math.max(peak, plottedValue(row.values[stat]));
      }
    }
    return stat === "hs" || stat === "kast" ? percentAxis(peak) : axisScale(peak);
  }, [columns, stat]);
  const baseline = plot.y + plot.height;
  const breakAfter = new Set(
    economyBreakAfter(
      columns.map((column) => ({
        number: column.number,
        side: column.rows.find((row) => row.player === reference)?.side ?? "T",
      })),
    ),
  );
  const lines: LineSeries[] = rows.map((row) => {
    const points = columns.map((column, index) => {
      const sample = column.rows.find((candidate) => candidate.player === row.player);
      const value = sample ? plottedValue(sample.values[stat]) : 0;
      return {
        x: roundX(index, columns.length, plot),
        y: valueToY(value, scale.max, plot),
      };
    });
    return { player: row.player, name: row.name, points, path: smoothLinePath(points) };
  });
  const painted = [...lines].sort(
    (a, b) => Number(selected === a.player) - Number(selected === b.player),
  );
  const modeLabel = "cumulative";

  return (
    <div className="stats-timeline-plot">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="group"
        aria-label={`${timelineStat(stat).label} ${modeLabel}`}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (bounds.width <= 0) return;
          const x = ((event.clientX - bounds.left) / bounds.width) * layout.width;
          const index = nearestRoundIndex(x, columns.length, plot);
          if (index >= 0) onHover(index);
        }}
      >
        {scale.ticks.map((tick) => {
          const y = valueToY(tick, scale.max, plot);
          return (
            <g key={tick}>
              <line
                className="stats-timeline-grid"
                x1={plot.x}
                y1={y}
                x2={plot.x + plot.width}
                y2={y}
              />
              <text
                className="stats-timeline-axis"
                x={plot.x - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {formatTimelineValue(stat, tick)}
              </text>
            </g>
          );
        })}
        {columns.map((column, index) => {
          const x = roundX(index, columns.length, plot);
          const next = columns[index + 1];
          const split =
            next && breakAfter.has(column.number)
              ? (x + roundX(index + 1, columns.length, plot)) / 2
              : null;
          return (
            <g key={`grid-${index}`}>
              <line className="stats-timeline-grid" x1={x} y1={plot.y} x2={x} y2={baseline} />
              {split != null ? (
                <line
                  className="stats-timeline-break"
                  x1={split}
                  y1={plot.y}
                  x2={split}
                  y2={baseline}
                />
              ) : null}
            </g>
          );
        })}
        {painted.map((line) => (
          <LineShape
            key={line.player}
            line={line}
            selected={selected}
            color={markColor(colors, line.player)}
          />
        ))}
        {hover != null && columns[hover] ? (
          <line
            className="stats-timeline-hover"
            x1={roundX(hover, columns.length, plot)}
            y1={plot.y}
            x2={roundX(hover, columns.length, plot)}
            y2={baseline}
          />
        ) : null}
        {columns.map((column, index) => {
          const x = roundX(index, columns.length, plot);
          return (
            <text
              key={`round-${index}`}
              className="stats-timeline-round-label"
              role="img"
              aria-label={`Round ${column.number}`}
              x={x}
              y={baseline + 16}
              textAnchor="middle"
              fontSize={10}
              onPointerEnter={() => onHover(index)}
            >
              R{column.number}
            </text>
          );
        })}
        {lines.map((line) => (
          <path
            key={`hit-${line.player}`}
            className="stats-timeline-hit"
            d={line.path}
            role="button"
            aria-label={`Highlight ${line.name}`}
            onClick={() => onSelect(line.player)}
          />
        ))}
      </svg>
    </div>
  );
}

/** Crisp stroke in CSS pixels. A viewBox stroke scales up and merges a long match. */
const LINE_STROKE = 0.6;
const HIGHLIGHT_STROKE = 1;

function LineShape({
  line,
  selected,
  color,
}: {
  line: LineSeries;
  selected: number | null;
  color: string;
}) {
  const on = selected === line.player;
  const dim = selected != null && !on;
  const point = line.points[0];
  const strokeWidth = on ? HIGHLIGHT_STROKE : LINE_STROKE;
  if (line.points.length < 2 && point) {
    return (
      <circle
        className={`stats-timeline-line${on ? " is-on" : ""}${dim ? " is-dim" : ""}`}
        cx={point.x}
        cy={point.y}
        r={strokeWidth}
        fill={color}
      />
    );
  }
  return (
    <path
      className={`stats-timeline-line${on ? " is-on" : ""}${dim ? " is-dim" : ""}`}
      d={line.path}
      stroke={color}
      strokeWidth={strokeWidth}
      vectorEffect="non-scaling-stroke"
    />
  );
}
