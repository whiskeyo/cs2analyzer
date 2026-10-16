import type { MatchInfo } from "@/lib/replay/replayTypes";
import { OVERTIME_START_MONEY } from "@/lib/shared/constants";

const OVERTIME_START_MONEY_CVAR = "mp_overtime_startmoney";

/**
 * Overtime start money for this demo.
 *
 * Demo convar, then the freeze-end observation, then the built-in default.
 * A missing `match_info` uses {@link OVERTIME_START_MONEY}.
 */
export function resolveOvertimeStartMoney(info: MatchInfo | undefined): number {
  const demo = parseMoney(info?.convars.demo[OVERTIME_START_MONEY_CVAR]);
  if (demo !== undefined) return demo;
  const observed = info?.observed?.overtime_start_money;
  if (typeof observed === "number") return observed;
  return parseMoney(info?.convars.defaults[OVERTIME_START_MONEY_CVAR]) ?? OVERTIME_START_MONEY;
}

function parseMoney(value: string | undefined): number | undefined {
  if (value === undefined || !/^-?\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
