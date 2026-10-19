import { bySide, roundSideBuys, roundTeamName } from "@/lib/match/economy";
import { attackerLabel } from "@/lib/replay/playerLabel";
import type { Replay, Round, Side } from "@/lib/replay/replayTypes";
import { roundSidesSwapped } from "@/lib/stats/scorecard";
import type { TeamRoundReviewContext } from "../teamReview";

function flipSide(side: Side): Side {
  return side === "CT" ? "T" : "CT";
}

/** Playing side this round for a roster keyed by starting side. */
export function playingSide(replay: Replay, round: Round, startSide: Side): Side {
  return roundSidesSwapped(replay, round) ? flipSide(startSide) : startSide;
}

export function teamRoundContext(
  replay: Replay,
  startSide: Side,
  untilTick: number,
  round: Round,
): TeamRoundReviewContext | null {
  if (round.is_knife) return null;
  const end = Math.min(round.end_tick, untilTick);
  if (round.freeze_end_tick > untilTick) return null;

  const freeze = round.freeze_end_tick || round.start_tick;
  const side = playingSide(replay, round, startSide);
  const buys = roundSideBuys(replay, round);
  const buy = bySide(buys, side);
  const opponentBuy = bySide(buys, flipSide(side));
  const completed = round.end_tick <= untilTick;

  return {
    replay,
    untilTick,
    round,
    roundKills: replay.kills.filter((k) => k.tick >= round.freeze_end_tick && k.tick <= end),
    freeze,
    startSide,
    side,
    teamName: roundTeamName(replay, round, side),
    buy,
    opponentBuy,
    teamLost: completed && round.winner != null && round.winner !== side,
    completed,
    playerName: (i) => attackerLabel(replay, i),
    isTeammate: (index) => replay.players[index]?.start_side === startSide,
  };
}
