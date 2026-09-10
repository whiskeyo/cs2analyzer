/** Playback actions shared by keyboard hotkeys and transport UI. */
import type { Round } from "@/lib/replay/replayTypes";

export type PlaybackCommand =
  | { type: "toggle-play" }
  | { type: "jump"; tick: number; pause?: boolean; round?: Round }
  | { type: "jump-round"; dir: -1 | 1 }
  | { type: "jump-kill"; dir: -1 | 1 }
  | { type: "jump-execute"; dir: -1 | 1 }
  | { type: "jump-home" }
  | { type: "step-scrub"; dir: -1 | 1; large?: boolean }
  | { type: "toggle-follow" }
  | { type: "toggle-trails" }
  | { type: "deselect" }
  | { type: "undo" }
  | { type: "redo" };

type Sink = (cmd: PlaybackCommand) => void;

export interface PlaybackCommandBus {
  setSink: (next: Sink | null) => void;
  send: (cmd: PlaybackCommand) => void;
}

/** One bus per AnalyzerProvider. Tests without a provider use `fallbackBus`. */
export function createPlaybackCommandBus(): PlaybackCommandBus {
  let sink: Sink | null = null;
  return {
    setSink(next) {
      sink = next;
    },
    send(cmd) {
      sink?.(cmd);
    },
  };
}

/** Used only by hook/component tests that do not mount AnalyzerProvider. */
export const fallbackPlaybackCommandBus = createPlaybackCommandBus();

export function setPlaybackCommandSink(next: Sink | null): void {
  fallbackPlaybackCommandBus.setSink(next);
}

export function sendPlaybackCommand(cmd: PlaybackCommand): void {
  fallbackPlaybackCommandBus.send(cmd);
}
