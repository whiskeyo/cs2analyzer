import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { getSeriesReviewTick } from "@/lib/notes/seriesReviewCache";
import { tickRate } from "@/lib/shared/constants";
import type { Replay } from "@/lib/replay/replayTypes";

/**
 * Playback clock for the active demo. Overlay demos do not drive this loop.
 *
 * `tickRef` is the real playhead and carries the sub-tick fraction the rAF loop
 * accumulates; the canvas reads it every frame. The `tick` state is only
 * published when the whole tick changes, so at 0.25x speed the React tree
 * re-renders 16 times a second instead of 60 and the per-tick caches in
 * `lib/stats` keep hitting.
 */
export function usePlayback(
  replay: Replay | null,
  demoId: string | null,
  freezeTransportRef?: MutableRefObject<boolean>,
) {
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const tickRef = useRef(0);
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const publish = useCallback((t: number) => {
    setTick((prev) => (Math.floor(t) === prev ? prev : Math.floor(t)));
  }, []);

  const jump = useCallback(
    (t: number, pause = true) => {
      tickRef.current = t;
      publish(t);
      if (pause) {
        playingRef.current = false;
        setPlaying(false);
      }
    },
    [publish],
  );

  /** Stop the transport immediately (refs update before the next render). */
  const pauseNow = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
  }, []);

  /** Scrubbing keeps the transport state: dragging the bar does not pause. */
  const scrub = useCallback((t: number) => jump(t, false), [jump]);

  const prevDemoIdRef = useRef<string | null>(null);

  // Layout effect, not render-phase reset: avoids a setState storm when swapping
  // series files (Firefox slow-script warning with several useResetOn hooks).
  useLayoutEffect(() => {
    if (!demoId || !replay) {
      prevDemoIdRef.current = null;
      return;
    }
    if (prevDemoIdRef.current === demoId) return;
    prevDemoIdRef.current = demoId;

    playingRef.current = false;
    setPlaying(false);
    const cached = getSeriesReviewTick(demoId);
    const first = replay.rounds.find((r) => !r.is_knife) ?? replay.rounds[0];
    const land = cached ?? first?.freeze_end_tick ?? replay.ticks.ticks[0] ?? 0;
    tickRef.current = land;
    setTick(Math.floor(land));
  }, [demoId, replay]);

  useEffect(() => {
    if (!replay || !playing || freezeTransportRef?.current) return;
    let last = performance.now();
    let id = 0;
    const max =
      replay.header.playback_ticks || replay.ticks.ticks[replay.ticks.ticks.length - 1] || 0;
    const tps = tickRate(replay);
    const min = replay.ticks.ticks[0] ?? 0;
    const loop = (now: number) => {
      if (freezeTransportRef?.current) {
        last = now;
        id = requestAnimationFrame(loop);
        return;
      }
      const dt = (now - last) / 1000;
      last = now;
      tickRef.current += dt * tps * speed;
      if (tickRef.current >= max) {
        tickRef.current = max;
        publish(max);
        playingRef.current = false;
        setPlaying(false);
        return;
      }
      if (tickRef.current <= min) {
        tickRef.current = min;
        publish(min);
        if (speed < 0) {
          playingRef.current = false;
          setPlaying(false);
          return;
        }
      }
      publish(tickRef.current);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [replay, playing, speed, publish, freezeTransportRef]);

  return {
    tick,
    tickRef,
    playing,
    setPlaying,
    playingRef,
    speed,
    setSpeed,
    jump,
    scrub,
    pauseNow,
  };
}

export type Playback = ReturnType<typeof usePlayback>;
