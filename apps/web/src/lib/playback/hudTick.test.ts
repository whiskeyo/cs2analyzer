import { describe, expect, it } from "vitest";
import { HUD_TICK_INTERVAL_MS } from "@/lib/shared/constants";
import { shouldPublishHudTick } from "./hudTick";

describe("shouldPublishHudTick", () => {
  const base = {
    publishedTick: 264,
    nextTick: 280,
    lastPublishMs: 1_000,
    nowMs: 1_000 + HUD_TICK_INTERVAL_MS - 1,
    immediate: false,
  };

  it("skips the same integer tick", () => {
    expect(shouldPublishHudTick({ ...base, nextTick: 264.9, immediate: true })).toBe(false);
  });

  it("publishes a jump immediately inside the HUD interval", () => {
    expect(shouldPublishHudTick({ ...base, immediate: true })).toBe(true);
  });

  it("holds playback publishes until the HUD interval elapses", () => {
    expect(shouldPublishHudTick(base)).toBe(false);
    expect(
      shouldPublishHudTick({
        ...base,
        nowMs: 1_000 + HUD_TICK_INTERVAL_MS,
      }),
    ).toBe(true);
  });

  it("publishes as soon as the playhead leaves freeze", () => {
    expect(
      shouldPublishHudTick({
        ...base,
        publishedTick: 250,
        nextTick: 264,
        freezeEndTick: 264,
      }),
    ).toBe(true);
  });
});
