import { describe, expect, it } from "vitest";
import { OVERTIME_START_MONEY } from "@/lib/shared/constants";
import type { MatchInfo } from "@/lib/replay/replayTypes";
import { sampleMatchInfo } from "@/lib/testing/fixtures";
import { resolveOvertimeStartMoney } from "./matchInfo";

function info(patch: {
  demo?: string;
  observed?: number | null;
  defaults?: string;
  omitObserved?: boolean;
}): MatchInfo {
  const match = sampleMatchInfo();
  if (patch.demo !== undefined) {
    match.convars.demo.mp_overtime_startmoney = patch.demo;
  }
  if (patch.defaults !== undefined) {
    match.convars.defaults.mp_overtime_startmoney = patch.defaults;
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
      resolveOvertimeStartMoney(info({ demo: "12500", observed: 10000, defaults: "10000" })),
    ).toBe(12500);
  });

  it("uses the observation when the demo did not send the convar", () => {
    expect(resolveOvertimeStartMoney(info({ observed: 10000 }))).toBe(10000);
  });

  it("uses the built-in default when there is no overtime observation", () => {
    expect(resolveOvertimeStartMoney(info({ observed: null }))).toBe(OVERTIME_START_MONEY);
    expect(resolveOvertimeStartMoney(info({ omitObserved: true }))).toBe(OVERTIME_START_MONEY);
    expect(resolveOvertimeStartMoney(undefined)).toBe(OVERTIME_START_MONEY);
  });
});
