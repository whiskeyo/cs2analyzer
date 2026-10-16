import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TimelineColumn, TimelineStatId } from "@/lib/stats/timeline";
import { formatTimelineValue, plottedValue, timelineStat } from "@/lib/stats/timeline";
import {
  AXIS_LABEL_PX,
  ROUND_LABEL_SLOT_PX,
  TIMELINE_LAYOUT,
  axisScale,
  economyBreakAfter,
  nearestRoundIndex,
  percentAxis,
  plotRect,
  roundLabelOrientation,
  roundX,
  smoothLinePath,
  snapAxisCoordinate,
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

/** `--text`. Axis ink is a fraction of this, blended solid onto the card. */
const TEXT_INK = "#e8eef4";
/** `.home-modal-card`. The plot is transparent, so this is the pixel behind a stroke. */
const CHART_SURFACE = "#12171d";
/** Round grid. Faint enough to sit behind the series. */
const GRID_INK = 0.08;
/** Half and overtime seams. Lighter than the round grid, still a hairline. */
const BREAK_INK = 0.5;
/** CSS pixels. `non-scaling-stroke` keeps this width when the viewBox is stretched. */
const AXIS_STROKE = 1;
const HOVER_DASH = "3 4";

function inkChannel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
}

/**
 * Opaque RGB. A translucent stroke stacks where two rules cross and leaves a dot.
 * The fraction matches the old alpha, blended on the modal card.
 */
function blendOnSurface(amount: number): string {
  const part = (index: number) =>
    Math.round(
      inkChannel(TEXT_INK, index) * amount + inkChannel(CHART_SURFACE, index) * (1 - amount),
    );
  return `#${[0, 1, 2].map((index) => part(index).toString(16).padStart(2, "0")).join("")}`;
}

const GRID_STROKE = blendOnSurface(GRID_INK);
const BREAK_STROKE = blendOnSurface(BREAK_INK);

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
  const hostRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [plotWidthPx, setPlotWidthPx] = useState(0);
  const [svgBox, setSvgBox] = useState({ left: 0, top: 0, width: 0, height: 0 });
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const fraction = plot.width / layout.width;
    const measure = () => {
      setPlotWidthPx(host.getBoundingClientRect().width * fraction);
      const box = svgRef.current?.getBoundingClientRect();
      const next = {
        left: box?.left ?? 0,
        top: box?.top ?? 0,
        width: box?.width ?? 0,
        height: box?.height ?? 0,
      };
      setSvgBox((prev) =>
        prev.left === next.left &&
        prev.top === next.top &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [layout.width, plot.width]);
  const snapX = (user: number) => snapAxisCoordinate(user, layout.width, svgBox.left, svgBox.width);
  const snapY = (user: number) =>
    snapAxisCoordinate(user, layout.height, svgBox.top, svgBox.height);
  const rows = columns[0]?.rows ?? [];
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
  const axisTop = snapY(plot.y);
  const axisBottom = snapY(baseline);
  const breakAfter = new Set(
    economyBreakAfter(
      columns.map((column) => ({
        number: column.number,
        players: column.rows
          .filter((row) => row.present)
          .map((row) => ({ player: row.player, side: row.side })),
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
  const labelOrientation = roundLabelOrientation(columns.length, plotWidthPx, ROUND_LABEL_SLOT_PX);

  return (
    <div className="stats-timeline-plot" ref={hostRef}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="none"
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
          const y = snapY(valueToY(tick, scale.max, plot));
          return (
            <AxisLine
              key={tick}
              className="stats-timeline-grid"
              stroke={GRID_STROKE}
              x1={plot.x}
              y1={y}
              x2={plot.x + plot.width}
              y2={y}
            />
          );
        })}
        {columns.map((column, index) => {
          const x = snapX(roundX(index, columns.length, plot));
          const next = columns[index + 1];
          const split =
            next && breakAfter.has(column.number)
              ? snapX(
                  (roundX(index, columns.length, plot) + roundX(index + 1, columns.length, plot)) /
                    2,
                )
              : null;
          return (
            <g key={`grid-${index}`}>
              <AxisLine
                className="stats-timeline-grid"
                stroke={GRID_STROKE}
                x1={x}
                y1={axisTop}
                x2={x}
                y2={axisBottom}
              />
              {split != null ? (
                <AxisLine
                  className="stats-timeline-break"
                  stroke={BREAK_STROKE}
                  x1={split}
                  y1={axisTop}
                  x2={split}
                  y2={axisBottom}
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
          <AxisLine
            className="stats-timeline-hover"
            stroke={BREAK_STROKE}
            dash={HOVER_DASH}
            x1={snapX(roundX(hover, columns.length, plot))}
            y1={axisTop}
            x2={snapX(roundX(hover, columns.length, plot))}
            y2={axisBottom}
          />
        ) : null}
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
      <div className="stats-timeline-labels">
        {scale.ticks.map((tick) => {
          const y = valueToY(tick, scale.max, plot);
          return (
            <span
              key={tick}
              className="stats-timeline-axis"
              style={{
                left: `${((plot.x - 8) / layout.width) * 100}%`,
                top: `${(y / layout.height) * 100}%`,
                fontSize: AXIS_LABEL_PX,
              }}
            >
              {formatTimelineValue(stat, tick)}
            </span>
          );
        })}
        {columns.map((column, index) => {
          const x = roundX(index, columns.length, plot);
          return (
            <span
              key={`round-${index}`}
              className={`stats-timeline-round-label${
                labelOrientation === "vertical" ? " is-vertical" : ""
              }`}
              role="img"
              aria-label={`Round ${column.number}`}
              style={{
                left: `${(x / layout.width) * 100}%`,
                top: `${((baseline + 16) / layout.height) * 100}%`,
                fontSize: AXIS_LABEL_PX,
              }}
              onPointerEnter={() => onHover(index)}
            >
              R{column.number}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Crisp stroke in CSS pixels. A viewBox stroke scales up and merges a long match. */
const LINE_STROKE = 0.9;
const HIGHLIGHT_STROKE = 1.6;

/** Axis-aligned rule. Width stays 1px on both axes of a stretched viewBox. */
function AxisLine({
  className,
  stroke,
  dash,
  x1,
  y1,
  x2,
  y2,
}: {
  className: string;
  stroke: string;
  dash?: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  return (
    <line
      className={className}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={stroke}
      strokeWidth={AXIS_STROKE}
      strokeDasharray={dash}
      vectorEffect="non-scaling-stroke"
      shapeRendering="crispEdges"
    />
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
