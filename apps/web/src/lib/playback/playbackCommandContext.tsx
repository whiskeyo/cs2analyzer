import { createContext, useContext, type ReactNode } from "react";
import {
  fallbackPlaybackCommandBus,
  type PlaybackCommand,
  type PlaybackCommandBus,
} from "./playbackCommands";

const PlaybackCommandContext = createContext<PlaybackCommandBus | null>(null);

/** AnalyzerProvider owns the bus so two providers cannot share a process-wide sink. */
export function PlaybackCommandProvider({
  bus,
  children,
}: {
  bus: PlaybackCommandBus;
  children: ReactNode;
}) {
  return <PlaybackCommandContext.Provider value={bus}>{children}</PlaybackCommandContext.Provider>;
}

export function usePlaybackCommandBus(): PlaybackCommandBus {
  return useContext(PlaybackCommandContext) ?? fallbackPlaybackCommandBus;
}

export function useSendPlaybackCommand(): (cmd: PlaybackCommand) => void {
  const bus = usePlaybackCommandBus();
  return bus.send;
}
