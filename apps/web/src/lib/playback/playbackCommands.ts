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

let sink: Sink | null = null;

export function setPlaybackCommandSink(next: Sink | null): void {
  sink = next;
}

export function sendPlaybackCommand(cmd: PlaybackCommand): void {
  sink?.(cmd);
}
