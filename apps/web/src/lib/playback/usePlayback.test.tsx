import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { usePlayback } from "./usePlayback";

/** One stable object: a new replay identity means a new demo was loaded. */
function makeDemo() {
  const ticks = makeTicks(2, 2);
  ticks.ticks[0] = 0;
  ticks.ticks[1] = 1920;
  return makeReplay({
    rounds: [
      makeRound({ number: 0, is_knife: true, start_tick: 0, freeze_end_tick: 64, end_tick: 100 }),
      makeRound({ number: 1, start_tick: 200, freeze_end_tick: 264, end_tick: 900 }),
    ],
    ticks,
  });
}

function renderPlayback() {
  const demo = makeDemo();
  return renderHook(() => usePlayback(demo, "de_test|demo.dem"));
}

describe("usePlayback", () => {
  it("opens a demo paused on the first non-knife freeze end", () => {
    const { result } = renderPlayback();
    expect(result.current.tick).toBe(264);
    expect(result.current.playing).toBe(false);
  });

  it("publishes whole ticks while keeping the sub-tick playhead in the ref", () => {
    const { result } = renderPlayback();

    act(() => result.current.jump(300.75));
    // The canvas reads the ref and stays smooth; the tree sees one tick.
    expect(result.current.tickRef.current).toBe(300.75);
    expect(result.current.tick).toBe(300);

    const before = result.current.tick;
    act(() => result.current.jump(300.9));
    expect(result.current.tick).toBe(before);
  });

  it("pauses on a jump but not on a scrub", () => {
    const { result } = renderPlayback();

    act(() => result.current.setPlaying(true));
    act(() => result.current.scrub(400));
    expect(result.current.playing).toBe(true);
    expect(result.current.tick).toBe(400);

    act(() => result.current.jump(500));
    expect(result.current.playing).toBe(false);
  });

  it("keeps the same jump and scrub identities so memoised children hold", () => {
    const { result, rerender } = renderPlayback();
    const { jump, scrub } = result.current;
    rerender();
    expect(result.current.jump).toBe(jump);
    expect(result.current.scrub).toBe(scrub);
  });
});
