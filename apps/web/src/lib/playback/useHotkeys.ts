import { useEffect, useRef, type MutableRefObject } from "react";
import { roundScrubRange } from "./roundTimeline";
import { findExecutes, nextExecuteTick } from "@/lib/match/execute";
import type { MapPlaces } from "@/lib/match/sites";
import { currentRound } from "@/lib/replay/sample";
import { nextEventTick } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";

export function useHotkeys(opts: {
  replayRef: MutableRefObject<Replay | null>;
  tickRef: MutableRefObject<number>;
  playingRef: MutableRefObject<boolean>;
  selectedRef: MutableRefObject<number | null>;
  placesRef: MutableRefObject<MapPlaces | null>;
  jump: (t: number, pause?: boolean) => void;
  undo: () => void;
  redo: () => void;
  setPlaying: (v: boolean) => void;
  setFollow: (v: boolean | ((p: boolean) => boolean)) => void;
  setTrails: (v: boolean | ((p: boolean) => boolean)) => void;
  setSelected: (i: number | null) => void;
}) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const o = optsRef.current;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      if ((e.target as HTMLElement | null)?.closest?.(".radar-text-edit")) return;
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) o.redo();
        else o.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        o.redo();
        return;
      }
      const r = o.replayRef.current;
      if (!r) return;
      const round = currentRound(r, o.tickRef.current);
      const roundIdx = r.rounds.findIndex((x) => x.start_tick === round?.start_tick);
      const fallback = {
        min: r.ticks.ticks[0] ?? 0,
        max: r.header.playback_ticks || r.ticks.ticks[r.ticks.ticks.length - 1] || 0,
      };
      const { min, max } = roundScrubRange(round ?? undefined, r.rounds, fallback);
      const kills = r.kills.map((k) => k.tick);

      if (e.code === "Space") {
        e.preventDefault();
        o.setPlaying(!o.playingRef.current);
        return;
      }
      if (e.key === "[" || e.key === "]") {
        const n = r.rounds[roundIdx + (e.key === "]" ? 1 : -1)];
        if (n) o.jump(n.freeze_end_tick || n.start_tick);
        return;
      }
      if (e.key === "," || e.key === ".") {
        const t = nextEventTick(kills, o.tickRef.current, e.key === "." ? 1 : -1);
        if (t != null) o.jump(t);
        return;
      }
      if (e.key === "e" || e.key === "E") {
        const t = nextExecuteTick(
          findExecutes(r, o.placesRef.current),
          o.tickRef.current,
          e.key === "E" ? -1 : 1,
        );
        if (t != null) o.jump(t);
        return;
      }
      if (e.key === "Home") {
        o.jump(round?.freeze_end_tick || round?.start_tick || min);
        return;
      }
      if (e.key === "f" || e.key === "F") {
        if (o.selectedRef.current != null) o.setFollow((v) => !v);
        return;
      }
      if (e.key === "t" || e.key === "T") {
        o.setTrails((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        o.setSelected(null);
        o.setFollow(false);
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const step = e.shiftKey ? 64 : 16;
        o.jump(
          Math.min(max, Math.max(min, o.tickRef.current + (e.key === "ArrowRight" ? step : -step))),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
