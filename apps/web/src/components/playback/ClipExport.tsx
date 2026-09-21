import { useEffect, useRef, useState } from "react";
import {
  CLIP_EXPORT_DEFAULT_SECONDS,
  CLIP_EXPORT_FAILED,
  CLIP_EXPORT_FPS,
  CLIP_EXPORT_MAX_SECONDS,
  CLIP_EXPORT_NOT_READY,
  CLIP_EXPORT_UNSUPPORTED,
} from "@/lib/export/constants";
import {
  clipDownloadName,
  clipDurationSeconds,
  clipFrameTicks,
  clipRangeIssue,
  clipRoundSlug,
  formatClipClock,
  formatClipDuration,
  lastSecondsSpan,
  mediaRecorderSupports,
  preferredClipMime,
  recordRadarClip,
  roundWindowSpan,
  type ClipRangeIssue,
  type ClipSpan,
} from "@/lib/export/radarClip";
import { radarClipSurface, setRadarClipHold } from "@/lib/radar/radarClipSurface";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import { HUD_TICK_INTERVAL_MS, tickRate } from "@/lib/shared/constants";
import { downloadBlob } from "@/lib/shared/download";
import { blockTransportFocus } from "@/lib/playback/transportFocus";

interface Props {
  replay: Replay;
  tick: number;
  round: Round | null;
  minTick: number;
  maxTick: number;
  onTick: (tick: number) => void;
  onPlaying: (playing: boolean) => void;
}

function boundsOf(minTick: number, maxTick: number): ClipSpan {
  return { startTick: minTick, endTick: maxTick };
}

function rangeMessage(issue: ClipRangeIssue): string {
  if (issue === "too-long") {
    return `Clips can be at most ${CLIP_EXPORT_MAX_SECONDS} seconds.`;
  }
  return "Pick a start before the end.";
}

function ClipButton({
  label,
  ariaLabel,
  disabled,
  pressed,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-label={ariaLabel}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={blockTransportFocus}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function ClipExport({ replay, tick, round, minTick, maxTick, onTick, onPlaying }: Props) {
  const rate = tickRate(replay);
  const bounds = boundsOf(minTick, maxTick);
  const roundKey = round?.start_tick ?? null;
  const [open, setOpen] = useState(false);
  const [span, setSpan] = useState<ClipSpan | null>(null);
  const [spanRound, setSpanRound] = useState(roundKey);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  if (spanRound !== roundKey && !recording) {
    setSpanRound(roundKey);
    setSpan(null);
    setError(null);
  }

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const issue = span ? clipRangeIssue(span, rate) : "empty";
  const seconds = span ? clipDurationSeconds(span, rate) : 0;
  const origin = round ? Math.max(round.freeze_end_tick, round.start_tick) : minTick;
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
    setSpan((prev) => prev ?? lastSecondsSpan(tick, CLIP_EXPORT_DEFAULT_SECONDS, bounds, rate));
    setError(null);
    setOpen(true);
  };

  const mark = (edge: "start" | "end") => {
    const at = Math.min(maxTick, Math.max(minTick, tick));
    setSpan((prev) => {
      const base = prev ?? { startTick: minTick, endTick: maxTick };
      return edge === "start" ? { ...base, startTick: at } : { ...base, endTick: at };
    });
    setError(null);
  };

  const download = () => {
    if (!span || issue) return;
    const surface = radarClipSurface();
    if (!surface || surface.canvas.width <= 0 || surface.canvas.height <= 0) {
      setError(CLIP_EXPORT_NOT_READY);
      return;
    }
    const mime = preferredClipMime(mediaRecorderSupports);
    if (!mime) {
      setError(CLIP_EXPORT_UNSUPPORTED);
      return;
    }
    const ticks = clipFrameTicks(span, rate);
    if (ticks.length === 0) {
      setError(rangeMessage("empty"));
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    const restoreTick = tick;
    const endTick = span.endTick;
    setRecording(true);
    setProgress(0);
    setError(null);
    onPlaying(false);
    setRadarClipHold(true);
    let lastUi = 0;
    void recordRadarClip({
      canvas: surface.canvas,
      ticks,
      mimeType: mime,
      paintAt: surface.paintAt,
      signal: controller.signal,
      onFrame: (index, frameTick) => {
        const now = performance.now();
        const last = index === ticks.length - 1;
        if (last || now - lastUi >= HUD_TICK_INTERVAL_MS) {
          lastUi = now;
          onTick(Math.round(frameTick));
          setProgress((index + 1) / ticks.length);
        }
      },
    })
      .then((blob) => {
        const type = blob.type || mime;
        downloadBlob(
          clipDownloadName(replay.header.map_name, clipRoundSlug(round), type),
          type,
          blob,
        );
        onTick(Math.round(endTick));
      })
      .catch((err: unknown) => {
        onTick(restoreTick);
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : CLIP_EXPORT_FAILED);
      })
      .finally(() => {
        setRadarClipHold(false);
        setRecording(false);
        abortRef.current = null;
      });
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
      {open ? (
        <div
          className="clip-export-panel"
          id="radar-clip-export"
          role="region"
          aria-label="Radar clip export"
        >
          <p className="clip-export-hint">
            {CLIP_EXPORT_FPS} fps · up to {CLIP_EXPORT_MAX_SECONDS}s · saved on this device
          </p>
          <div className="clip-export-presets">
            <ClipButton
              label="Last 15s"
              ariaLabel="Last 15 seconds"
              disabled={recording}
              onClick={() =>
                applySpan(lastSecondsSpan(tick, CLIP_EXPORT_DEFAULT_SECONDS, bounds, rate))
              }
            />
            <ClipButton
              label="Last 30s"
              ariaLabel="Last 30 seconds"
              disabled={recording}
              onClick={() =>
                applySpan(lastSecondsSpan(tick, CLIP_EXPORT_MAX_SECONDS, bounds, rate))
              }
            />
            <ClipButton
              label="This round"
              ariaLabel="This round"
              disabled={recording}
              onClick={() => applySpan(roundWindowSpan(tick, bounds, rate))}
            />
          </div>
          <div className="clip-export-row">
            <span>Start {span ? clock(span.startTick) : "—"}</span>
            <ClipButton label="Mark start" disabled={recording} onClick={() => mark("start")} />
          </div>
          <div className="clip-export-row">
            <span>End {span ? clock(span.endTick) : "—"}</span>
            <ClipButton label="Mark end" disabled={recording} onClick={() => mark("end")} />
          </div>
          <p className="clip-export-duration">
            {recording
              ? `Recording ${formatClipDuration(progress * seconds)} / ${formatClipDuration(seconds)}`
              : formatClipDuration(seconds)}
          </p>
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
                disabled={issue !== null}
                onClick={download}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
