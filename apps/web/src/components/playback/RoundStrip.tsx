import { memo, useEffect, useMemo, useState } from "react";
import { GearIcon } from "@/components/weapons/WeaponIcon";
import type { Messages } from "@/lib/i18n/messages";
import { translate } from "@/lib/i18n/translate";
import { useMessages } from "@/lib/i18n/useMessages";
import {
  SIDE_DISPLAY_ORDER,
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
  const { messages } = useMessages();
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
        const title = roundChipLabel(messages, replay, r, sides, hasAction, hasNotes, enabled);
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
                  const buy = side === "CT" ? (sides?.ct ?? null) : (sides?.t ?? null);
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

export function roundChipLabel(
  messages: Messages,
  replay: Replay,
  round: Round,
  sides: { ct: EconomyBuy | null; t: EconomyBuy | null } | null,
  hasAction: boolean,
  hasNotes: boolean,
  enabled = true,
): string {
  const copy = messages.roundStrip;
  const parts = [round.is_knife ? copy.knife : translate(copy.round, { number: round.number })];
  if (sides) {
    for (const side of SIDE_DISPLAY_ORDER) {
      const buy = side === "CT" ? sides.ct : sides.t;
      parts.push(sideBuyPhrase(messages, side, roundTeamName(replay, round, side), buy));
    }
  }
  if (hasAction) parts.push(copy.execute);
  if (hasNotes) parts.push(copy.notes);
  const title = parts.join(" · ");
  return enabled ? title : `${title} · ${copy.tutorialInactive}`;
}

function sideBuyPhrase(
  messages: Messages,
  side: Side,
  team: string,
  buy: EconomyBuy | null,
): string {
  const copy = messages.roundStrip;
  const word = buyWord(messages, buy);
  const name = team.trim();
  if (name === "" || name.toUpperCase() === side) {
    return translate(copy.sideBuy, { side, buy: word });
  }
  return translate(copy.sideTeamBuy, { side, team: name, buy: word });
}

function buyWord(messages: Messages, buy: EconomyBuy | null): string {
  const copy = messages.roundStrip;
  if (buy === "pistol") return copy.pistol;
  if (buy === "eco") return copy.eco;
  if (buy === "force") return copy.force;
  if (buy === "anti-eco") return copy.antiEco;
  if (buy === "full") return copy.full;
  return copy.noBuy;
}
