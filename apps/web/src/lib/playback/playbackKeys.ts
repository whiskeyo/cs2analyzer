import type { PlaybackCommand } from "./playbackCommands";

/** True when a focused element should keep its own keyboard handling. */
export function hotkeyTargetBlocksKeys(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest(".radar-text-edit")) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    return (target as HTMLInputElement).type !== "range";
  }
  return false;
}

export function roundHotkeyDir(e: Pick<KeyboardEvent, "key" | "code">): -1 | 0 | 1 {
  if (e.key === "]" || e.code === "BracketRight") return 1;
  if (e.key === "[" || e.code === "BracketLeft") return -1;
  return 0;
}

export function keyToPlaybackCommand(
  e: KeyboardEvent,
  ctx: { hasReplay: boolean; hasSelection: boolean },
): PlaybackCommand | null {
  if (hotkeyTargetBlocksKeys(e.target)) return null;

  const isRepeat = e.repeat;

  if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
    return e.shiftKey ? { type: "redo" } : { type: "undo" };
  }
  if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
    return { type: "redo" };
  }

  if (!ctx.hasReplay) return null;

  if (e.code === "Space") {
    if (isRepeat) return null;
    return { type: "toggle-play" };
  }

  const roundDir = roundHotkeyDir(e);
  if (roundDir !== 0) {
    if (isRepeat) return null;
    return { type: "jump-round", dir: roundDir };
  }

  if (e.key === "," || e.key === ".") {
    if (isRepeat) return null;
    return { type: "jump-kill", dir: e.key === "." ? 1 : -1 };
  }

  if (e.key === "e" || e.key === "E") {
    if (isRepeat) return null;
    return { type: "jump-execute", dir: e.key === "E" ? -1 : 1 };
  }

  if (e.key === "Home") {
    if (isRepeat) return null;
    return { type: "jump-home" };
  }

  if (e.key === "f" || e.key === "F") {
    if (!ctx.hasSelection) return null;
    return { type: "toggle-follow" };
  }

  if (e.key === "t" || e.key === "T") return { type: "toggle-trails" };

  if (e.key === "Escape") return { type: "deselect" };

  if (e.key === "ArrowLeft") return { type: "step-scrub", dir: -1, large: e.shiftKey };
  if (e.key === "ArrowRight") return { type: "step-scrub", dir: 1, large: e.shiftKey };

  return null;
}
