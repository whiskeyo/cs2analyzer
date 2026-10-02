import { useEffect, useRef, useState } from "react";
import {
  CLIP_EXPORT_CHECKING,
  CLIP_EXPORT_FPS,
  CLIP_EXPORT_NO_PLANT,
  CLIP_EXPORT_UNSUPPORTED,
} from "@/lib/export/constants";
import { probeClipEncoder, type ClipEncoderChoice } from "@/lib/export/clipEncodeSupport";
import {
  clipExportHint,
  clipNextRoundStart,
  clipRoundCover,
  clipSampleEndTick,
  fullRoundSpan,
  plantTickInRound,
  postPlantSpan,
} from "@/lib/export/clipPlan";
import {
  clipDurationSeconds,
  clipRangeIssue,
  clipRoundSlug,
  formatClipClock,
  formatClipDuration,
  type ClipRangeIssue,
  type ClipSpan,
} from "@/lib/export/radarClip";
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

function rangeMessage(issue: ClipRangeIssue): string {
  if (issue === "too-long") {
    return "Clips can be at most 30 seconds in this browser.";
  }
  return "Pick a start before the end.";
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

export function ClipExport({ replay, tick, round, onTick, onPlaying }: Props) {
  const { settings } = useUserSettings();
  const size = settings.clipExportSize;
  const fps = CLIP_EXPORT_FPS;
  const rate = tickRate(replay);
  const roundKey = round?.start_tick ?? null;
  const [open, setOpen] = useState(false);
  const [span, setSpan] = useState<ClipSpan | null>(null);
  const [spanRound, setSpanRound] = useState(roundKey);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [choice, setChoice] = useState<ClipEncoderChoice | null | "pending">("pending");
  const [probedFor, setProbedFor] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const probeKey = open ? `${size}:${fps}` : "";
  if (probeKey !== probedFor) {
    setProbedFor(probeKey);
    setChoice("pending");
  }

  const roundIndex = round ? replay.rounds.indexOf(round) : -1;
  const nextStart = round ? clipNextRoundStart(replay.rounds, roundIndex) : null;
  const sampleEnd = clipSampleEndTick(replay.ticks.ticks);
  const cover = round ? clipRoundCover(round, rate, nextStart, sampleEnd) : null;
  const plantAt = round ? plantTickInRound(replay.bombEvents, round) : null;
  const postPlant = cover ? postPlantSpan(cover, plantAt) : null;

  if (spanRound !== roundKey && !recording) {
    setSpanRound(roundKey);
    setSpan(null);
    setError(null);
  }

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void probeClipEncoder(size).then((next) => {
      if (!cancelled) setChoice(next);
    });
    return () => {
      cancelled = true;
    };
  }, [open, size, fps]);

  const path = choice === "pending" || choice == null ? null : choice.path;
  const issue = span ? clipRangeIssue(span, rate, null) : "empty";
  const seconds = span ? clipDurationSeconds(span, rate) : 0;
  const origin = round ? Math.max(round.freeze_end_tick, round.start_tick) : 0;
  const clock = (at: number) => formatClipClock((at - origin) / rate);

  const applySpan = (next: ClipSpan) => {
    setSpan(next);
    setError(null);
  };

  const toggle = () => {
    if (recording) return;
    if (open) {
      setOpen(false);
      return;
    }
    const full = cover ? fullRoundSpan(cover) : null;
    setSpan((prev) => prev ?? (full && full.endTick > full.startTick ? full : null));
    setError(null);
    setOpen(true);
  };

  const download = () => {
    if (!span || issue || choice === "pending") return;
    if (!choice) {
      setError(CLIP_EXPORT_UNSUPPORTED);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const active = choice;
    setRecording(true);
    setProgress(0);
    setError(null);
    void runClipExport({
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
    })
      .catch((err: unknown) => {
        if (err instanceof Error && err.message) setError(err.message);
      })
      .finally(() => {
        setRecording(false);
        abortRef.current = null;
      });
  };

  const hint =
    choice === "pending"
      ? CLIP_EXPORT_CHECKING
      : choice == null
        ? CLIP_EXPORT_UNSUPPORTED
        : clipExportHint(choice.path, size, seconds);
  const status = recording
    ? path === "media-recorder"
      ? `Recording ${formatClipDuration(progress * seconds)} / ${formatClipDuration(seconds)}`
      : `Exporting ${Math.round(progress * 100)}%`
    : formatClipDuration(seconds);

  return (
    <div className="clip-export">
      <ClipButton
        label="Clip"
        ariaLabel="Export clip"
        pressed={open}
        disabled={recording}
        onClick={toggle}
      />
      {open ? (
        <div
          className="clip-export-panel"
          id="radar-clip-export"
          role="region"
          aria-label="Radar clip export"
        >
          <p className="clip-export-hint">{hint}</p>
          <div className="clip-export-presets">
            <ClipButton
              label="Full round"
              ariaLabel="Full round"
              disabled={recording || !cover}
              onClick={() => {
                if (cover) applySpan(fullRoundSpan(cover));
              }}
            />
            <ClipButton
              label="Post-plant"
              ariaLabel="Post-plant retake"
              disabled={recording || !postPlant}
              title={postPlant ? undefined : CLIP_EXPORT_NO_PLANT}
              onClick={() => {
                if (postPlant) applySpan(postPlant);
              }}
            />
          </div>
          <div className="clip-export-row">
            <span>Start {span ? clock(span.startTick) : "—"}</span>
            <span>End {span ? clock(span.endTick) : "—"}</span>
          </div>
          <p className="clip-export-duration">{status}</p>
          {recording ? (
            <progress
              className="clip-export-progress"
              max={1}
              value={progress}
              aria-label="Clip export progress"
            />
          ) : null}
          {issue && span && !recording ? (
            <p className="clip-export-error">{rangeMessage(issue)}</p>
          ) : null}
          {error ? <p className="clip-export-error">{error}</p> : null}
          <div className="clip-export-actions">
            {recording ? (
              <ClipButton
                label="Cancel"
                ariaLabel="Cancel clip export"
                onClick={() => abortRef.current?.abort()}
              />
            ) : (
              <ClipButton
                label="Download"
                ariaLabel="Download clip"
                disabled={issue !== null || choice === "pending" || choice == null}
                onClick={download}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
