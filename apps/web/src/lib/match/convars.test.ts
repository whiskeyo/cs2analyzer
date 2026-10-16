import { describe, expect, it } from "vitest";
import { sampleMatchInfo } from "@/lib/testing/fixtures";
import { getConvar } from "./convars";

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
