import { useEffect, useRef, type MutableRefObject } from "react";
import { findExecutes, nextExecuteTick } from "@/lib/match/execute";
import type { MapPlaces } from "@/lib/match/sites";
import { currentRound } from "@/lib/replay/sample";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import { nextEventTick } from "@/lib/stats/stats";
import { type PlaybackCommand } from "./playbackCommands";
import { usePlaybackCommandBus } from "./playbackCommandContext";
import { roundScrubRange } from "./roundTimeline";

export function usePlaybackCommandSink(opts: {
  replayRef: MutableRefObject<Replay | null>;
  tickRef: MutableRefObject<number>;
  selectedRef: MutableRefObject<number | null>;
  placesRef: MutableRefObject<MapPlaces | null>;
  jump: (t: number, pause?: boolean, round?: Round | null) => void;
  undo: () => void;
  redo: () => void;
  togglePlaying: () => void;
  setFollow: (v: boolean | ((p: boolean) => boolean)) => void;
  setTrails: (v: boolean | ((p: boolean) => boolean)) => void;
  setSelected: (i: number | null) => void;
}) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const bus = usePlaybackCommandBus();

  useEffect(() => {
    const run = (cmd: PlaybackCommand) => {
      const o = optsRef.current;
      switch (cmd.type) {
        case "toggle-play":
          o.togglePlaying();
          return;
        case "jump":
          o.jump(cmd.tick, cmd.pause, cmd.round);
          return;
        case "undo":
          o.undo();
          return;
        case "redo":
          o.redo();
          return;
        case "toggle-follow":
          o.setFollow((v) => !v);
          return;
        case "toggle-trails":
          o.setTrails((v) => !v);
          return;
        case "deselect":
          o.setSelected(null);
          o.setFollow(false);
          return;
        default: {
          const r = o.replayRef.current;
          if (!r) return;
          const round = currentRound(r, o.tickRef.current);
          const roundIdx = round ? r.rounds.indexOf(round) : -1;
          const fallback = {
            min: r.ticks.ticks[0] ?? 0,
            max: r.header.playback_ticks || r.ticks.ticks[r.ticks.ticks.length - 1] || 0,
          };
          const { min, max } = roundScrubRange(round ?? undefined, r.rounds, fallback);
          const kills = r.kills.map((k) => k.tick);

          switch (cmd.type) {
            case "jump-round": {
              const n = r.rounds[roundIdx + cmd.dir];
              if (n) o.jump(0, true, n);
              return;
            }
            case "jump-kill": {
              const t = nextEventTick(kills, o.tickRef.current, cmd.dir);
              if (t != null) o.jump(t);
              return;
            }
            case "jump-execute": {
              const t = nextExecuteTick(
                findExecutes(r, o.placesRef.current),
                o.tickRef.current,
                cmd.dir,
              );
              if (t != null) o.jump(t);
              return;
            }
            case "jump-home":
              o.jump(0, true, round ?? undefined);
              return;
            case "step-scrub": {
              const step = cmd.large ? 64 : 16;
              o.jump(
                Math.min(max, Math.max(min, o.tickRef.current + (cmd.dir === 1 ? step : -step))),
              );
              return;
            }
          }
        }
      }
    };

    bus.setSink(run);
    return () => bus.setSink(null);
  }, [bus]);
}
