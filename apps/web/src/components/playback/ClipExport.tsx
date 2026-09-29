import { useEffect, useMemo, useRef, useState } from "react";
import {
  CLIP_EXPORT_CHECKING,
  CLIP_EXPORT_NO_EXECUTE,
  CLIP_EXPORT_NO_KILL,
  CLIP_EXPORT_NO_PLANT,
  CLIP_EXPORT_UNSUPPORTED,
} from "@/lib/export/constants";
import { probeClipEncoder, type ClipEncoderChoice } from "@/lib/export/clipEncodeSupport";
import {
  aroundKillSpan,
  clipExportHint,
  clipExportMaxSeconds,
  clipNextRoundStart,
  clipRoundBounds,
  clipRoundCover,
  firstExecuteActionTick,
  fullRoundSpan,
  killsInRound,
  nearestKillTick,
  plantTickInRound,
  postPlantSpan,
  siteEntrySpan,
} from "@/lib/export/clipPlan";
import {
  clipDurationSeconds,
  clipRangeIssue,
  clipRoundSlug,
  defaultClipSpan,
  formatClipClock,
  formatClipDuration,
  type ClipRangeIssue,
  type ClipSpan,
} from "@/lib/export/radarClip";
import { runClipExport } from "@/lib/export/runClipExport";
import { findExecutes } from "@/lib/match/execute";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import { tickRate } from "@/lib/shared/constants";
import { blockTransportFocus } from "@/lib/playback/transportFocus";
import { useUserSettings } from "@/lib/settings/useUserSettings";

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

export function ClipExport({ replay, tick, round, minTick, maxTick, onTick, onPlaying }: Props) {
  const { settings } = useUserSettings();
  const size = settings.clipExportSize;
  const fps = settings.clipExportFps;
  const rate = tickRate(replay);
  const scrub = boundsOf(minTick, maxTick);
  const roundKey = round?.start_tick ?? null;
  const [open, setOpen] = useState(false);
  const [span, setSpan] = useState<ClipSpan | null>(null);
  const [spanRound, setSpanRound] = useState(roundKey);
  const [killIndex, setKillIndex] = useState(0);
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

  const beats = useMemo(() => findExecutes(replay), [replay]);
  const roundBounds = round ? clipRoundBounds(round) : null;
  const roundIndex = round ? replay.rounds.indexOf(round) : -1;
  const nextStart = round ? clipNextRoundStart(replay.rounds, roundIndex) : null;
  const demoEnd = replay.header.playback_ticks;
  const cover = round ? clipRoundCover(round, rate, nextStart, demoEnd) : null;
  const executeAt = round ? firstExecuteActionTick(beats, round.number) : null;
  const plantAt = round ? plantTickInRound(replay.bombEvents, round) : null;
  const roundKills = useMemo(() => {
    if (!round) return [];
    const index = replay.rounds.indexOf(round);
    const next = clipNextRoundStart(replay.rounds, index);
    return killsInRound(
      replay.kills,
      round,
      clipRoundCover(round, tickRate(replay), next, replay.header.playback_ticks).endTick,
    );
  }, [replay, round]);
  const site = roundBounds ? siteEntrySpan(roundBounds, executeAt, plantAt, rate) : null;
  const postPlant = roundBounds ? postPlantSpan(roundBounds, plantAt) : null;

  if (spanRound !== roundKey && !recording) {
    setSpanRound(roundKey);
    setSpan(null);
    setKillIndex(0);
    setError(null);
  }

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void probeClipEncoder(size, fps).then((next) => {
      if (!cancelled) setChoice(next);
    });
    return () => {
      cancelled = true;
    };
  }, [open, size, fps]);

  const path = choice === "pending" || choice == null ? null : choice.path;
  const issue = span ? clipRangeIssue(span, rate, clipExportMaxSeconds(path)) : "empty";
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
    const full = cover ? fullRoundSpan(cover) : null;
    setSpan(
      (prev) =>
        prev ?? (full && full.endTick > full.startTick ? full : defaultClipSpan(tick, scrub, rate)),
    );
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

  const applyKill = (index: number) => {
    setKillIndex(index);
    const kill = roundKills[index];
    if (!cover || !kill) return;
    const next = aroundKillSpan(cover, kill.tick, rate);
    if (next) applySpan(next);
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
        : clipExportHint(choice.path, size, fps);
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
              label="Site entry"
              ariaLabel="Site entry"
              disabled={recording || !site}
              title={site ? undefined : CLIP_EXPORT_NO_EXECUTE}
              onClick={() => {
                if (site) applySpan(site);
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
            <ClipButton
              label="Around kill"
              ariaLabel="Around a kill"
              disabled={recording || roundKills.length === 0}
              title={roundKills.length === 0 ? CLIP_EXPORT_NO_KILL : undefined}
              onClick={() => {
                const nearest = nearestKillTick(roundKills, tick);
                const index = roundKills.findIndex((kill) => kill.tick === nearest);
                applyKill(index >= 0 ? index : 0);
              }}
            />
          </div>
          {roundKills.length > 0 ? (
            <label className="clip-export-row">
              <span>Kill</span>
              <select
                aria-label="Kill"
                value={Math.min(killIndex, roundKills.length - 1)}
                disabled={recording}
                onChange={(event) => applyKill(Number(event.target.value))}
              >
                {roundKills.map((kill, index) => (
                  <option key={`${kill.tick}-${index}`} value={index}>
                    {clock(kill.tick)} {kill.weapon}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="clip-export-row">
            <span>Start {span ? clock(span.startTick) : "—"}</span>
            <ClipButton label="Mark start" disabled={recording} onClick={() => mark("start")} />
          </div>
          <div className="clip-export-row">
            <span>End {span ? clock(span.endTick) : "—"}</span>
            <ClipButton label="Mark end" disabled={recording} onClick={() => mark("end")} />
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
