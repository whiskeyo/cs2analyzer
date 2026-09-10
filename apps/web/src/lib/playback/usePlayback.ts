import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import { useResetOnDemoChange } from "@/lib/state/demoReset";
import { getSeriesReviewTick } from "@/lib/notes/seriesReviewCache";
import { tickRate } from "@/lib/shared/constants";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import { currentRound } from "@/lib/replay/sample";
import { shouldPublishHudTick } from "./hudTick";
import {
  advanceAtRoundEnd,
  clampTickToRound,
  jumpToRound,
  loadRoundAutoplay,
  roundPlaybackFallback,
  saveRoundAutoplay,
} from "./roundAutoplay";
import { roundScrubRange } from "./roundTimeline";

/**
 * Playback clock for the active demo. Overlay demos do not drive this loop.
 *
 * `tickRef` is the real playhead and carries the sub-tick fraction the rAF loop
 * accumulates; the canvas reads it every frame. React `tick` is published at
 * ~`HUD_TICK_HZ` during play (and immediately on jump, scrub, pause, and
 * round/demo/freeze boundaries) so HUD / scoreboard / `computeStats` are not
 * committed at demo-tick rate.
 *
 * `activeRoundRef` is the round the user jumped to (or scrubbed into). Round-end
 * detection uses that pin, not `currentRound(tick)` — those disagree at
 * freeze/start boundaries and autoplay-off would snap to the previous round.
 */
export function usePlayback(
  replay: Replay | null,
  demoId: string | null,
  freezeTransportRef?: MutableRefObject<boolean>,
) {
  const [tick, setTick] = useState(0);
  const [playing, setPlayingState] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [roundAutoplay, setRoundAutoplayState] = useState(loadRoundAutoplay);
  const [activeRound, setActiveRound] = useState<Round | null>(null);
  const tickRef = useRef(0);
  const playingRef = useRef(playing);
  const rafRef = useRef(0);
  const activeRoundRef = useRef<Round | null>(null);
  const lastHudPublishMsRef = useRef(Number.NEGATIVE_INFINITY);
  const publishedTickRef = useRef(0);
  const roundAutoplayRef = useRef(roundAutoplay);
  roundAutoplayRef.current = roundAutoplay;

  const setRoundAutoplay = useCallback((enabled: boolean) => {
    roundAutoplayRef.current = enabled;
    setRoundAutoplayState(enabled);
    saveRoundAutoplay(enabled);
  }, []);

  const replayRef = useRef(replay);
  replayRef.current = replay;

  const publish = useCallback((t: number, immediate = true) => {
    let next = t;
    const pin = activeRoundRef.current;
    const r = replayRef.current;
    // A stale timeline event can publish the previous round's last tick after a
    // round jump. Never let the UI tick go back before the pinned start.
    if (r && pin && next < pin.start_tick) {
      next = jumpToRound(r, pin);
      tickRef.current = next;
    }
    const floor = Math.floor(next);
    const now = performance.now();
    if (
      !shouldPublishHudTick({
        publishedTick: publishedTickRef.current,
        nextTick: floor,
        lastPublishMs: lastHudPublishMsRef.current,
        nowMs: now,
        immediate,
        freezeEndTick: pin?.freeze_end_tick,
      })
    ) {
      return;
    }
    lastHudPublishMsRef.current = now;
    publishedTickRef.current = floor;
    setTick((prev) => (prev === floor ? prev : floor));
  }, []);

  const pinRound = useCallback(
    (round: Round | null | undefined, atTick: number) => {
      if (!replay) {
        activeRoundRef.current = null;
        return;
      }
      const wanted = round ?? currentRound(replay, atTick);
      const resolved = wanted
        ? (replay.rounds.find((r) => r.start_tick === wanted.start_tick) ?? wanted)
        : null;
      activeRoundRef.current = resolved;
      setActiveRound((prev) => (prev?.start_tick === resolved?.start_tick ? prev : resolved));
    },
    [replay],
  );

  const stopPlaybackLoop = useCallback(() => {
    playingRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const setPlaying = useCallback(
    (v: boolean) => {
      if (v && replay) {
        const round = activeRoundRef.current ?? currentRound(replay, tickRef.current);
        if (round) {
          activeRoundRef.current = round;
          setActiveRound((prev) => (prev?.start_tick === round.start_tick ? prev : round));
          const { max } = roundScrubRange(round, replay.rounds, roundPlaybackFallback(replay));
          const idx = replay.rounds.indexOf(round);
          const next = idx >= 0 ? replay.rounds[idx + 1] : undefined;
          const atThisRoundEnd =
            tickRef.current >= max && (next == null || tickRef.current < next.start_tick);
          if (atThisRoundEnd) {
            const land = jumpToRound(replay, round);
            tickRef.current = land;
            publish(land);
          }
        }
      }
      playingRef.current = v;
      if (!v) {
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        publish(tickRef.current);
      }
      setPlayingState(v);
    },
    [replay, publish],
  );

  const togglePlaying = useCallback(() => {
    setPlaying(!playingRef.current);
  }, [setPlaying]);

  const jump = useCallback(
    (t: number, pause = true, round?: Round | null) => {
      if (pause) {
        stopPlaybackLoop();
        setPlayingState(false);
      }
      const pin = activeRoundRef.current;
      const target = replay
        ? round != null
          ? jumpToRound(replay, round)
          : clampTickToRound(replay, t, pause ? undefined : pin)
        : t;
      tickRef.current = target;
      if (round != null || pause) {
        pinRound(round, target);
      }
      publish(target);
    },
    [replay, publish, stopPlaybackLoop, pinRound],
  );

  /** Stop the transport immediately (refs update before the next render). */
  const pauseNow = useCallback(() => {
    stopPlaybackLoop();
    setPlayingState(false);
    publish(tickRef.current);
  }, [stopPlaybackLoop, publish]);

  /** Scrubbing keeps the transport state: dragging the bar does not pause. */
  const scrub = useCallback((t: number) => jump(t, false), [jump]);

  useResetOnDemoChange(
    demoId,
    () => {
      if (!replay || !demoId) {
        return;
      }
      playingRef.current = false;
      setPlayingState(false);
      const cached = getSeriesReviewTick(demoId);
      const first = replay.rounds.find((r) => !r.is_knife) ?? replay.rounds[0];
      const land = cached ?? first?.freeze_end_tick ?? replay.ticks.ticks[0] ?? 0;
      tickRef.current = land;
      activeRoundRef.current = first ?? null;
      setActiveRound(first ?? null);
      publish(land);
    },
    Boolean(demoId && replay),
  );

  useEffect(() => {
    if (!replay || !playing || freezeTransportRef?.current) return;
    let last = performance.now();
    const max =
      replay.header.playback_ticks || replay.ticks.ticks[replay.ticks.ticks.length - 1] || 0;
    const tps = tickRate(replay);
    const min = replay.ticks.ticks[0] ?? 0;
    const loop = (now: number) => {
      if (!playingRef.current) return;
      if (freezeTransportRef?.current) {
        last = now;
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      const dt = (now - last) / 1000;
      last = now;
      tickRef.current += dt * tps * speed;
      if (speed > 0) {
        const roundEnd = advanceAtRoundEnd(
          tickRef.current,
          replay,
          roundAutoplayRef.current,
          activeRoundRef.current,
        );
        if (roundEnd) {
          tickRef.current = roundEnd.tick;
          if (roundEnd.nextRound) {
            activeRoundRef.current = roundEnd.nextRound;
            setActiveRound(roundEnd.nextRound);
          }
          publish(roundEnd.tick);
          if (!roundEnd.playing) {
            stopPlaybackLoop();
            setPlayingState(false);
            return;
          }
          rafRef.current = requestAnimationFrame(loop);
          return;
        }
      }
      if (tickRef.current >= max) {
        tickRef.current = max;
        publish(max);
        stopPlaybackLoop();
        setPlayingState(false);
        return;
      }
      if (tickRef.current <= min) {
        tickRef.current = min;
        publish(min);
      }
      publish(tickRef.current, false);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [replay, playing, speed, publish, freezeTransportRef, stopPlaybackLoop]);

  return {
    tick,
    tickRef,
    playing,
    setPlaying,
    togglePlaying,
    playingRef,
    speed,
    setSpeed,
    roundAutoplay,
    setRoundAutoplay,
    jump,
    scrub,
    pauseNow,
    activeRound,
  };
}

export type Playback = ReturnType<typeof usePlayback>;
