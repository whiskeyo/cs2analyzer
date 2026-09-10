import { useEffect, useRef, type MutableRefObject } from "react";

const BUCKET_UI_MS = 100;

/** Advance the bucket overlay clock. Pause when the window ends. */
export function bucketPlayheadStep(
  current: number,
  dtSec: number,
  speed: number,
  maxSec: number,
): { next: number; ended: boolean } {
  const next = Math.min(maxSec, current + dtSec * speed);
  return { next, ended: next >= maxSec };
}

/**
 * Second playhead for aggregated-bucket overlay. Demo-tick transport stays in
 * `usePlayback`; this only mutates `bucketPlaySec` while that overlay is on.
 */
export function useBucketTransport(opts: {
  active: boolean;
  playing: boolean;
  speed: number;
  setPlaying: (playing: boolean) => void;
  bucketWindowSec: number;
  bucketPlaySecRef: MutableRefObject<number>;
  setBucketPlaySec: (sec: number) => void;
}): void {
  const playingRef = useRef(opts.playing);
  playingRef.current = opts.active ? opts.playing : false;
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!opts.active || !opts.playing) return;
    let last = performance.now();
    let lastUi = last;
    let id = 0;
    const loop = (now: number) => {
      if (!playingRef.current) return;
      const o = optsRef.current;
      const dt = (now - last) / 1000;
      last = now;
      const { next, ended } = bucketPlayheadStep(
        o.bucketPlaySecRef.current,
        dt,
        o.speed,
        o.bucketWindowSec,
      );
      o.bucketPlaySecRef.current = next;
      if (ended) {
        o.setPlaying(false);
        o.setBucketPlaySec(next);
      } else if (now - lastUi >= BUCKET_UI_MS) {
        lastUi = now;
        o.setBucketPlaySec(next);
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(id);
      if (playingRef.current === false && optsRef.current.active) {
        optsRef.current.setBucketPlaySec(optsRef.current.bucketPlaySecRef.current);
      }
    };
  }, [opts.active, opts.playing, opts.speed, opts.setPlaying, opts.bucketWindowSec]);
}
