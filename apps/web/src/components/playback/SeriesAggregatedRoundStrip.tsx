import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { GearIcon } from "@/components/weapons/WeaponIcon";
import {
  aggregatedRoundRowNeededWidth,
  aggregatedRoundRowShouldSplit,
  aggregatedStripFrame,
  aggregatedStripMaxHeight,
} from "@/lib/playback/aggregatedRoundRowSplit";
import { currentRound } from "@/lib/replay/sample";
import type { SeriesRoundChip, SeriesRoundsByKind } from "@/lib/parse/seriesAnalysis";
import type { BucketOverlaySelection } from "@/lib/state/useSeriesHabits";
import type { HabitsTrail } from "@/lib/parse/seriesOverlay";
import type { RoundKind } from "@/lib/parse/roundTags";
import type { Replay, Side } from "@/lib/replay/replayTypes";

interface Props {
  groups: SeriesRoundsByKind[];
  demoColors: Map<string, string>;
  activeDemoId: string | null;
  bucketOverlay: BucketOverlaySelection | null;
  replay: Replay;
  tick: number;
  onBucketOverlay: (kind: RoundKind, side: Side) => void;
  onRoundJump: (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => void;
  bucketEnabled?: (kind: RoundKind) => boolean;
  roundJumpEnabled?: boolean;
}

interface SideBlockProps {
  kind: RoundKind;
  side: Side;
  rounds: SeriesRoundChip[];
  groupLabel: string;
  demoColors: Map<string, string>;
  activeDemoId: string | null;
  liveRoundNumber: number | null;
  bucketOverlay: BucketOverlaySelection | null;
  onBucketOverlay: Props["onBucketOverlay"];
  onRoundJump: Props["onRoundJump"];
  bucketEnabled?: (kind: RoundKind) => boolean;
  roundJumpEnabled?: boolean;
  /** Width mirror. Same chips, no titles or clicks, so the visible row stays unique. */
  measure?: boolean;
}

function rowContentKey(group: SeriesRoundsByKind): string {
  return group.rounds.map((chip) => `${chip.side}${chip.indexInKind}`).join(".");
}

/** Compare a hidden nowrap copy to the track so the split choice does not feed itself. */
function useAggregatedRoundRowSplit(contentKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    const apply = () => {
      const needed = aggregatedRoundRowNeededWidth(measure);
      const available = container.clientWidth;
      setSplit((current) => aggregatedRoundRowShouldSplit(needed, available, current));
    };

    apply();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(apply);
    observer.observe(container);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [contentKey]);

  return { containerRef, measureRef, split };
}

function SideBlock({
  kind,
  side,
  rounds,
  groupLabel,
  demoColors,
  activeDemoId,
  liveRoundNumber,
  bucketOverlay,
  onBucketOverlay,
  onRoundJump,
  bucketEnabled,
  roundJumpEnabled = true,
  measure = false,
}: SideBlockProps) {
  if (rounds.length === 0) return null;
  const icon = side === "CT" ? "defuser" : "c4";
  const bucketOn = bucketOverlay?.kind === kind && bucketOverlay.side === side;
  const bucketLive = bucketEnabled?.(kind) ?? true;
  const bucketTitle = bucketLive
    ? `${groupLabel} · ${side} · all rounds overlay`
    : `${groupLabel} · ${side} · not playable in the tutorial`;
  return (
    <div className="series-round-side-group">
      <span className="series-round-side" aria-hidden="true">
        <GearIcon name={icon} title={measure ? undefined : side} />
      </span>
      <div className="series-round-side-chips">
        <button
          type="button"
          tabIndex={measure ? -1 : undefined}
          className={`rs series-round-chip bucket ${side === "CT" ? "ct" : "t"}${bucketOn ? " on" : ""}${bucketLive ? "" : " is-inactive"}`}
          title={measure ? undefined : bucketTitle}
          disabled={!bucketLive}
          onClick={measure ? undefined : () => onBucketOverlay(kind, side)}
        >
          A
        </button>
        {rounds.map((chip) => {
          const on =
            !bucketOn &&
            activeDemoId === chip.demoId &&
            liveRoundNumber != null &&
            liveRoundNumber === chip.roundNumber;
          const demoColor = demoColors.get(chip.demoId);
          const chipTitle = roundJumpEnabled
            ? `${groupLabel} · ${chip.side} #${chip.indexInKind}`
            : `${groupLabel} · ${chip.side} #${chip.indexInKind} · not playable in the tutorial`;
          return (
            <button
              key={`${chip.demoId}-${chip.roundNumber}`}
              type="button"
              tabIndex={measure ? -1 : undefined}
              className={`rs series-round-chip ${chip.side === "CT" ? "ct" : "t"}${on ? " on" : ""}${roundJumpEnabled ? "" : " is-inactive"}`}
              style={demoColor ? ({ "--demo-color": demoColor } as CSSProperties) : undefined}
              title={measure ? undefined : chipTitle}
              disabled={!roundJumpEnabled}
              onClick={
                measure
                  ? undefined
                  : () => onRoundJump({ demoId: chip.demoId, jumpTick: chip.jumpTick })
              }
            >
              {chip.indexInKind}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UnsplitSides({
  ctRounds,
  tRounds,
  measure,
  block,
}: {
  ctRounds: SeriesRoundChip[];
  tRounds: SeriesRoundChip[];
  measure: boolean;
  block: (side: Side, rounds: SeriesRoundChip[], measure: boolean) => ReactNode;
}) {
  return (
    <>
      {block("CT", ctRounds, measure)}
      {ctRounds.length > 0 && tRounds.length > 0 ? (
        <span className="series-round-side-gap" aria-hidden="true" />
      ) : null}
      {block("T", tRounds, measure)}
    </>
  );
}

function SeriesRoundRow({
  group,
  liveRoundNumber,
  demoColors,
  activeDemoId,
  bucketOverlay,
  onBucketOverlay,
  onRoundJump,
  bucketEnabled,
  roundJumpEnabled,
  mirror = false,
}: {
  group: SeriesRoundsByKind;
  liveRoundNumber: number | null;
  demoColors: Map<string, string>;
  activeDemoId: string | null;
  bucketOverlay: BucketOverlaySelection | null;
  onBucketOverlay: Props["onBucketOverlay"];
  onRoundJump: Props["onRoundJump"];
  bucketEnabled?: (kind: RoundKind) => boolean;
  roundJumpEnabled: boolean;
  /** Full-stage height probe. Same boxes, no labels or titles. */
  mirror?: boolean;
}) {
  const ctRounds = group.rounds.filter((chip) => chip.side === "CT");
  const tRounds = group.rounds.filter((chip) => chip.side === "T");
  const { containerRef, measureRef, split } = useAggregatedRoundRowSplit(rowContentKey(group));

  const block = (side: Side, rounds: SeriesRoundChip[], measure: boolean) => (
    <SideBlock
      measure={measure}
      kind={group.kind}
      side={side}
      rounds={rounds}
      groupLabel={group.label}
      demoColors={demoColors}
      activeDemoId={activeDemoId}
      liveRoundNumber={liveRoundNumber}
      bucketOverlay={bucketOverlay}
      onBucketOverlay={onBucketOverlay}
      onRoundJump={onRoundJump}
      bucketEnabled={bucketEnabled}
      roundJumpEnabled={roundJumpEnabled}
    />
  );

  return (
    <div
      className={`series-round-row${split ? " is-split" : ""}`}
      role={mirror ? undefined : "listitem"}
    >
      <span className="series-round-label">{mirror ? "\u00a0" : group.label}</span>
      <div
        ref={containerRef}
        className={`series-round-chips${split ? " is-split" : ""}`}
        role={mirror ? undefined : "group"}
        aria-label={mirror ? undefined : `${group.label} rounds`}
        data-split={split ? "true" : "false"}
      >
        {split ? (
          <>
            {ctRounds.length > 0 ? (
              <div className="series-round-line" data-side="CT">
                {block("CT", ctRounds, mirror)}
              </div>
            ) : null}
            {tRounds.length > 0 ? (
              <div className="series-round-line" data-side="T">
                {block("T", tRounds, mirror)}
              </div>
            ) : null}
          </>
        ) : (
          <UnsplitSides ctRounds={ctRounds} tRounds={tRounds} measure={mirror} block={block} />
        )}
        <div className="series-round-measure-host" aria-hidden="true">
          <div className="series-round-measure" data-measure="" ref={measureRef}>
            <UnsplitSides ctRounds={ctRounds} tRounds={tRounds} measure block={block} />
          </div>
        </div>
      </div>
    </div>
  );
}

function rowListKey(groups: SeriesRoundsByKind[]): string {
  return groups.map((group) => rowContentKey(group)).join("|");
}

/** Wait until a flick settles, then rest on a whole-row window. */
const STRIP_SNAP_IDLE_MS = 80;
/** Ignore subpixel leftovers when resting the scroll. */
const STRIP_SNAP_SLOP_PX = 1;

function rowEdges(strip: HTMLElement): { tops: number[]; bottoms: number[] } {
  const stripRect = strip.getBoundingClientRect();
  const tops: number[] = [];
  const bottoms: number[] = [];
  for (const node of strip.querySelectorAll(":scope > .series-round-row")) {
    if (!(node instanceof HTMLElement)) continue;
    const rect = node.getBoundingClientRect();
    tops.push(rect.top - stripRect.top + strip.scrollTop);
    bottoms.push(rect.bottom - stripRect.top + strip.scrollTop);
  }
  return { tops, bottoms };
}

function paddingBottomPx(strip: HTMLElement): number {
  const parsed = Number.parseFloat(getComputedStyle(strip).paddingBottom);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Cap the visible strip at the height those chips have across the whole stage. */
function useFullStageStripCap(contentKey: string) {
  const stripRef = useRef<HTMLDivElement>(null);
  const sizerRef = useRef<HTMLDivElement>(null);
  const snapOffsetsRef = useRef<number[]>([0]);

  useLayoutEffect(() => {
    const strip = stripRef.current;
    const sizer = sizerRef.current;
    const stage = strip?.closest(".stage");
    if (!strip || !sizer || !(stage instanceof HTMLElement)) return;

    const apply = () => {
      if (stage.clientWidth <= 0) return;
      sizer.style.width = `${stage.clientWidth}px`;
      const cap = aggregatedStripMaxHeight(sizer.getBoundingClientRect().height);
      if (cap == null) {
        strip.style.removeProperty("--series-strip-cap");
        strip.style.removeProperty("--series-strip-tail");
        strip.classList.remove("is-overflowing");
        snapOffsetsRef.current = [0];
        return;
      }
      const { tops, bottoms } = rowEdges(strip);
      const contentEnd = (bottoms[bottoms.length - 1] ?? 0) + paddingBottomPx(strip);
      const frame = aggregatedStripFrame({ cap, rowTops: tops, rowBottoms: bottoms, contentEnd });
      if (frame == null) return;
      strip.style.setProperty("--series-strip-cap", `${frame.height}px`);
      strip.style.setProperty("--series-strip-tail", `${frame.tail}px`);
      strip.classList.toggle("is-overflowing", frame.scrolls);
      snapOffsetsRef.current = frame.snapOffsets;
    };

    apply();
    let snapTimer = 0;
    const onScroll = () => {
      window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => {
        const points = snapOffsetsRef.current;
        if (points.length === 0) return;
        const top = strip.scrollTop;
        const nearest = points.reduce((best, point) =>
          Math.abs(point - top) < Math.abs(best - top) ? point : best,
        );
        if (Math.abs(nearest - top) > STRIP_SNAP_SLOP_PX) strip.scrollTop = nearest;
      }, STRIP_SNAP_IDLE_MS);
    };
    strip.addEventListener("scroll", onScroll, { passive: true });

    if (typeof ResizeObserver === "undefined") {
      return () => {
        window.clearTimeout(snapTimer);
        strip.removeEventListener("scroll", onScroll);
      };
    }
    const observer = new ResizeObserver(apply);
    observer.observe(stage);
    observer.observe(sizer);
    observer.observe(strip);
    for (const node of strip.querySelectorAll(":scope > .series-round-row")) observer.observe(node);
    return () => {
      window.clearTimeout(snapTimer);
      strip.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [contentKey]);

  return { stripRef, sizerRef };
}

/** Series-wide round picker grouped by buy type (replaces per-demo round strip). */
export const SeriesAggregatedRoundStrip = memo(function SeriesAggregatedRoundStrip({
  groups,
  demoColors,
  activeDemoId,
  bucketOverlay,
  replay,
  tick,
  onBucketOverlay,
  onRoundJump,
  bucketEnabled,
  roundJumpEnabled = true,
}: Props) {
  const live = currentRound(replay, tick);
  const liveRoundNumber = live != null && !live.is_knife ? live.number : null;
  const { stripRef, sizerRef } = useFullStageStripCap(rowListKey(groups));
  const renderRows = (mirror: boolean) =>
    groups.map((group) => (
      <SeriesRoundRow
        key={group.kind}
        mirror={mirror}
        group={group}
        liveRoundNumber={liveRoundNumber}
        demoColors={demoColors}
        activeDemoId={activeDemoId}
        bucketOverlay={bucketOverlay}
        onBucketOverlay={onBucketOverlay}
        onRoundJump={onRoundJump}
        bucketEnabled={bucketEnabled}
        roundJumpEnabled={roundJumpEnabled}
      />
    ));

  return (
    <>
      <div ref={stripRef} className="series-round-strip" role="list" data-tutorial="rounds">
        {renderRows(false)}
        <div className="series-round-scroll-tail" aria-hidden="true" />
      </div>
      <div ref={sizerRef} className="series-round-sizer" aria-hidden="true" inert>
        {renderRows(true)}
      </div>
    </>
  );
});
