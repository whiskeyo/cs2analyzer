import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { setSeriesReview, clearSeriesReviewCache } from "@/lib/notes/seriesReviewCache";
import { loadedDemo } from "@/lib/parse/session";
import { makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { HUD_TICK_INTERVAL_MS } from "@/lib/shared/constants";
import { ROUND_AUTOPLAY_STORAGE_KEY } from "./roundAutoplay";
import { usePlayback } from "./usePlayback";

/** One stable object: a new replay identity means a new demo was loaded. */
function makeDemo() {
  const ticks = makeTicks(2, 2);
  ticks.ticks[0] = 0;
  ticks.ticks[1] = 1920;
  return makeReplay({
    rounds: [
      makeRound({
        number: 0,
        is_knife: true,
        start_tick: 0,
        freeze_end_tick: 64,
        end_tick: 100,
      }),
      makeRound({
        number: 1,
        start_tick: 200,
        freeze_end_tick: 264,
        end_tick: 900,
      }),
    ],
    ticks,
  });
}

function makeTwoRoundDemo() {
  const ticks = makeTicks(2, 2);
  ticks.ticks[0] = 0;
  ticks.ticks[1] = 1920;
  return makeReplay({
    rounds: [
      makeRound({
        number: 0,
        is_knife: true,
        start_tick: 0,
        freeze_end_tick: 64,
        end_tick: 100,
      }),
      makeRound({
        number: 1,
        start_tick: 200,
        freeze_end_tick: 264,
        end_tick: 900,
      }),
      makeRound({
        number: 2,
        start_tick: 1000,
        freeze_end_tick: 1064,
        end_tick: 1800,
      }),
    ],
    ticks,
  });
}

function renderPlayback() {
  const demo = makeDemo();
  return renderHook(() => usePlayback(demo, "de_test|demo.dem"));
}

describe("usePlayback", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
    });
  });

  afterEach(() => {
    clearSeriesReviewCache();
    storage.clear();
    vi.unstubAllGlobals();
  });

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

  it("starts at zero when no replay is loaded", () => {
    const { result } = renderHook(() => usePlayback(null, null));
    expect(result.current.tick).toBe(0);
    expect(result.current.tickRef.current).toBe(0);
  });

  it("pauses immediately through pauseNow", () => {
    const { result } = renderPlayback();
    act(() => result.current.setPlaying(true));
    act(() => result.current.pauseNow());
    expect(result.current.playing).toBe(false);
    expect(result.current.playingRef.current).toBe(false);
  });

  it("plays from freeze end after jump-round then space", () => {
    const ticks = makeTicks(2, 2);
    ticks.ticks[0] = 0;
    ticks.ticks[1] = 20_000;
    const replay = makeReplay({
      header: { playback_ticks: 20_000 },
      rounds: [
        makeRound({
          number: 18,
          start_tick: 6000,
          freeze_end_tick: 7064,
          end_tick: 8900,
        }),
        makeRound({
          number: 19,
          start_tick: 7000,
          freeze_end_tick: 9064,
          end_tick: 9900,
        }),
      ],
      ticks,
    });
    const { result } = renderHook(() => usePlayback(replay, "de_test|overlap-rounds.dem"));

    act(() => result.current.jump(0, true, replay.rounds[1]));
    expect(result.current.tick).toBe(9064);

    act(() => result.current.jump(0, true, replay.rounds[0]));
    expect(result.current.tick).toBe(7064);

    act(() => result.current.setPlaying(true));
    expect(result.current.playing).toBe(true);
    expect(result.current.tick).toBe(7064);
    expect(result.current.tickRef.current).toBe(7064);
  });

  it("ignores a stale scrub into the previous round after jump-round", () => {
    const ticks = makeTicks(2, 2);
    ticks.ticks[0] = 0;
    ticks.ticks[1] = 20_000;
    const replay = makeReplay({
      header: { playback_ticks: 20_000 },
      rounds: [
        makeRound({ number: 18, start_tick: 6000, freeze_end_tick: 7064, end_tick: 8900 }),
        makeRound({ number: 19, start_tick: 7000, freeze_end_tick: 9064, end_tick: 9900 }),
      ],
      ticks,
    });
    const { result } = renderHook(() => usePlayback(replay, "de_test|stale-scrub.dem"));

    act(() => result.current.jump(0, true, replay.rounds[1]));
    expect(result.current.tick).toBe(9064);
    expect(result.current.activeRound?.number).toBe(19);

    act(() => result.current.scrub(6999));
    expect(result.current.tick).toBe(9064);
    expect(result.current.activeRound?.number).toBe(19);
  });

  it("cancels the animation frame when jump pauses during playback", () => {
    const cancel = vi.fn();
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn(() => 7),
    );
    vi.stubGlobal("cancelAnimationFrame", cancel);

    const replay = makeTwoRoundDemo();
    const { result } = renderHook(() => usePlayback(replay, "de_test|two-round.dem"));

    act(() => {
      result.current.jump(1064);
      result.current.setPlaying(true);
    });
    act(() => result.current.jump(264));

    expect(result.current.playing).toBe(false);
    expect(cancel).toHaveBeenCalled();
    expect(result.current.tickRef.current).toBe(264);
  });

  it("restores a cached series tick on demo change", () => {
    const replay = makeDemo();
    const demo = loadedDemo(replay, "demo.dem", new File([], "demo.dem"));
    setSeriesReview({
      demo,
      tick: 400,
      notes: [],
      summaryFilter: {
        kinds: {
          smoke: true,
          flash: true,
          he: true,
          molotov: true,
          incendiary: true,
          decoy: true,
        },
        t: true,
        ct: true,
      },
      floorMode: "auto",
      paletteId: "default",
      color: "#fff",
    });

    const { result } = renderHook(() => usePlayback(replay, demo.id));
    expect(result.current.tick).toBe(400);
    expect(result.current.tickRef.current).toBe(400);
  });

  it("persists round autoplay in localStorage", () => {
    const { result } = renderPlayback();
    act(() => result.current.setRoundAutoplay(true));
    expect(storage.get(ROUND_AUTOPLAY_STORAGE_KEY)).toBe("1");
    expect(result.current.roundAutoplay).toBe(true);
  });

  it("clamps jumps past the round scrub max", () => {
    const replay = makeTwoRoundDemo();
    const { result } = renderHook(() => usePlayback(replay, "de_test|two-round.dem"));
    act(() => result.current.jump(1005));
    expect(result.current.tick).toBe(1064);
  });

  it("rewinds to round start when play is pressed at the round end", () => {
    const replay = makeTwoRoundDemo();
    const { result } = renderHook(() => usePlayback(replay, "de_test|two-round.dem"));
    act(() => result.current.jump(999));
    expect(result.current.tick).toBe(999);

    act(() => result.current.setPlaying(true));
    expect(result.current.playing).toBe(true);
    expect(result.current.tick).toBe(264);
    expect(result.current.tickRef.current).toBe(264);
  });

  describe("animation loop", () => {
    let now = 0;

    beforeEach(() => {
      now = 0;
      vi.stubGlobal("performance", { now: () => now });
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        now += 1000 / 64;
        cb(now);
        return 1;
      });
      vi.stubGlobal("cancelAnimationFrame", vi.fn());
    });

    it("advances the playhead while playing", () => {
      const { result } = renderPlayback();
      const start = result.current.tickRef.current;
      act(() => result.current.setPlaying(true));
      expect(result.current.tickRef.current).toBeGreaterThan(start);
    });

    it("stops at the end of the demo", () => {
      const { result } = renderPlayback();
      act(() => {
        result.current.jump(1910);
        result.current.setPlaying(true);
      });
      expect(result.current.playing).toBe(false);
      expect(result.current.tick).toBe(1920);
    });

    it("keeps the transport frozen while freezeTransportRef is set", () => {
      const freezeRef = { current: true };
      const { result } = renderHook(() => usePlayback(makeDemo(), "de_test|demo.dem", freezeRef));
      const start = result.current.tickRef.current;
      act(() => result.current.setPlaying(true));
      expect(result.current.tickRef.current).toBe(start);
      expect(result.current.playing).toBe(true);
    });

    it("plays the jumped-to round when autoplay is off and start ticks overlap", () => {
      const ticks = makeTicks(2, 2);
      ticks.ticks[0] = 0;
      ticks.ticks[1] = 20_000;
      const replay = makeReplay({
        header: { playback_ticks: 20_000 },
        rounds: [
          makeRound({
            number: 18,
            start_tick: 6000,
            freeze_end_tick: 7064,
            end_tick: 8900,
          }),
          makeRound({
            number: 19,
            start_tick: 7000,
            freeze_end_tick: 9064,
            end_tick: 9900,
          }),
        ],
        ticks,
      });
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
      });
      const { result } = renderHook(() => usePlayback(replay, "de_test|overlap-play.dem"));
      act(() => {
        result.current.setRoundAutoplay(false);
        result.current.jump(0, true, replay.rounds[1]);
      });
      expect(result.current.tick).toBe(9064);

      act(() => result.current.setPlaying(true));
      act(() => frames.shift()?.(16));

      expect(result.current.playing).toBe(true);
      expect(result.current.tick).toBeGreaterThanOrEqual(9064);
      expect(result.current.tick).toBeLessThan(9900);
    });

    it("keeps playing the jumped round when autoplay is off", () => {
      const replay = makeTwoRoundDemo();
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
      });
      const { result } = renderHook(() => usePlayback(replay, "de_test|two-round.dem"));
      act(() => {
        result.current.setRoundAutoplay(false);
        result.current.jump(0, true, replay.rounds[2]);
      });
      expect(result.current.tick).toBe(1064);

      act(() => result.current.setPlaying(true));
      act(() => frames.shift()?.(16));

      expect(result.current.playing).toBe(true);
      expect(result.current.tick).toBeGreaterThanOrEqual(1064);
      expect(result.current.tick).toBeLessThan(1800);
    });

    it("auto-advances to the next round when round autoplay is on", () => {
      storage.set(ROUND_AUTOPLAY_STORAGE_KEY, "1");
      const replay = makeTwoRoundDemo();
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
      });
      const { result } = renderHook(() => usePlayback(replay, "de_test|two-round.dem"));
      act(() => {
        result.current.jump(998);
        result.current.setPlaying(true);
      });
      act(() => frames.shift()?.(16));
      expect(result.current.tick).toBe(1064);
      expect(result.current.playing).toBe(true);
    });
  });

  describe("HUD tick publish rate", () => {
    let now = 0;
    let frames: FrameRequestCallback[];

    beforeEach(() => {
      now = 0;
      frames = [];
      vi.stubGlobal("performance", { now: () => now });
      vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
        frames.push(cb);
        return frames.length;
      });
      vi.stubGlobal("cancelAnimationFrame", vi.fn());
    });

    function step(dtMs: number) {
      now += dtMs;
      const cb = frames.shift();
      if (cb) {
        cb(now);
      }
    }

    it("keeps tickRef live while React tick waits for the HUD interval", () => {
      const { result } = renderPlayback();
      const start = result.current.tick;
      act(() => result.current.setPlaying(true));
      act(() => step(16));
      expect(result.current.tickRef.current).toBeGreaterThan(start);
      expect(result.current.tick).toBe(start);

      act(() => step(HUD_TICK_INTERVAL_MS));
      expect(result.current.tick).toBe(Math.floor(result.current.tickRef.current));
      expect(result.current.tick).toBeGreaterThan(start);
    });

    it("flushes React tick when pausing mid-interval", () => {
      const { result } = renderPlayback();
      const start = result.current.tick;
      act(() => result.current.setPlaying(true));
      act(() => step(16));
      expect(result.current.tick).toBe(start);
      act(() => result.current.setPlaying(false));
      expect(result.current.tick).toBe(Math.floor(result.current.tickRef.current));
      expect(result.current.tick).toBeGreaterThan(start);
    });

    it("publishes a scrub immediately during playback", () => {
      const { result } = renderPlayback();
      act(() => result.current.setPlaying(true));
      act(() => step(16));
      act(() => result.current.scrub(400));
      expect(result.current.tick).toBe(400);
      expect(result.current.tickRef.current).toBe(400);
      expect(result.current.playing).toBe(true);
    });
  });
});
