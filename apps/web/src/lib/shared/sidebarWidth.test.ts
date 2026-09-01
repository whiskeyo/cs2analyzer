import { describe, expect, it, vi } from "vitest";
import {
  RADAR_MIN_WIDTH,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "./constants";
import { clampSidebarWidth, loadSidebarWidth, saveSidebarWidth } from "./sidebarWidth";

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

describe("loadSidebarWidth", () => {
  it("starts at the default when nothing is stored", () => {
    expect(loadSidebarWidth()).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it("restores a clamped width from localStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });
    store.set("cs2analyzer.sidebarWidth", "520");
    expect(loadSidebarWidth()).toBe(520);
    store.set("cs2analyzer.sidebarWidth", "not-a-number");
    expect(loadSidebarWidth()).toBe(SIDEBAR_MIN_WIDTH);
    vi.unstubAllGlobals();
  });

  it("persists a clamped width", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    });
    saveSidebarWidth(900);
    expect(store.get("cs2analyzer.sidebarWidth")).toBe(String(SIDEBAR_MAX_WIDTH));
    vi.unstubAllGlobals();
  });
});
