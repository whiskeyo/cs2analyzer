import { describe, expect, it } from "vitest";
import { OVERTIME_START_MONEY } from "@/lib/shared/constants";
import type { MatchInfo } from "@/lib/replay/replayTypes";
import { resolveOvertimeStartMoney } from "./matchInfo";

function info(patch: {
  demo?: number;
  observed?: number | null;
  defaults?: number;
  omitObserved?: boolean;
}): MatchInfo {
  const match: MatchInfo = {
    convars: {
      demo: {},
      defaults: { mp_overtime_startmoney: patch.defaults ?? OVERTIME_START_MONEY },
    },
  };
  if (patch.demo !== undefined) {
    match.convars.demo.mp_overtime_startmoney = patch.demo;
  }
  if (!patch.omitObserved) {
    match.observed = {
      overtime_start_money: patch.observed === undefined ? null : patch.observed,
    };
  }
  return match;
}

describe("resolveOvertimeStartMoney", () => {
  it("prefers the demo convar over the observation and the default", () => {
    expect(
      resolveOvertimeStartMoney(info({ demo: 12500, observed: 10000, defaults: 10000 })),
    ).toBe(12500);
  });

  it("uses the observation when the demo did not send the convar", () => {
    expect(resolveOvertimeStartMoney(info({ observed: 10000 }))).toBe(10000);
  });

  it("uses the built-in default when there is no overtime observation", () => {
    expect(resolveOvertimeStartMoney(info({ observed: null }))).toBe(OVERTIME_START_MONEY);
    expect(resolveOvertimeStartMoney(info({ omitObserved: true, defaults: 10000 }))).toBe(10000);
    expect(resolveOvertimeStartMoney(undefined)).toBe(OVERTIME_START_MONEY);
  });
});
