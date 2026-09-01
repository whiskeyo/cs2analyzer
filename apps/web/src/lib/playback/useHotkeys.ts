import type { MutableRefObject } from "react";
import type { MapPlaces } from "@/lib/match/sites";
import type { Replay } from "@/lib/replay/replayTypes";
import { usePlaybackCommandSink } from "./usePlaybackCommandSink";
import { usePlaybackKeys } from "./usePlaybackKeys";

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
  togglePlaying: () => void;
  setFollow: (v: boolean | ((p: boolean) => boolean)) => void;
  setTrails: (v: boolean | ((p: boolean) => boolean)) => void;
  setSelected: (i: number | null) => void;
}) {
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
