import { describe, expect, it } from "vitest";
import { OVERTIME_START_MONEY } from "@/lib/shared/constants";
import { sampleMatchInfo } from "@/lib/testing/fixtures";
import { getConvar, getConvarAt, overtimeStartMoney } from "./convars";

describe("getConvar", () => {
  it("returns the demo value when the server sent the name", () => {
    const info = sampleMatchInfo();
    info.convars.demo.mp_maxrounds = "30";
    expect(getConvar(info, "mp_maxrounds")).toBe("30");
  });

  it("falls back to the tournament default for mp_overtime_maxrounds", () => {
    expect(getConvar(sampleMatchInfo(), "mp_overtime_maxrounds")).toBe("6");
  });

  it("returns undefined when the name is missing from both tables", () => {
    expect(getConvar(sampleMatchInfo(), "mp_freezetime")).toBeUndefined();
    expect(getConvar(undefined, "mp_maxrounds")).toBeUndefined();
  });
});

describe("getConvarAt", () => {
  const info = sampleMatchInfo({
    convar_updates: [
      { tick: 0, name: "mp_maxrounds", value: "24" },
      { tick: 100, name: "mp_buytime", value: "15" },
      { tick: 200, name: "mp_maxrounds", value: "30" },
      { tick: 200, name: "mp_maxrounds", value: "16" },
      { tick: 50, name: "mp_roundtime", value: "1.92" },
      { tick: 10, name: "mp_roundtime", value: "1.50" },
    ],
  });

  it("uses the last update at or before the tick", () => {
    expect(getConvarAt(info, "mp_maxrounds", 100)).toBe("24");
    expect(getConvarAt(info, "mp_maxrounds", 200)).toBe("16");
    expect(getConvarAt(info, "mp_buytime", 100)).toBe("15");
  });

  it("ignores updates that have not happened yet and falls back to getConvar", () => {
    expect(getConvarAt(info, "mp_buytime", 99)).toBe("20");
    expect(getConvarAt(info, "mp_overtime_maxrounds", 500)).toBe("6");
    expect(getConvarAt(info, "mp_freezetime", 10)).toBeUndefined();
    expect(getConvarAt(undefined, "mp_maxrounds", 0)).toBeUndefined();
  });

  it("keeps the later row when an earlier tick is appended after", () => {
    expect(getConvarAt(info, "mp_roundtime", 50)).toBe("1.50");
  });
});

describe("overtimeStartMoney", () => {
  it("uses the demo convar ahead of observed and the default", () => {
    const info = sampleMatchInfo({
      observed: { overtime_start_money: 16000 },
    });
    info.convars.demo.mp_overtime_startmoney = "10000";
    expect(overtimeStartMoney(info)).toBe(10000);
  });

  it("uses observed money when the demo omitted the convar", () => {
    const info = sampleMatchInfo({ observed: { overtime_start_money: 10000 } });
    expect(info.convars.demo.mp_overtime_startmoney).toBeUndefined();
    expect(info.convars.defaults.mp_overtime_startmoney).toBe("12500");
    expect(overtimeStartMoney(info)).toBe(10000);
  });

  it("uses the tournament default when neither source is present", () => {
    expect(overtimeStartMoney(sampleMatchInfo())).toBe(OVERTIME_START_MONEY);
    expect(overtimeStartMoney(undefined)).toBe(OVERTIME_START_MONEY);
    const cleared = sampleMatchInfo({ observed: { overtime_start_money: null } });
    expect(overtimeStartMoney(cleared)).toBe(OVERTIME_START_MONEY);
  });

  it("skips a non-numeric demo value and a non-integer observed value", () => {
    const info = sampleMatchInfo({ observed: { overtime_start_money: 10000.5 } });
    info.convars.demo.mp_overtime_startmoney = "nope";
    expect(overtimeStartMoney(info)).toBe(OVERTIME_START_MONEY);
    info.observed = { overtime_start_money: 9000 };
    expect(overtimeStartMoney(info)).toBe(9000);
  });
});
