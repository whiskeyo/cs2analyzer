import { currentSide, isEnemyKill } from "@/lib/stats/stats";
import { prettyWeapon } from "@/lib/weapons/weapons";
import type { Kill, Replay, Round } from "@/lib/replay/replayTypes";
import type { DeathDraft, DeathReviewContext, ReviewNote, RoundReviewContext } from "../review";
import { aliveOnSide, roundLabel } from "./support";

/** Sample a few ticks before the death so the pawn is still in the tick buffer. */
const DEATH_LOOKBACK_TICKS = 8;

export function roundContext(
  replay: Replay,
  player: number,
  untilTick: number,
  round: Round,
): RoundReviewContext | null {
  if (round.is_knife) return null;
  const end = Math.min(round.end_tick, untilTick);
  if (round.freeze_end_tick > untilTick) return null;
  const roundKills = replay.kills.filter((k) => k.tick >= round.freeze_end_tick && k.tick <= end);
  const freeze = round.freeze_end_tick || round.start_tick;
  const side = currentSide(replay, player, freeze);
  return {
    replay,
    player,
    untilTick,
    round,
    roundKills,
    first: roundKills.find((k) => isEnemyKill(replay, k)),
    myDeaths: roundKills.filter((k) => k.victim === player),
    side,
    teamLost: round.end_tick <= untilTick && round.winner != null && round.winner !== side,
    completed: round.end_tick <= untilTick,
    freeze,
    playerName: (i) => (i < 0 ? "World" : (replay.players[i]?.name ?? "?")),
  };
}

export function deathContext(ctx: RoundReviewContext, kill: Kill): DeathReviewContext {
  const pre = Math.max(ctx.round.freeze_end_tick, kill.tick - DEATH_LOOKBACK_TICKS);
  const teammates = aliveOnSide(ctx.replay, pre, ctx.side, ctx.player);
  const enemies = aliveOnSide(ctx.replay, pre, ctx.side === "CT" ? "T" : "CT", -1);
  return {
    ...ctx,
    kill,
    pre,
    openingDeath:
      ctx.first != null && ctx.first.tick === kill.tick && ctx.first.victim === ctx.player,
    clutchDeath: teammates === 0 && enemies >= 1,
    enemies,
  };
}

export function deathNote(ctx: DeathReviewContext, draft: DeathDraft): ReviewNote {
  const killer = ctx.playerName(ctx.kill.attacker);
  const gun = prettyWeapon(ctx.kill.weapon) + (ctx.kill.headshot ? " HS" : "");
  const title = ctx.openingDeath
    ? `Lost the opening to ${killer}`
    : ctx.clutchDeath
      ? `Lost a 1v${ctx.enemies} to ${killer}`
      : `Died to ${killer}`;
  return {
    tick: ctx.kill.tick,
    roundLabel: roundLabel(ctx.round),
    title,
    detail: [gun, ...draft.bits].join(" · "),
    severity: draft.severity,
    kind: ctx.openingDeath ? "opening" : ctx.clutchDeath ? "clutch" : "death",
  };
}
