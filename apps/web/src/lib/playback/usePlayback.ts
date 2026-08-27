import { useCallback, useEffect, useRef, useState } from "react";
import { tickRate } from "@/lib/shared/constants";
import { useResetOn } from "@/lib/state/useResetOn";
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
export function usePlayback(replay: Replay | null) {
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
      if (pause) setPlaying(false);
    },
    [publish],
  );

  /** Scrubbing keeps the transport state: dragging the bar does not pause. */
  const scrub = useCallback((t: number) => jump(t, false), [jump]);

  // A new demo lands on the first non-knife freeze end, paused. Whoever
  // restores a saved review may move the playhead again from there.
  useResetOn(replay, () => {
    if (!replay) return;
    const first = replay.rounds.find((r) => !r.is_knife) ?? replay.rounds[0];
    jump(first?.freeze_end_tick ?? replay.ticks.ticks[0] ?? 0);
  });

  useEffect(() => {
    if (!replay || !playing) return;
    let last = performance.now();
    let id = 0;
    const max =
      replay.header.playback_ticks || replay.ticks.ticks[replay.ticks.ticks.length - 1] || 0;
    const tps = tickRate(replay);
    const min = replay.ticks.ticks[0] ?? 0;
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      tickRef.current += dt * tps * speed;
      if (tickRef.current >= max) {
        tickRef.current = max;
        publish(max);
        setPlaying(false);
        return;
      }
      if (tickRef.current <= min) {
        tickRef.current = min;
        publish(min);
        if (speed < 0) {
          setPlaying(false);
          return;
        }
      }
      publish(tickRef.current);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [replay, playing, speed, publish]);

  return { tick, tickRef, playing, setPlaying, playingRef, speed, setSpeed, jump, scrub };
}

export type Playback = ReturnType<typeof usePlayback>;
