import type { MutableRefObject } from "react";
import type { MapPlaces } from "@/lib/match/sites";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import { usePlaybackCommandSink } from "./usePlaybackCommandSink";
import { usePlaybackKeys } from "./usePlaybackKeys";

export type Hotkeys = {
  replayRef: MutableRefObject<Replay | null>;
  tickRef: MutableRefObject<number>;
  playingRef: MutableRefObject<boolean>;
  selectedRef: MutableRefObject<number | null>;
  placesRef: MutableRefObject<MapPlaces | null>;
  jump: (t: number, pause?: boolean, round?: Round | null) => void;
  undo: () => void;
  redo: () => void;
  setPlaying: (v: boolean) => void;
  togglePlaying: () => void;
  setFollow: (v: boolean | ((p: boolean) => boolean)) => void;
  setTrails: (v: boolean | ((p: boolean) => boolean)) => void;
  setSelected: (i: number | null) => void;
};

export function useHotkeys(opts: Hotkeys) {
  usePlaybackCommandSink({
    replayRef: opts.replayRef,
    tickRef: opts.tickRef,
    selectedRef: opts.selectedRef,
    placesRef: opts.placesRef,
    jump: opts.jump,
    undo: opts.undo,
    redo: opts.redo,
    togglePlaying: opts.togglePlaying,
    setFollow: opts.setFollow,
    setTrails: opts.setTrails,
    setSelected: opts.setSelected,
  });
  usePlaybackKeys({
    replayRef: opts.replayRef,
    selectedRef: opts.selectedRef,
  });
}
