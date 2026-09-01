import { useEffect, useRef, type MutableRefObject } from "react";
import { sendPlaybackCommand } from "./playbackCommands";
import { keyToPlaybackCommand } from "./playbackKeys";

export function usePlaybackKeys(ctx: {
  replayRef: MutableRefObject<unknown | null>;
  selectedRef: MutableRefObject<number | null>;
}) {
  const ctxRef = useRef({
    hasReplay: false,
    hasSelection: false,
  });

  ctxRef.current.hasReplay = ctx.replayRef.current != null;
  ctxRef.current.hasSelection = ctx.selectedRef.current != null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmd = keyToPlaybackCommand(e, ctxRef.current);
      if (!cmd) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      sendPlaybackCommand(cmd);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, []);
}
