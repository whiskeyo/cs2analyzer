import { useCallback, useEffect, useRef, useState } from "react";
import { tickRate } from "@/lib/shared/constants";
import type { Replay } from "@/lib/replay/replayTypes";

/** Playback clock for the active demo. Overlay demos do not drive this loop. */
export function usePlayback(replay: Replay | null) {
  const [tick, setTick] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const tickRef = useRef(0);
  tickRef.current = tick;
  const playingRef = useRef(playing);
  playingRef.current = playing;

  const jump = useCallback((t: number, pause = true) => {
    tickRef.current = t;
    setTick(t);
    if (pause) setPlaying(false);
  }, []);

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
        setTick(max);
        setPlaying(false);
        return;
      }
      if (tickRef.current <= min) {
        tickRef.current = min;
        setTick(min);
        if (speed < 0) {
          setPlaying(false);
          return;
        }
      }
      setTick(tickRef.current);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [replay, playing, speed]);

  return { tick, setTick, tickRef, playing, setPlaying, playingRef, speed, setSpeed, jump };
}
