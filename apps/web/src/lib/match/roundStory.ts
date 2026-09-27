import {
  WIN_REASON_BOMB,
  WIN_REASON_CT_ELIM,
  WIN_REASON_DEFUSE,
  WIN_REASON_TIME,
  WIN_REASON_T_ELIM,
} from "@/lib/shared/constants";
import { isEnemyKill } from "@/lib/stats/stats";
import type { Replay, Round, Side } from "@/lib/replay/replayTypes";
import { winReasonLabel } from "@/lib/weapons/weapons";
import { ECONOMY_BUY_LABEL, roundSideBuys, type EconomyBuy } from "./economy";

export type BuyLevel = EconomyBuy;

export interface RoundStory {
  round: number;
  roundLabel: string;
  jumpTick: number;
  winner: Side | null;
  tBuy: BuyLevel | null;
  ctBuy: BuyLevel | null;
  opener: { name: string; vs: string; tick: number } | null;
  ending: string;
  planted: boolean;
  ace: boolean;
  summary: string;
}

function roundLabel(r: Round): string {
  return r.is_knife ? "Knife" : `R${r.number}`;
}

function inRound(r: Round, tick: number): boolean {
  return tick >= r.start_tick && tick <= r.end_tick;
}

function endingOf(r: Round, planted: boolean, ace: boolean): string {
  if (ace && (r.win_reason === WIN_REASON_CT_ELIM || r.win_reason === WIN_REASON_T_ELIM))
    return "ace";
  if (r.win_reason === WIN_REASON_BOMB) return "bomb";
  if (r.win_reason === WIN_REASON_DEFUSE) return planted ? "defuse" : "defuse";
  if (r.win_reason === WIN_REASON_TIME) return "time";
  if (r.win_reason === WIN_REASON_CT_ELIM) return "CT elim";
  if (r.win_reason === WIN_REASON_T_ELIM) return "T elim";
  const label = winReasonLabel(r.win_reason);
  return label === "—" ? "unknown" : label.toLowerCase();
}

function buyLine(t: BuyLevel | null, ct: BuyLevel | null): string {
  if (!t && !ct) return "";
  const bits: string[] = [];
  if (t) bits.push(`T ${ECONOMY_BUY_LABEL[t].toLowerCase()}`);
  if (ct) bits.push(`CT ${ECONOMY_BUY_LABEL[ct].toLowerCase()}`);
  return bits.join(" vs ");
}

/** One line per competitive round: buy, opener, how it ended. */
export function roundStories(replay: Replay): RoundStory[] {
  const out: RoundStory[] = [];
  for (const r of replay.rounds) {
    if (r.is_knife) continue;
    const freeze = r.freeze_end_tick || r.start_tick;
    const kills = replay.kills.filter(
      (k) => isEnemyKill(replay, k) && k.tick >= freeze && k.tick <= r.end_tick,
    );
    const first = kills[0] ?? null;
    const opener =
      first != null
        ? {
            name: replay.players[first.attacker]?.name ?? "?",
            vs: replay.players[first.victim]?.name ?? "?",
            tick: first.tick,
          }
        : null;
    const planted = (replay.bombEvents ?? []).some(
      (e) => e.kind === "planted" && inRound(r, e.tick),
    );
    const byPlayer = new Map<number, number>();
    for (const k of kills) {
      if (k.attacker < 0) continue;
      byPlayer.set(k.attacker, (byPlayer.get(k.attacker) ?? 0) + 1);
    }
    const ace = [...byPlayer.values()].some((n) => n >= 5);
    const buys = roundSideBuys(replay, r);
    const tBuy = buys.t;
    const ctBuy = buys.ct;
    const ending = endingOf(r, planted, ace);
    const bits = [buyLine(tBuy, ctBuy)];
    if (opener) bits.push(`${opener.name} opener`);
    if (ace && ending !== "ace") bits.push("ace");
    bits.push(ending);
    out.push({
      round: r.number,
      roundLabel: roundLabel(r),
      jumpTick: freeze,
      winner: r.winner,
      tBuy,
      ctBuy,
      opener,
      ending,
      planted,
      ace,
      summary: bits.filter(Boolean).join(" · "),
    });
  }
  return out;
}
