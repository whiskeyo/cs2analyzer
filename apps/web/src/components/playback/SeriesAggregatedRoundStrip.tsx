import { memo, type CSSProperties } from "react";
import { GearIcon } from "@/components/weapons/WeaponIcon";
import { roundKindLabel } from "@/lib/i18n/labels";
import { useMessages } from "@/lib/i18n/useMessages";
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
}: {
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
}) {
  const { messages, t } = useMessages();
  if (rounds.length === 0) return null;
  const icon = side === "CT" ? "defuser" : "c4";
  const bucketOn = bucketOverlay?.kind === kind && bucketOverlay.side === side;
  return (
    <div className="series-round-side-group">
      <span className="series-round-side" aria-hidden="true">
        <GearIcon name={icon} title={side} />
      </span>
      <button
        type="button"
        className={`rs series-round-chip bucket ${side === "CT" ? "ct" : "t"}${bucketOn ? " on" : ""}`}
        title={t(messages.playback.seriesBucketOverlay, { label: groupLabel, side })}
        onClick={() => onBucketOverlay(kind, side)}
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
        return (
          <button
            key={`${chip.demoId}-${chip.roundNumber}`}
            type="button"
            className={`rs series-round-chip ${chip.side === "CT" ? "ct" : "t"}${on ? " on" : ""}`}
            style={demoColor ? ({ "--demo-color": demoColor } as CSSProperties) : undefined}
            title={t(messages.playback.seriesRoundChip, {
              label: groupLabel,
              side: chip.side,
              index: chip.indexInKind,
            })}
            onClick={() => onRoundJump({ demoId: chip.demoId, jumpTick: chip.jumpTick })}
          >
            {chip.indexInKind}
          </button>
        );
      })}
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
}: Props) {
  const { messages, t } = useMessages();
  const live = currentRound(replay, tick);
  const liveRoundNumber = live != null && !live.is_knife ? live.number : null;

  return (
    <div className="series-round-strip" role="list">
      {groups.map((group) => {
        const label = roundKindLabel(messages, group.kind);
        const ctRounds = group.rounds.filter((chip) => chip.side === "CT");
        const tRounds = group.rounds.filter((chip) => chip.side === "T");
        return (
          <div key={group.kind} className="series-round-row" role="listitem">
            <span className="series-round-label">{label}</span>
            <div
              className="series-round-chips"
              role="group"
              aria-label={t(messages.playback.seriesRoundsGroup, { label })}
            >
              <SideBlock
                kind={group.kind}
                side="CT"
                rounds={ctRounds}
                groupLabel={label}
                demoColors={demoColors}
                activeDemoId={activeDemoId}
                liveRoundNumber={liveRoundNumber}
                bucketOverlay={bucketOverlay}
                onBucketOverlay={onBucketOverlay}
                onRoundJump={onRoundJump}
              />
              {ctRounds.length > 0 && tRounds.length > 0 && (
                <span className="series-round-side-gap" aria-hidden="true" />
              )}
              <SideBlock
                kind={group.kind}
                side="T"
                rounds={tRounds}
                groupLabel={label}
                demoColors={demoColors}
                activeDemoId={activeDemoId}
                liveRoundNumber={liveRoundNumber}
                bucketOverlay={bucketOverlay}
                onBucketOverlay={onBucketOverlay}
                onRoundJump={onRoundJump}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});
