import { useEffect, useRef, useState } from "react";
import {
  CLIP_EXPORT_FPS,
  CLIP_EXPORT_FROM_PLANT,
  CLIP_EXPORT_FULL_ROUND,
  CLIP_EXPORT_NO_PLANT,
  CLIP_EXPORT_UNSUPPORTED,
} from "@/lib/export/constants";
import { probeClipEncoder } from "@/lib/export/clipEncodeSupport";
import {
  clipNextRoundStart,
  clipRoundCover,
  clipSampleEndTick,
  fullRoundSpan,
  plantTickInRound,
  postPlantSpan,
} from "@/lib/export/clipPlan";
import { clipRoundSlug, type ClipSpan } from "@/lib/export/radarClip";
import { runClipExport } from "@/lib/export/runClipExport";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import { tickRate } from "@/lib/shared/constants";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { ClipFromPlantIcon, ClipRecordIcon } from "./ClipToolbarIcons";

interface Props {
  replay: Replay;
  tick: number;
  round: Round | null;
  onTick: (tick: number) => void;
  onPlaying: (playing: boolean) => void;
}

interface ClipExportError {
  roundKey: number | null;
  message: string;
}

export function ClipExport({ replay, tick, round, onTick, onPlaying }: Props) {
  const { settings } = useUserSettings();
  const size = settings.clipExportSize;
  const fps = CLIP_EXPORT_FPS;
  const rate = tickRate(replay);
  const roundKey = round?.start_tick ?? null;
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<ClipExportError | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const roundIndex = round ? replay.rounds.indexOf(round) : -1;
  const nextStart = round ? clipNextRoundStart(replay.rounds, roundIndex) : null;
  const sampleEnd = clipSampleEndTick(replay.ticks.ticks);
  const cover = round ? clipRoundCover(round, rate, nextStart, sampleEnd) : null;
  const plantAt = round ? plantTickInRound(replay.bombEvents, round) : null;
  const postPlant = cover ? postPlantSpan(cover, plantAt) : null;
  const visibleError = error && error.roundKey === roundKey && !recording ? error.message : null;

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const begin = (span: ClipSpan) => {
    if (recording) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setError(null);
    setRecording(true);
    const exportRound = roundKey;
    void (async () => {
      try {
        const active = await probeClipEncoder(size);
        if (controller.signal.aborted) return;
        if (!active) {
          setError({ roundKey: exportRound, message: CLIP_EXPORT_UNSUPPORTED });
          return;
        }
        await runClipExport({
          choice: active,
          span,
          rate,
          fps,
          size,
          mapName: replay.header.map_name,
          roundSlug: clipRoundSlug(round),
          restoreTick: tick,
          onTick,
          onProgress: () => undefined,
          onPlaying,
          signal: controller.signal,
        });
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        if (err instanceof Error && err.message) {
          setError({ roundKey: exportRound, message: err.message });
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setRecording(false);
      }
    })();
  };

  return (
    <div className="clip-export">
      <button
        type="button"
        className="icon-btn clip-record-btn"
        aria-label={CLIP_EXPORT_FULL_ROUND}
        title={CLIP_EXPORT_FULL_ROUND}
        disabled={!cover || recording}
        onClick={() => {
          if (cover) begin(fullRoundSpan(cover));
        }}
      >
        <ClipRecordIcon />
      </button>
      <button
        type="button"
        className="icon-btn clip-record-btn"
        aria-label={CLIP_EXPORT_FROM_PLANT}
        title={postPlant ? CLIP_EXPORT_FROM_PLANT : CLIP_EXPORT_NO_PLANT}
        disabled={!postPlant || recording}
        onClick={() => {
          if (postPlant) begin(postPlant);
        }}
      >
        <ClipFromPlantIcon />
      </button>
      {visibleError ? (
        <p className="clip-export-error" role="alert">
          {visibleError}
        </p>
      ) : null}
    </div>
  );
}
