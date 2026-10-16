import type { MatchInfo } from "@/lib/replay/replayTypes";
import { OVERTIME_START_MONEY } from "@/lib/shared/constants";

/**
 * Overtime start money for this demo.
 *
 * Demo convar, then the buy-time observation, then the built-in default.
 * A missing `matchInfo` uses {@link OVERTIME_START_MONEY}.
 */
export function resolveOvertimeStartMoney(info: MatchInfo | undefined): number {
  const demo = info?.convars.demo.mp_overtime_startmoney;
  if (typeof demo === "number") return demo;
  const observed = info?.observed?.overtime_start_money;
  if (typeof observed === "number") return observed;
  return info?.convars.defaults.mp_overtime_startmoney ?? OVERTIME_START_MONEY;
}
