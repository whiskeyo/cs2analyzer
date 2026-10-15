import { useId, useMemo } from "react";
import { teamMarkColor } from "@/lib/players/playerColors";
import type { TimelineColumn, TimelineStatId } from "@/lib/stats/timeline";
import { formatTimelineValue, plottedValue, timelineStat } from "@/lib/stats/timeline";
import {
  WIN_REASON_BOMB,
  WIN_REASON_CT_ELIM,
  WIN_REASON_CT_SURRENDER,
  WIN_REASON_DEFUSE,
  WIN_REASON_DRAW,
  WIN_REASON_T_ELIM,
  WIN_REASON_T_SURRENDER,
  WIN_REASON_TIME,
} from "@/lib/shared/constants";
import { winReasonLabel } from "@/lib/weapons/weapons";
import {
  TIMELINE_LAYOUT,
  areaPath,
  axisScale,
  economyBreakAfter,
  nearestRoundIndex,
  percentAxis,
  plotRect,
  roundMarkerSize,
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

/** Unresolved and drawn rounds stay neutral so a team hue always means a win. */
const MUTED_ROUND = "#3a4553";
const WIN_ICON = 16;

function markColor(colors: readonly string[], player: number): string {
  return colors[player] ?? "#d0d6dc";
}

function roundFill(column: TimelineColumn): string {
  if (column.winner == null || column.winReason === WIN_REASON_DRAW || column.winRoster == null) {
    return MUTED_ROUND;
  }
  return teamMarkColor(column.winRoster);
}

function roundLabel(column: TimelineColumn): string {
  if (column.winner == null) return `Round ${column.number}`;
  return `Round ${column.number}, ${winReasonLabel(column.winReason)}`;
}

type WinIconKind = "bomb" | "defuse" | "elim" | "time" | "flag";

function winIconKind(reason: number): WinIconKind | null {
  switch (reason) {
    case WIN_REASON_BOMB:
      return "bomb";
    case WIN_REASON_DEFUSE:
      return "defuse";
    case WIN_REASON_CT_ELIM:
    case WIN_REASON_T_ELIM:
      return "elim";
    case WIN_REASON_TIME:
      return "time";
    case WIN_REASON_T_SURRENDER:
    case WIN_REASON_CT_SURRENDER:
      return "flag";
    default:
      return null;
  }
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
  const uid = useId().replace(/:/g, "");
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
  const marker = roundMarkerSize(columns.length);
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
  const selectedLine = lines.find((line) => line.player === selected);
  const selectedFill =
    selectedLine != null ? areaPath(selectedLine.path, selectedLine.points, baseline) : "";
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
        <ChartDefs uid={uid} selected={selected} color={markColor(colors, selected ?? 0)} />
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
        {selectedFill ? (
          <path className="stats-timeline-area" d={selectedFill} fill={`url(#${uid}-fill)`} />
        ) : null}
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
          const y = baseline + 26;
          const icon =
            column.winner == null || column.winReason === WIN_REASON_DRAW
              ? null
              : winIconKind(column.winReason);
          return (
            <g
              key={`round-${index}`}
              role="img"
              aria-label={roundLabel(column)}
              onPointerEnter={() => onHover(index)}
            >
              {icon ? (
                <WinIcon kind={icon} x={x - WIN_ICON / 2} y={y - marker.radius - WIN_ICON - 2} />
              ) : null}
              <circle
                className="stats-timeline-round"
                cx={x}
                cy={y}
                r={marker.radius}
                fill={roundFill(column)}
              />
              <text
                className="stats-timeline-round-num"
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={marker.font}
              >
                {column.number}
              </text>
            </g>
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

function ChartDefs({
  uid,
  selected,
  color,
}: {
  uid: string;
  selected: number | null;
  color: string;
}) {
  return (
    <defs>
      {selected != null ? (
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      ) : null}
    </defs>
  );
}

function WinIcon({ kind, x, y }: { kind: WinIconKind; x: number; y: number }) {
  return (
    <g className="stats-timeline-win-icon" transform={`translate(${x} ${y})`}>
      {kind === "bomb" ? (
        <>
          <circle cx="7" cy="10" r="4.1" />
          <path d="M9.6 7 L13.2 3" />
          <circle className="stats-timeline-win-dot" cx="13.6" cy="2.5" r="1.15" />
        </>
      ) : null}
      {kind === "defuse" ? (
        <>
          <rect x="2.4" y="5" width="11.2" height="8" rx="1.3" />
          <path d="M5 5 V2.4 M11 5 V2.4 M4.4 9 H11.6" />
        </>
      ) : null}
      {kind === "elim" ? (
        <g className="stats-timeline-win-fill">
          <path d="M8 1.1a4.7 4.7 0 0 0-4.7 4.7c0 1.7.7 2.7 1.4 3.5V12h1.6V10.6h1.2V12h1v-1.4h1.2V12h1.6V9.3c.7-.8 1.4-1.8 1.4-3.5A4.7 4.7 0 0 0 8 1.1z" />
          <circle cx="6.2" cy="6.1" r="1.15" fill="#0b0e12" />
          <circle cx="9.8" cy="6.1" r="1.15" fill="#0b0e12" />
        </g>
      ) : null}
      {kind === "time" ? (
        <>
          <circle cx="8" cy="8" r="5.4" />
          <path d="M8 8 V4.2 M8 8 L10.8 9.7" />
        </>
      ) : null}
      {kind === "flag" ? (
        <>
          <path d="M4.2 14.4 V1.6" />
          <path d="M4.2 2.2 H12.2 L9.8 5.1 L12.2 8 H4.2" />
        </>
      ) : null}
    </g>
  );
}

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
  if (line.points.length < 2 && point) {
    return (
      <circle
        className={`stats-timeline-line${on ? " is-on" : ""}${dim ? " is-dim" : ""}`}
        cx={point.x}
        cy={point.y}
        r={3.2}
        fill={color}
      />
    );
  }
  return (
    <path
      className={`stats-timeline-line${on ? " is-on" : ""}${dim ? " is-dim" : ""}`}
      d={line.path}
      stroke={color}
      strokeWidth={2.2}
    />
  );
}
