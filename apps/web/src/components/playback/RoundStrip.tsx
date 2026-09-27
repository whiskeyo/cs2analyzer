import { memo, useEffect, useMemo, useState } from "react";
import { GearIcon } from "@/components/weapons/WeaponIcon";
import {
  ECONOMY_BUY_LABEL,
  SIDE_DISPLAY_ORDER,
  bySide,
  roundSideBuys,
  roundTeamName,
  type EconomyBuy,
} from "@/lib/match/economy";
import { activeExecute, findExecutes, type ExecuteBeat } from "@/lib/match/execute";
import type { MapPlaces } from "@/lib/match/sites";
import { noteRounds } from "@/lib/notes";
import type { RoundNote } from "@/lib/notes/types";
import { useSendPlaybackCommand } from "@/lib/playback/playbackCommandContext";
import { blockTransportFocus } from "@/lib/playback/transportFocus";
import { currentRound } from "@/lib/replay/sample";
import type { Replay, Round, Side } from "@/lib/replay/replayTypes";
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
        const title = roundChipLabel(replay, r, sides, hasAction, hasNotes, enabled);
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
            title={title}
            aria-label={title}
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
                {SIDE_DISPLAY_ORDER.map((side) => {
                  const buy = sides == null ? null : bySide(sides, side);
                  return (
                    <span
                      key={side}
                      className={`round-buy ${side === "CT" ? "ct" : "t"}`}
                      data-buy={buy ?? "none"}
                    >
                      <SideBuyIcon buy={buy} />
                    </span>
                  );
                })}
              </span>
            )}
            {r.is_knife ? "K" : r.number}
          </button>
        );
      })}
    </div>
  );
});

function roundChipLabel(
  replay: Replay,
  round: Round,
  sides: { ct: EconomyBuy | null; t: EconomyBuy | null } | null,
  hasAction: boolean,
  hasNotes: boolean,
  enabled = true,
): string {
  const parts = [round.is_knife ? "Knife" : `Round ${round.number}`];
  if (sides) {
    for (const side of SIDE_DISPLAY_ORDER) {
      const buy = bySide(sides, side);
      parts.push(sideBuyPhrase(side, roundTeamName(replay, round, side), buy));
    }
  }
  if (hasAction) parts.push("execute");
  if (hasNotes) parts.push("notes");
  const title = parts.join(" · ");
  return enabled ? title : `${title} · not playable in the tutorial`;
}

function sideBuyPhrase(side: Side, team: string, buy: EconomyBuy | null): string {
  const word = buy ? ECONOMY_BUY_LABEL[buy] : "No buy";
  const name = team.trim();
  if (name === "" || name.toUpperCase() === side) return `${side} ${word}`;
  return `${side} ${name} ${word}`;
}
