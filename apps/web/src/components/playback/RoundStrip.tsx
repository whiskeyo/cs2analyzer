import { memo, useEffect, useMemo, useState } from "react";
import { GearIcon } from "@/components/weapons/WeaponIcon";
import { ECONOMY_BUY_LABEL, roundSideBuys, type EconomyBuy } from "@/lib/match/economy";
import { activeExecute, findExecutes, type ExecuteBeat } from "@/lib/match/execute";
import type { MapPlaces } from "@/lib/match/sites";
import { noteRounds } from "@/lib/notes";
import type { RoundNote } from "@/lib/notes/types";
import { useSendPlaybackCommand } from "@/lib/playback/playbackCommandContext";
import { blockTransportFocus } from "@/lib/playback/transportFocus";
import { currentRound } from "@/lib/replay/sample";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import { tickRate } from "@/lib/shared/constants";
import { SideBuyIcon } from "./SideBuyIcon";

interface Props {
  replay: Replay;
  tick: number;
  notes: RoundNote[];
  places: MapPlaces | null;
  activeRound?: Round | null;
  /** Tutorial series greys unused rounds; omitted = every chip stays clickable. */
  roundEnabled?: (round: Round) => boolean;
}

export const RoundStrip = memo(function RoundStrip({
  replay,
  tick,
  notes,
  places,
  activeRound,
  roundEnabled,
}: Props) {
  const send = useSendPlaybackCommand();
  const current = activeRound ?? currentRound(replay, tick);
  const [beats, setBeats] = useState<ExecuteBeat[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) setBeats(findExecutes(replay, places));
    };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run);
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    const id = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [replay, places]);

  const actionRounds = new Set(beats.map((b) => b.round));
  const noted = noteRounds(notes);
  const live = activeExecute(beats, tick, tickRate(replay));
  const buys = useMemo(
    () => replay.rounds.map((round) => (round.is_knife ? null : roundSideBuys(replay, round))),
    [replay],
  );
  return (
    <div className="round-strip" role="list">
      {replay.rounds.map((r, index) => {
        const hasAction = !r.is_knife && actionRounds.has(r.number);
        const hasNotes = noted.has(r.number);
        const liveAction = live != null && live.round === r.number;
        const enabled = roundEnabled?.(r) ?? true;
        const sides = buys[index] ?? null;
        const title = roundChipTitle(r, sides, hasAction, hasNotes);
        return (
          <button
            key={r.start_tick}
            type="button"
            tabIndex={-1}
            role="listitem"
            disabled={!enabled}
            className={`rs${current?.start_tick === r.start_tick ? " on" : ""}${hasAction ? " has-action" : ""}${hasNotes ? " has-notes" : ""}${liveAction ? " live-action" : ""}${enabled ? "" : " is-inactive"} ${
              r.winner === "CT" ? "ct" : r.winner === "T" ? "t" : "none"
            }`}
            title={enabled ? title : `${title} · not playable in the tutorial`}
            onMouseDown={blockTransportFocus}
            onClick={() => {
              if (!enabled) return;
              send({ type: "jump", tick: 0, pause: true, round: r });
            }}
          >
            {r.is_knife ? (
              <span className="round-buys is-knife" aria-hidden="true">
                <GearIcon name="knife" title="" className="round-buy-knife" />
              </span>
            ) : (
              <span className="round-buys" aria-hidden="true">
                <span className="round-buy ct" data-buy={sides?.ct ?? "none"}>
                  <SideBuyIcon buy={sides?.ct ?? null} />
                </span>
                <span className="round-buy t" data-buy={sides?.t ?? "none"}>
                  <SideBuyIcon buy={sides?.t ?? null} />
                </span>
              </span>
            )}
            {r.is_knife ? "K" : r.number}
          </button>
        );
      })}
    </div>
  );
});

function roundChipTitle(
  round: Round,
  sides: { ct: EconomyBuy | null; t: EconomyBuy | null } | null,
  hasAction: boolean,
  hasNotes: boolean,
): string {
  const parts = [round.is_knife ? "Knife" : `Round ${round.number}`];
  if (sides) {
    parts.push(`CT ${buyWord(sides.ct)}`, `T ${buyWord(sides.t)}`);
  }
  if (hasAction) parts.push("execute");
  if (hasNotes) parts.push("notes");
  return parts.join(" · ");
}

function buyWord(buy: EconomyBuy | null): string {
  return buy ? ECONOMY_BUY_LABEL[buy].toLowerCase() : "no buy";
}
