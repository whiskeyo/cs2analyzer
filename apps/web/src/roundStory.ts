import { samplePlayers } from "./sample";
import { isEnemyKill } from "./stats";
import type { Replay, Round, Side } from "./types";
import { winReasonLabel } from "./weapons";

export type BuyLevel = "eco" | "force" | "full";

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

function buyLevel(replay: Replay, tick: number, ct: boolean): BuyLevel | null {
  const pts = samplePlayers(replay, tick).filter((p) => p.present && p.ct === ct);
  if (pts.length === 0) return null;
  const avg = pts.reduce((s, p) => s + p.equip, 0) / pts.length;
  if (avg < 2000) return "eco";
  if (avg < 3700) return "force";
  return "full";
}

function endingOf(r: Round, planted: boolean, ace: boolean): string {
  if (ace && (r.win_reason === 8 || r.win_reason === 9)) return "ace";
  if (r.win_reason === 1) return "bomb";
  if (r.win_reason === 7) return planted ? "defuse" : "defuse";
  if (r.win_reason === 12) return "time";
  if (r.win_reason === 8) return "CT elim";
  if (r.win_reason === 9) return "T elim";
  const label = winReasonLabel(r.win_reason);
  return label === "—" ? "unknown" : label.toLowerCase();
}

function buyLine(t: BuyLevel | null, ct: BuyLevel | null): string {
  if (!t && !ct) return "";
  const bits: string[] = [];
  if (t) bits.push(`T ${t}`);
  if (ct) bits.push(`CT ${ct}`);
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
    const tBuy = buyLevel(replay, freeze, false);
    const ctBuy = buyLevel(replay, freeze, true);
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
