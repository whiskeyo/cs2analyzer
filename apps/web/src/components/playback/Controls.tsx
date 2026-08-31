import { memo, useCallback, useRef, useState } from "react";
import { tickRate } from "@/lib/shared/constants";
import { roundBookmarkMarks } from "@/lib/notes";
import {
  freezeWidth,
  markLabelShift,
  roundScrubRange,
  roundTimelineMarks,
} from "@/lib/playback/roundTimeline";
import { currentRound } from "@/lib/replay/sample";
import { nextEventTick } from "@/lib/stats/stats";
import type { Replay } from "@/lib/replay/replayTypes";
import type { Stroke } from "@/lib/notes/types";
import { formatClock } from "@/lib/weapons/weapons";

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

function RoundAutoplayIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path d="M3 4v8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 5.5 12 8 7 10.5V5.5z" fill="currentColor" />
      {on && (
        <path
          d="M13 4v8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

interface Props {
  replay: Replay;
  tick: number;
  strokes: Stroke[];
  playing: boolean;
  speed: number;
  roundAutoplay: boolean;
  onTick: (tick: number) => void;
  onPlaying: (v: boolean) => void;
  onSpeed: (v: number) => void;
  onRoundAutoplay: (enabled: boolean) => void;
}

export const Controls = memo(function Controls({
  replay,
  tick,
  strokes,
  playing,
  speed,
  roundAutoplay,
  onTick,
  onPlaying,
  onSpeed,
  onRoundAutoplay,
}: Props) {
  const round = currentRound(replay, tick);
  const fallback = {
    min: replay.ticks.ticks[0] ?? 0,
    max: replay.header.playback_ticks || replay.ticks.ticks[replay.ticks.ticks.length - 1] || 0,
  };
  const { min, max } = roundScrubRange(round ?? undefined, replay.rounds, fallback);
  const [scrubLock, setScrubLock] = useState<{ min: number; max: number } | null>(null);
  const resumePlayRef = useRef(false);
  const rangeRef = useRef({ min, max });
  const playingRef = useRef(playing);
  rangeRef.current = { min, max };
  playingRef.current = playing;
  const activeRange = scrubLock ?? { min, max };

  const endScrub = useCallback(() => {
    setScrubLock(null);
    if (resumePlayRef.current) {
      onPlaying(true);
    }
    resumePlayRef.current = false;
  }, [onPlaying]);

  const startScrub = useCallback(() => {
    setScrubLock({ ...rangeRef.current });
    resumePlayRef.current = playingRef.current;
    onPlaying(false);
  }, [onPlaying]);

  const tps = tickRate(replay);
  const inFreeze = !!round && tick < round.freeze_end_tick;
  const freezeLeft =
    round && tick < round.freeze_end_tick ? (round.freeze_end_tick - tick) / tps : 0;
  const clock = inFreeze
    ? `Freeze ${freezeLeft.toFixed(1)}s`
    : formatClock(Math.max(0, (tick - (round?.freeze_end_tick ?? min)) / tps));
  const roundIdx = replay.rounds.findIndex((r) => r.start_tick === round?.start_tick);
  const killTicks = replay.kills.map((k) => k.tick);
  const marks = round ? roundTimelineMarks(round, tps, activeRange) : [];
  const bookmarks = round ? roundBookmarkMarks(strokes, round, activeRange) : [];
  const freezeAt = round ? freezeWidth(round, activeRange) : 0;
  const span = activeRange.max - activeRange.min;
  const progress =
    span > 0
      ? (Math.min(activeRange.max, Math.max(activeRange.min, tick)) - activeRange.min) / span
      : 0;

  const gotoRound = (dir: number) => {
    const r = replay.rounds[roundIdx + dir];
    if (!r) return;
    onTick(r.freeze_end_tick || r.start_tick);
    onPlaying(false);
  };

  const gotoKill = (dir: 1 | -1) => {
    const t = nextEventTick(killTicks, tick, dir);
    if (t != null) {
      onTick(t);
      onPlaying(false);
    }
  };

  const step = (dir: number) => {
    onTick(Math.min(max, Math.max(min, tick + dir * 8)));
    onPlaying(false);
  };

  return (
    <div className="controls">
      <button type="button" onClick={() => onPlaying(!playing)}>
        {playing ? "Pause" : "Play"}
      </button>
      <button
        type="button"
        className={speed < 0 ? "on" : ""}
        onClick={() => onSpeed(speed < 0 ? Math.abs(speed) : -Math.abs(speed) || -1)}
      >
        Reverse
      </button>
      <button type="button" title="Previous round ([)" onClick={() => gotoRound(-1)}>
        ◀ R
      </button>
      <button type="button" title="Next round (])" onClick={() => gotoRound(1)}>
        R ▶
      </button>
      <button type="button" title="Previous kill (,)" onClick={() => gotoKill(-1)}>
        ◀ K
      </button>
      <button type="button" title="Next kill (.)" onClick={() => gotoKill(1)}>
        K ▶
      </button>
      <button type="button" title="Step back" onClick={() => step(-1)}>
        −
      </button>
      <button type="button" title="Step forward" onClick={() => step(1)}>
        +
      </button>
      {inFreeze && round && (
        <button
          type="button"
          title="Skip freeze (Home)"
          onClick={() => {
            onTick(round.freeze_end_tick);
            onPlaying(false);
          }}
        >
          Skip freeze
        </button>
      )}
      <label className="speed">
        Speed
        <select
          value={Math.abs(speed)}
          onChange={(e) => {
            const n = Number(e.target.value);
            onSpeed(speed < 0 ? -n : n);
          }}
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </label>
      <label className="round">
        Round
        <select
          value={round?.start_tick ?? 0}
          onChange={(e) => {
            const start = Number(e.target.value);
            const r = replay.rounds.find((x) => x.start_tick === start);
            if (r) {
              onTick(r.freeze_end_tick || r.start_tick);
              onPlaying(false);
            }
          }}
        >
          {replay.rounds.map((r) => (
            <option key={r.start_tick} value={r.start_tick}>
              {r.is_knife ? "Knife" : `R${r.number}`}
              {r.winner ? ` (${r.winner})` : ""}
            </option>
          ))}
        </select>
      </label>
      <div className="timeline-wrap">
        <div className="timeline-bar">
          <div className="timeline-rail" aria-hidden="true">
            {freezeAt > 0 && (
              <div className="timeline-freeze" style={{ width: `${freezeAt * 100}%` }} />
            )}
            <div className="timeline-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="timeline-marks" aria-hidden="true">
            {marks.map((m) => (
              <span key={m.tick} className="timeline-tick" style={{ left: `${m.at * 100}%` }} />
            ))}
          </div>
          <input
            className="timeline"
            type="range"
            min={activeRange.min}
            max={activeRange.max}
            aria-label="Round timeline"
            value={Math.min(activeRange.max, Math.max(activeRange.min, tick))}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              startScrub();
            }}
            onPointerUp={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
              endScrub();
            }}
            onPointerCancel={endScrub}
            onChange={(e) => onTick(Number(e.target.value))}
          />
          <div className="timeline-bookmarks">
            {bookmarks.map((m) => {
              const span = m.kind !== "pin";
              return (
                <button
                  key={m.index}
                  type="button"
                  className={`timeline-bookmark ${m.kind}`}
                  title={m.title}
                  aria-label={m.title}
                  style={
                    span
                      ? {
                          left: `${m.startAt * 100}%`,
                          width: `${Math.max(0.8, (m.endAt - m.startAt) * 100)}%`,
                          color: m.color,
                        }
                      : { left: `${m.startAt * 100}%`, color: m.color }
                  }
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onTick(m.tick);
                    onPlaying(false);
                  }}
                />
              );
            })}
          </div>
        </div>
        <div className="timeline-labels" aria-hidden="true">
          {marks.map((m) => (
            <span
              key={m.tick}
              className="timeline-label"
              style={{ left: `${m.at * 100}%`, transform: `translateX(${markLabelShift(m.at)})` }}
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>
      <div className="clock-wrap">
        <span className="clock">
          {round ? (round.is_knife ? "Knife" : `R${round.number}`) : "—"} {clock}
        </span>
        <button
          type="button"
          className={`icon-btn round-autoplay${roundAutoplay ? " on" : ""}`}
          title={
            roundAutoplay
              ? "Round autoplay on — continue to the next round"
              : "Round autoplay off — stop at the end of each round"
          }
          aria-label={
            roundAutoplay
              ? "Round autoplay on — continue to the next round"
              : "Round autoplay off — stop at the end of each round"
          }
          aria-pressed={roundAutoplay}
          onClick={() => onRoundAutoplay(!roundAutoplay)}
        >
          <RoundAutoplayIcon on={roundAutoplay} />
        </button>
      </div>
    </div>
  );
});
