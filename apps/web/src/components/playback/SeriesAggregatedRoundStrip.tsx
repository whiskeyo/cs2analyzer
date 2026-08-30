import { memo, type CSSProperties } from "react";
import { GearIcon } from "@/components/weapons/WeaponIcon";
import { currentRound } from "@/lib/replay/sample";
import type { SeriesRoundChip, SeriesRoundsByKind } from "@/lib/parse/seriesAnalysis";
import type { HabitsTrail } from "@/lib/parse/seriesOverlay";
import type { Replay, Side } from "@/lib/replay/replayTypes";

interface Props {
  groups: SeriesRoundsByKind[];
  demoColors: Map<string, string>;
  activeDemoId: string | null;
  replay: Replay;
  tick: number;
  onJump: (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => void;
}

function SideBlock({
  side,
  rounds,
  groupLabel,
  demoColors,
  activeDemoId,
  liveRoundNumber,
  onJump,
}: {
  side: Side;
  rounds: SeriesRoundChip[];
  groupLabel: string;
  demoColors: Map<string, string>;
  activeDemoId: string | null;
  liveRoundNumber: number | null;
  onJump: Props["onJump"];
}) {
  if (rounds.length === 0) return null;
  const icon = side === "CT" ? "defuser" : "c4";
  return (
    <div className="series-round-side-group">
      <span className="series-round-side" aria-hidden="true">
        <GearIcon name={icon} title={side} />
      </span>
      {rounds.map((chip) => {
        const on =
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
            title={`${groupLabel} · ${chip.side} #${chip.indexInKind}`}
            onClick={() => onJump({ demoId: chip.demoId, jumpTick: chip.jumpTick })}
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
  replay,
  tick,
  onJump,
}: Props) {
  const live = currentRound(replay, tick);
  const liveRoundNumber = live != null && !live.is_knife ? live.number : null;

  return (
    <div className="series-round-strip" role="list">
      {groups.map((group) => {
        const ctRounds = group.rounds.filter((chip) => chip.side === "CT");
        const tRounds = group.rounds.filter((chip) => chip.side === "T");
        return (
          <div key={group.kind} className="series-round-row" role="listitem">
            <span className="series-round-label">{group.label}</span>
            <div className="series-round-chips" role="group" aria-label={`${group.label} rounds`}>
              <SideBlock
                side="CT"
                rounds={ctRounds}
                groupLabel={group.label}
                demoColors={demoColors}
                activeDemoId={activeDemoId}
                liveRoundNumber={liveRoundNumber}
                onJump={onJump}
              />
              {ctRounds.length > 0 && tRounds.length > 0 && (
                <span className="series-round-side-gap" aria-hidden="true" />
              )}
              <SideBlock
                side="T"
                rounds={tRounds}
                groupLabel={group.label}
                demoColors={demoColors}
                activeDemoId={activeDemoId}
                liveRoundNumber={liveRoundNumber}
                onJump={onJump}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
});
