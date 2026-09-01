import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, renderHook } from "@testing-library/react";
import { makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { useHotkeys } from "./useHotkeys";
import { usePlayback } from "./usePlayback";

function makeManyRoundDemo() {
  const rounds = [
    makeRound({ number: 0, is_knife: true, start_tick: 0, freeze_end_tick: 64, end_tick: 100 }),
    ...Array.from({ length: 7 }, (_, i) =>
      makeRound({
        number: i + 1,
        start_tick: 200 + i * 1000,
        freeze_end_tick: 264 + i * 1000,
        end_tick: 900 + i * 1000,
      }),
    ),
  ];
  const ticks = makeTicks(2, 2);
  ticks.ticks[0] = 0;
  ticks.ticks[1] = 10_000;
  return makeReplay({ rounds, ticks, header: { playback_ticks: 10_000 } });
}

function renderPlaybackHotkeys() {
  const replay = makeManyRoundDemo();
  const replayRef = { current: replay };
  const selectedRef = { current: null as number | null };
  const placesRef = { current: null };

  const hook = renderHook(() => {
    const playback = usePlayback(replay, "de_test|many-rounds.dem");
    useHotkeys({
      replayRef,
      tickRef: playback.tickRef,
      playingRef: playback.playingRef,
      selectedRef,
      placesRef,
      jump: playback.jump,
      undo: vi.fn(),
      redo: vi.fn(),
      setPlaying: playback.setPlaying,
      togglePlaying: playback.togglePlaying,
      setFollow: vi.fn(),
      setTrails: vi.fn(),
      setSelected: vi.fn(),
    });
    return playback;
  });

  const keyDown = (init: KeyboardEventInit) => {
    act(() => {
      fireEvent.keyDown(window, init);
    });
  };

  return { ...hook, keyDown };
}

describe("usePlayback + useHotkeys", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", vi.fn());
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("toggles play on Space via hotkeys", () => {
    const replay = makeManyRoundDemo();
    const replayRef = { current: replay };
    const setPlaying = vi.fn();
    const togglePlaying = vi.fn(() => setPlaying(true));

    renderHook(() =>
      useHotkeys({
        replayRef,
        tickRef: { current: 5264 },
        playingRef: { current: false },
        selectedRef: { current: null },
        placesRef: { current: null },
        jump: vi.fn(),
        undo: vi.fn(),
        redo: vi.fn(),
        setPlaying,
        togglePlaying,
        setFollow: vi.fn(),
        setTrails: vi.fn(),
        setSelected: vi.fn(),
      }),
    );

    act(() => {
      fireEvent.keyDown(window, { code: "Space", key: " " });
    });
    expect(togglePlaying).toHaveBeenCalledTimes(1);
  });

  it("keeps Space play/pause working after space [ space space [×5 space", () => {
    const { result, keyDown } = renderPlaybackHotkeys();

    act(() => result.current.jump(5264));

    act(() => result.current.togglePlaying());
    expect(result.current.playing).toBe(true);

    keyDown({ key: "[" });
    expect(result.current.playing).toBe(false);
    expect(result.current.playingRef.current).toBe(false);

    act(() => result.current.togglePlaying());
    expect(result.current.playing).toBe(true);

    act(() => result.current.togglePlaying());
    expect(result.current.playing).toBe(false);

    for (let i = 0; i < 5; i++) {
      keyDown({ key: "[" });
    }

    act(() => result.current.togglePlaying());
    expect(result.current.playing).toBe(true);
    expect(result.current.playingRef.current).toBe(true);
  });

  it("does not restore playingRef after jump pauses during playback", () => {
    const replay = makeManyRoundDemo();
    const { result } = renderHook(() => usePlayback(replay, "de_test|many-rounds.dem"));

    act(() => result.current.setPlaying(true));
    expect(result.current.playingRef.current).toBe(true);

    act(() => result.current.jump(4264));

    expect(result.current.playing).toBe(false);
    expect(result.current.playingRef.current).toBe(false);

    act(() => result.current.togglePlaying());
    expect(result.current.playing).toBe(true);
  });

  it("leaves playingRef false after jump while playback was running", () => {
    const replay = makeManyRoundDemo();
    const { result } = renderHook(() => usePlayback(replay, "de_test|many-rounds.dem"));

    act(() => {
      result.current.setPlaying(true);
      result.current.jump(4264);
    });

    expect(result.current.playing).toBe(false);
    expect(result.current.playingRef.current).toBe(false);
  });
});
