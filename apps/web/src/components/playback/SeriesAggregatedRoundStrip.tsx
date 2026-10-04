import { memo, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { GearIcon } from "@/components/weapons/WeaponIcon";
import {
  aggregatedRoundRowNeededWidth,
  aggregatedRoundRowShouldSplit,
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
    <div className={`series-round-row${split ? " is-split" : ""}`} role="listitem">
      <span className="series-round-label">{group.label}</span>
      <div
        ref={containerRef}
        className={`series-round-chips${split ? " is-split" : ""}`}
        role="group"
        aria-label={`${group.label} rounds`}
        data-split={split ? "true" : "false"}
      >
        {split ? (
          <>
            {ctRounds.length > 0 ? (
              <div className="series-round-line" data-side="CT">
                {block("CT", ctRounds, false)}
              </div>
            ) : null}
            {tRounds.length > 0 ? (
              <div className="series-round-line" data-side="T">
                {block("T", tRounds, false)}
              </div>
            ) : null}
          </>
        ) : (
          <UnsplitSides ctRounds={ctRounds} tRounds={tRounds} measure={false} block={block} />
        )}
        <div className="series-round-measure" data-measure="" ref={measureRef} aria-hidden="true">
          <UnsplitSides ctRounds={ctRounds} tRounds={tRounds} measure block={block} />
        </div>
      </div>
    </div>
  );
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

  return (
    <div className="series-round-strip" role="list" data-tutorial="rounds">
      {groups.map((group) => (
        <SeriesRoundRow
          key={group.kind}
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
      ))}
    </div>
  );
});
