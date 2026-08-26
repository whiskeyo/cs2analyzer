import { describe, expect, it } from "vitest";
import { RADAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from "./constants";
import { clampSidebarWidth } from "./sidebarWidth";

describe("clampSidebarWidth", () => {
  it("keeps the current layout as the floor", () => {
    expect(clampSidebarWidth(320, 1600)).toBe(SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth(SIDEBAR_MIN_WIDTH, 1600)).toBe(SIDEBAR_MIN_WIDTH);
  });

  it("grows up to the named max when the stage is wide", () => {
    expect(clampSidebarWidth(500, 1600)).toBe(500);
    expect(clampSidebarWidth(900, 1600)).toBe(SIDEBAR_MAX_WIDTH);
  });

  it("leaves room for the radar", () => {
    const stage = SIDEBAR_MIN_WIDTH + RADAR_MIN_WIDTH + 80;
    expect(clampSidebarWidth(SIDEBAR_MAX_WIDTH, stage)).toBe(stage - RADAR_MIN_WIDTH);
  });

  it("falls back to the floor on bad input", () => {
    expect(clampSidebarWidth(Number.NaN, 1600)).toBe(SIDEBAR_MIN_WIDTH);
  });
});
