import { useEffect, useRef, useState } from "react";
import {
  CLIP_EXPORT_FPS,
  CLIP_EXPORT_NO_PLANT,
  CLIP_EXPORT_PROGRESS,
  CLIP_EXPORT_STAY_ON_TAB,
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
  type ClipEncodePath,
} from "@/lib/export/clipPlan";
import { clipRoundSlug, type ClipSpan } from "@/lib/export/radarClip";
import { runClipExport } from "@/lib/export/runClipExport";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import { tickRate } from "@/lib/shared/constants";
import { blockTransportFocus } from "@/lib/playback/transportFocus";
import { useUserSettings } from "@/lib/settings/useUserSettings";

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

function ClipButton({
  label,
  ariaLabel,
  disabled,
  pressed,
  title,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  disabled?: boolean;
  pressed?: boolean;
  title?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      disabled={disabled}
      title={title}
      onMouseDown={blockTransportFocus}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function progressLabel(ratio: number): string {
  return `${CLIP_EXPORT_PROGRESS} ${Math.round(ratio * 100)}%`;
}

export function ClipExport({ replay, tick, round, onTick, onPlaying }: Props) {
  const { settings } = useUserSettings();
  const size = settings.clipExportSize;
  const fps = CLIP_EXPORT_FPS;
  const rate = tickRate(replay);
  const roundKey = round?.start_tick ?? null;
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [encodePath, setEncodePath] = useState<ClipEncodePath | null>(null);
  const [error, setError] = useState<ClipExportError | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const roundIndex = round ? replay.rounds.indexOf(round) : -1;
  const nextStart = round ? clipNextRoundStart(replay.rounds, roundIndex) : null;
  const sampleEnd = clipSampleEndTick(replay.ticks.ticks);
  const cover = round ? clipRoundCover(round, rate, nextStart, sampleEnd) : null;
  const plantAt = round ? plantTickInRound(replay.bombEvents, round) : null;
  const postPlant = cover ? postPlantSpan(cover, plantAt) : null;
  const visibleError =
    error && error.roundKey === roundKey && !open && !recording ? error.message : null;

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const toggle = () => {
    if (recording) return;
    setOpen((prev) => !prev);
  };

  const begin = (span: ClipSpan) => {
    if (recording) return;
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    setOpen(false);
    setError(null);
    setEncodePath(null);
    setRecording(true);
    setProgress(0);
    const exportRound = roundKey;
    void (async () => {
      try {
        const active = await probeClipEncoder(size);
        if (controller.signal.aborted) return;
        if (!active) {
          setError({ roundKey: exportRound, message: CLIP_EXPORT_UNSUPPORTED });
          return;
        }
        setEncodePath(active.path);
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
          onProgress: setProgress,
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
        setEncodePath(null);
        setRecording(false);
      }
    })();
  };

  return (
    <div className="clip-export">
      <ClipButton
        label="Clip"
        ariaLabel="Export clip"
        pressed={open}
        disabled={recording}
        onClick={toggle}
      />
      {recording ? (
        <div className="clip-export-panel" role="status" aria-label="Radar clip export">
          <p className="clip-export-duration">{progressLabel(progress)}</p>
          <progress
            className="clip-export-progress"
            max={1}
            value={progress}
            aria-label="Clip export progress"
          />
          {encodePath === "media-recorder" ? (
            <p className="clip-export-hint">{CLIP_EXPORT_STAY_ON_TAB}</p>
          ) : null}
          <div className="clip-export-actions">
            <ClipButton
              label="Cancel"
              ariaLabel="Cancel clip export"
              onClick={() => abortRef.current?.abort()}
            />
          </div>
        </div>
      ) : null}
      {visibleError ? (
        <div className="clip-export-panel" role="alert">
          <p className="clip-export-error">{visibleError}</p>
        </div>
      ) : null}
      {open && !recording ? (
        <div
          className="clip-export-panel"
          id="radar-clip-export"
          role="region"
          aria-label="Radar clip export"
        >
          <div className="clip-export-presets">
            <ClipButton
              label="Full round"
              ariaLabel="Full round"
              disabled={!cover}
              onClick={() => {
                if (cover) begin(fullRoundSpan(cover));
              }}
            />
            <ClipButton
              label="Post plant"
              ariaLabel="Post plant"
              disabled={!postPlant}
              title={postPlant ? undefined : CLIP_EXPORT_NO_PLANT}
              onClick={() => {
                if (postPlant) begin(postPlant);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
