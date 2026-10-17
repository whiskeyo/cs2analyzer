import { useMemo, useRef } from "react";
import type { MatchInfo } from "@/lib/replay/replayTypes";
import type { TimelineColumn, TimelineStatId } from "@/lib/stats/timeline";
import { formatTimelineValue, plottedValue, timelineStat } from "@/lib/stats/timeline";
import {
  AXIS_LABEL_PX,
  ROUND_LABEL_SLOT_PX,
  TIMELINE_LAYOUT,
  axisScale,
  axisTopPadPx,
  economyBreakAfter,
  timelineColumnRosters,
  nearestRoundIndex,
  percentAxis,
  plotRect,
  roundLabelBand,
  roundLabelOrientation,
  roundLabelTopPx,
  roundX,
  smoothLinePath,
  axisPixel,
  axisStrokeWidth,
  timelineLayoutForHeight,
  valueToY,
  type PlotRect,
  type TimelinePoint,
} from "@/lib/stats/timelineChart";
import { useTimelinePlotBox } from "./useTimelinePlotBox";

interface Props {
  columns: TimelineColumn[];
  stat: TimelineStatId;
  colors: readonly string[];
  selected: number | null;
  hover: number | null;
  onSelect: (player: number) => void;
  onHover: (index: number | null) => void;
  /** Parsed convars. Half and overtime lines use `mp_maxrounds` from here. */
  matchInfo?: MatchInfo;
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
const HOVER_DASH = "3 4";

function inkChannel(hex: string, index: number): number {
  return Number.parseInt(hex.slice(1 + index * 2, 3 + index * 2), 16);
}

/**
 * Opaque RGB. A translucent stroke stacks where two rules cross and leaves a dot.
 * The fraction matches the old alpha, blended on the modal card.
 */
function blendOnSurface(amount: number): string {
  const channel = (index: number) =>
    Math.round(
      inkChannel(TEXT_INK, index) * amount + inkChannel(CHART_SURFACE, index) * (1 - amount),
    );
  return `#${[0, 1, 2].map((index) => channel(index).toString(16).padStart(2, "0")).join("")}`;
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
  matchInfo,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const basePlot = plotRect();
  const { plotWidthPx, box: pixelSize } = useTimelinePlotBox(
    hostRef,
    overlayRef,
    basePlot.width / TIMELINE_LAYOUT.width,
  );
  const labelOrientation = roundLabelOrientation(columns.length, plotWidthPx, ROUND_LABEL_SLOT_PX);
  const layout = timelineLayoutForHeight(
    pixelSize.height,
    TIMELINE_LAYOUT,
    roundLabelBand(labelOrientation, pixelSize.dpr),
    axisTopPadPx(pixelSize.dpr),
  );
  const plot = plotRect(layout);
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
  const baselineCss = axisPixel(
    baseline,
    layout.height,
    pixelSize.height,
    pixelSize.dpr,
    pixelSize.top,
  );
  const labelTop = `${roundLabelTopPx(baselineCss, pixelSize.dpr)}px`;
  const breakAfter = new Set(economyBreakAfter(timelineColumnRosters(columns), matchInfo));
  const lines: LineSeries[] = rows.map((row) => {
    const points = columns.map((column, index) => {
      const sample = column.rows.find((candidate) => candidate.player === row.player);
      const value = sample ? plottedValue(sample.values[stat]) : 0;
      return {
        x: roundX(index, columns.length, plot),
        y: valueToY(value, scale.max, plot),
      };
    });
    return {
      player: row.player,
      name: row.name,
      points,
      path: smoothLinePath(points),
    };
  });
  const painted = [...lines].sort(
    (a, b) => Number(selected === a.player) - Number(selected === b.player),
  );

  return (
    <div className="stats-timeline-plot" ref={hostRef}>
      <AxisOverlay
        overlayRef={overlayRef}
        box={pixelSize}
        layout={layout}
        plot={plot}
        baseline={baseline}
        ticks={scale.ticks}
        tickY={(tick) => valueToY(tick, scale.max, plot)}
        columns={columns}
        breakAfter={breakAfter}
        hover={hover}
      />
      <svg
        className="stats-timeline-series"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="none"
        role="group"
        aria-label={`${timelineStat(stat).label} cumulative`}
        onPointerMove={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (bounds.width <= 0) return;
          const x = ((event.clientX - bounds.left) / bounds.width) * layout.width;
          const index = nearestRoundIndex(x, columns.length, plot);
          if (index >= 0) onHover(index);
        }}
      >
        {painted.map((line) => (
          <LineShape
            key={line.player}
            line={line}
            selected={selected}
            color={colors[line.player] ?? "#d0d6dc"}
          />
        ))}
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
                top: labelTop,
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

/**
 * Grid, seams, and the hover guide. The viewBox is this SVG's CSS pixel size
 * (`preserveAspectRatio="none"`, so a fractional box cannot letterbox). Rules
 * snap against the overlay's screen origin. Round rules are keyed by index.
 * The hover guide is its own SVG. Player lines stay in the stretched series SVG.
 */
function AxisOverlay({
  overlayRef,
  box,
  layout,
  plot,
  baseline,
  ticks,
  tickY,
  columns,
  breakAfter,
  hover,
}: {
  overlayRef: { current: SVGSVGElement | null };
  box: {
    width: number;
    height: number;
    left: number;
    top: number;
    dpr: number;
  };
  layout: { width: number; height: number };
  plot: PlotRect;
  baseline: number;
  ticks: readonly number[];
  tickY: (tick: number) => number;
  columns: readonly TimelineColumn[];
  breakAfter: ReadonlySet<number>;
  hover: number | null;
}) {
  const { width, height, left: originX, top: originY, dpr } = box;
  if (!(width > 0) || !(height > 0)) return null;
  const strokeWidth = axisStrokeWidth(dpr);
  const x = (user: number) => axisPixel(user, layout.width, width, dpr, originX);
  const y = (user: number) => axisPixel(user, layout.height, height, dpr, originY);
  const top = y(plot.y);
  const bottom = y(baseline);
  const left = x(plot.x);
  const right = x(plot.x + plot.width);
  const frame = {
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "none" as const,
    "aria-hidden": true as const,
  };
  const hoverIndex = hover != null && columns[hover] ? hover : null;
  const hoverX = hoverIndex != null ? x(roundX(hoverIndex, columns.length, plot)) : null;
  return (
    <>
      <svg ref={overlayRef} className="stats-timeline-axis-svg" {...frame}>
        {ticks.map((tick) => {
          const lineY = y(tickY(tick));
          return (
            <AxisLine
              key={tick}
              className="stats-timeline-grid"
              stroke={GRID_STROKE}
              strokeWidth={strokeWidth}
              x1={left}
              y1={lineY}
              x2={right}
              y2={lineY}
            />
          );
        })}
        {columns.map((column, index) => {
          const userX = roundX(index, columns.length, plot);
          const lineX = x(userX);
          const next = index + 1 < columns.length && breakAfter.has(column.number);
          const seam = next ? x((userX + roundX(index + 1, columns.length, plot)) / 2) : null;
          return (
            <g key={`round-${index}`}>
              <AxisLine
                className="stats-timeline-grid"
                stroke={GRID_STROKE}
                strokeWidth={strokeWidth}
                x1={lineX}
                y1={top}
                x2={lineX}
                y2={bottom}
              />
              {seam != null ? (
                <AxisLine
                  className="stats-timeline-break"
                  stroke={BREAK_STROKE}
                  strokeWidth={strokeWidth}
                  x1={seam}
                  y1={top}
                  x2={seam}
                  y2={bottom}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      {hoverX != null ? (
        <svg className="stats-timeline-axis-svg stats-timeline-hover-svg" {...frame}>
          <AxisLine
            key="hover"
            className="stats-timeline-hover"
            stroke={BREAK_STROKE}
            strokeWidth={strokeWidth}
            dash={HOVER_DASH}
            x1={hoverX}
            y1={top}
            x2={hoverX}
            y2={bottom}
          />
        </svg>
      ) : null}
    </>
  );
}

/** Axis-aligned rule in the pixel overlay. Opaque, and a whole number of device pixels. */
function AxisLine({
  className,
  stroke,
  strokeWidth,
  dash,
  x1,
  y1,
  x2,
  y2,
}: {
  className: string;
  stroke: string;
  strokeWidth: number;
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
      strokeWidth={strokeWidth}
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
