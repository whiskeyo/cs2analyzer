import { useId, useMemo } from "react";
import type { TimelineColumn, TimelineMode, TimelineStatId } from "@/lib/stats/timeline";
import { formatTimelineValue, plottedValue, timelineStat } from "@/lib/stats/timeline";
import {
  TIMELINE_LAYOUT,
  areaPath,
  axisScale,
  bandRect,
  nearestRoundIndex,
  percentAxis,
  pillTextColor,
  playerColor,
  plotRect,
  roundMarkerSize,
  roundX,
  showBandLabel,
  sideBands,
  smoothLinePath,
  spreadLabels,
  valueToY,
  type TimelinePoint,
} from "@/lib/stats/timelineChart";

interface Props {
  columns: TimelineColumn[];
  stat: TimelineStatId;
  mode: TimelineMode;
  selected: number | null;
  hover: number | null;
  onSelect: (player: number) => void;
  onHover: (index: number | null) => void;
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
  mode,
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
        peak = Math.max(peak, plottedValue(row.values[stat], mode));
      }
    }
    return stat === "hs" || stat === "kast" ? percentAxis(peak) : axisScale(peak);
  }, [columns, stat, mode]);
  const baseline = plot.y + plot.height;
  const marker = roundMarkerSize(columns.length);
  const bands = sideBands(
    columns.map((column) => column.rows.find((row) => row.player === reference)?.side ?? "T"),
  );
  const lines: LineSeries[] = rows.map((row) => {
    const points = columns.map((column, index) => {
      const sample = column.rows.find((candidate) => candidate.player === row.player);
      const value = sample ? plottedValue(sample.values[stat], mode) : 0;
      return {
        x: roundX(index, columns.length, plot),
        y: valueToY(value, scale.max, plot),
      };
    });
    return { player: row.player, name: row.name, points, path: smoothLinePath(points) };
  });
  const labelY = spreadLabels(
    lines.map((line) => line.points[line.points.length - 1]?.y ?? baseline),
    plot.y + 10,
    baseline - 10,
  );
  const painted = [...lines].sort(
    (a, b) => Number(selected === a.player) - Number(selected === b.player),
  );
  const selectedLine = lines.find((line) => line.player === selected);
  const selectedFill =
    selectedLine != null ? areaPath(selectedLine.path, selectedLine.points, baseline) : "";
  const modeLabel = mode === "round" ? "per round" : "cumulative";

  return (
    <div className="stats-timeline-plot">
      <div className="stats-timeline-canvas">
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
          <ChartDefs uid={uid} selected={selected} />
          {bands.map((band) => {
            const rect = bandRect(band, columns.length, plot);
            return (
              <g key={`${band.side}-${band.start}`}>
                <rect
                  className={`stats-timeline-band ${band.side === "CT" ? "ct" : "t"}`}
                  x={rect.x}
                  y={plot.y}
                  width={rect.width}
                  height={plot.height}
                />
                {showBandLabel(rect.width) ? (
                  <text className="stats-timeline-band-label" x={rect.x + 8} y={plot.y + 16}>
                    {band.side} SIDE
                  </text>
                ) : null}
              </g>
            );
          })}
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
          {columns.map((_, index) => {
            const x = roundX(index, columns.length, plot);
            return (
              <line
                key={`grid-${index}`}
                className="stats-timeline-grid"
                x1={x}
                y1={plot.y}
                x2={x}
                y2={baseline}
              />
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
              glow={`url(#${uid}-glow)`}
              soft={`url(#${uid}-soft)`}
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
            const row = column.rows.find((candidate) => candidate.player === reference);
            const x = roundX(index, columns.length, plot);
            const y = baseline + 26;
            const result = row?.won === true ? "win" : row?.won === false ? "loss" : "open";
            return (
              <g
                key={`round-${index}`}
                role="img"
                aria-label={`Round ${column.number}`}
                onPointerEnter={() => onHover(index)}
              >
                <circle
                  className={`stats-timeline-round ${result}`}
                  cx={x}
                  cy={y}
                  r={marker.radius}
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
        {lines.map((line, index) => {
          const point = line.points[line.points.length - 1];
          if (!point) return null;
          const on = selected === line.player;
          const color = playerColor(line.player);
          const labelX = plot.x + plot.width + 8;
          return (
            <button
              key={line.player}
              type="button"
              className={`stats-timeline-pill${on ? " is-on" : ""}${selected != null && !on ? " is-dim" : ""}`}
              style={{
                left: `${(labelX / layout.width) * 100}%`,
                top: `${((labelY[index] ?? point.y) / layout.height) * 100}%`,
                background: color,
                color: pillTextColor(color),
              }}
              aria-pressed={on}
              title={line.name}
              onClick={() => onSelect(line.player)}
            >
              {line.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartDefs({ uid, selected }: { uid: string; selected: number | null }) {
  return (
    <defs>
      <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="1.6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id={`${uid}-glow`} x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3.6" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {selected != null ? (
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={playerColor(selected)} stopOpacity="0.45" />
          <stop offset="100%" stopColor={playerColor(selected)} stopOpacity="0" />
        </linearGradient>
      ) : null}
    </defs>
  );
}

function LineShape({
  line,
  selected,
  glow,
  soft,
}: {
  line: LineSeries;
  selected: number | null;
  glow: string;
  soft: string;
}) {
  const on = selected === line.player;
  const dim = selected != null && !on;
  const color = playerColor(line.player);
  const point = line.points[0];
  if (line.points.length < 2 && point) {
    return (
      <circle
        className={`stats-timeline-line${on ? " is-on" : ""}${dim ? " is-dim" : ""}`}
        cx={point.x}
        cy={point.y}
        r={on ? 4.5 : 3.5}
        fill={color}
      />
    );
  }
  return (
    <path
      className={`stats-timeline-line${on ? " is-on" : ""}${dim ? " is-dim" : ""}`}
      d={line.path}
      stroke={color}
      strokeWidth={on ? 3.4 : 2.2}
      filter={on ? glow : dim ? undefined : soft}
    />
  );
}
