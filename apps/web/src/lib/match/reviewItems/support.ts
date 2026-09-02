import { MIN_REVIEW_FLASH_SECONDS, TRADE_SECONDS, tickRate } from "@/lib/shared/constants";
import { samplePlayers } from "@/lib/replay/sample";
import { currentSide } from "@/lib/stats/stats";
import type { Kill, Replay, Round } from "@/lib/replay/replayTypes";
import type {
  DeathDraft,
  ReviewHeadline,
  ReviewKind,
  ReviewNote,
  ReviewSeverity,
  RoundReviewContext,
} from "../review";

export function roundLabel(r: Round): string {
  return r.is_knife ? "Knife" : `R${r.number}`;
}

export function isUtil(weapon: string): boolean {
  const w = weapon.toLowerCase();
  return (
    w.includes("hegrenade") ||
    w.includes("inferno") ||
    w.includes("molotov") ||
    w.includes("incgrenade")
  );
}

export function flashedAt(
  replay: Replay,
  player: number,
  tick: number,
): { by: number; duration: number } | null {
  const tps = tickRate(replay);
  let hit: { by: number; duration: number } | null = null;
  for (const b of replay.blinds ?? []) {
    if (b.victim !== player || b.duration < MIN_REVIEW_FLASH_SECONDS) continue;
    const end = b.tick + b.duration * tps;
    if (tick >= b.tick && tick <= end) {
      hit = { by: b.attacker, duration: b.duration };
      const same = currentSide(replay, b.attacker, tick) === currentSide(replay, player, tick);
      if (!same) return hit;
    }
  }
  return hit;
}

export function traded(replay: Replay, death: Kill, untilTick: number): boolean {
  if (death.attacker < 0) return false;
  const tps = tickRate(replay);
  const window = Math.round(TRADE_SECONDS * tps);
  const side = currentSide(replay, death.victim, death.tick);
  for (const k of replay.kills) {
    if (k.tick <= death.tick || k.tick > death.tick + window || k.tick > untilTick) continue;
    if (k.victim !== death.attacker || k.attacker < 0) continue;
    if (currentSide(replay, k.attacker, k.tick) === side) return true;
  }
  return false;
}

export function dmgTo(
  replay: Replay,
  attacker: number,
  victim: number,
  from: number,
  to: number,
): number {
  let n = 0;
  for (const h of replay.hurts ?? []) {
    if (h.tick < from || h.tick > to) continue;
    if (h.attacker === attacker && h.victim === victim) n += h.damage;
  }
  return n;
}

export function aliveOnSide(
  replay: Replay,
  tick: number,
  side: "T" | "CT",
  except: number,
): number {
  let n = 0;
  for (const p of samplePlayers(replay, tick)) {
    if (!p.present || !p.alive || p.index === except) continue;
    if ((p.ct ? "CT" : "T") === side) n += 1;
  }
  return n;
}

/** Largest 1vX the player was in this round, or 0 if they were never last alive. */
export function clutchVs(
  replay: Replay,
  round: Round,
  roundKills: Kill[],
  player: number,
  side: "T" | "CT",
): number {
  const snap = samplePlayers(replay, round.freeze_end_tick || round.start_tick);
  if (snap.length === 0) return 0;
  const alive = new Set<number>();
  const sides = new Map<number, "T" | "CT">();
  for (const p of snap) {
    if (!p.present || !p.alive) continue;
    alive.add(p.index);
    sides.set(p.index, p.ct ? "CT" : "T");
  }
  let maxVs = 0;
  const count = (want: "T" | "CT") => {
    let n = 0;
    for (const i of alive) if (sides.get(i) === want) n += 1;
    return n;
  };
  const note = () => {
    if (!alive.has(player) || sides.get(player) !== side) return;
    const us = count(side);
    const them = count(side === "CT" ? "T" : "CT");
    if (us === 1 && them >= 1) maxVs = Math.max(maxVs, them);
  };
  note();
  for (const k of roundKills) {
    if (k.victim >= 0) alive.delete(k.victim);
    note();
  }
  return maxVs;
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

export function setHigh(draft: DeathDraft): void {
  draft.severity = "high";
}

export function atLeastMid(draft: DeathDraft): void {
  if (draft.severity === "low") draft.severity = "mid";
}

export function countHeadline(
  count: number,
  severity: ReviewSeverity,
  kind: ReviewKind,
  text: string,
): ReviewHeadline[] {
  if (count <= 0) return [];
  return [{ count, severity, kind, text }];
}

export function goodNote(
  ctx: RoundReviewContext,
  tick: number,
  kind: ReviewKind,
  title: string,
  detail: string,
): ReviewNote {
  return {
    tick,
    roundLabel: roundLabel(ctx.round),
    title,
    detail,
    severity: "good",
    kind,
  };
}
