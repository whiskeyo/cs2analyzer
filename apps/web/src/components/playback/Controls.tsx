import { memo, useCallback, useRef, useState } from "react";
import { tickRate } from "@/lib/shared/constants";
import { noteForRound, roundBookmarkMarks } from "@/lib/notes";
import {
  freezeWidth,
  markLabelShift,
  roundScrubEventMarks,
  roundScrubRange,
  roundTimelineMarks,
  type RoundScrubEventMark,
} from "@/lib/playback/roundTimeline";
import { useSendPlaybackCommand } from "@/lib/playback/playbackCommandContext";
import { currentRound } from "@/lib/replay/sample";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import type { RoundNote } from "@/lib/notes/types";
import { formatClock } from "@/lib/weapons/weapons";
import { publicUrl } from "@/lib/shared/publicUrl";
import { TransportButton } from "./TransportButton";
import { UnfocusableButton } from "./UnfocusableButton";

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

function ScrubEventIcon({ mark }: { mark: RoundScrubEventMark }) {
  const color = mark.color ?? "#8b98a5";
  switch (mark.kind) {
    case "kill":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="6.5" r="3.2" fill="none" stroke={color} strokeWidth="1.4" />
          <path
            d="M5.5 10.5c0-1.4 1.1-2.5 2.5-2.5s2.5 1.1 2.5 2.5"
            fill="none"
            stroke={color}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "bomb_plant":
      return (
        <img
          src={publicUrl("weapons/c4.svg")}
          alt=""
          aria-hidden="true"
          style={{ filter: "brightness(1.15)" }}
        />
      );
    case "bomb_defuse":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M4 8h8M8 4v8"
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="8" cy="8" r="5.5" fill="none" stroke={color} strokeWidth="1.2" />
        </svg>
      );
    case "bomb_explode":
      return (
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1.5 9.6 6.4 14.5 8 9.6 9.6 8 14.5 6.4 9.6 1.5 8 6.4 6.4Z" fill={color} />
        </svg>
      );
  }
}

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
  notes: RoundNote[];
  playing: boolean;
  speed: number;
  roundAutoplay: boolean;
  onTick: (tick: number) => void;
  onJump: (tick: number) => void;
  onTogglePlay: () => void;
  onPlaying: (v: boolean) => void;
  onSpeed: (v: number) => void;
  onRoundAutoplay: (enabled: boolean) => void;
  activeRound?: Round | null;
}

export const Controls = memo(function Controls({
  replay,
  tick,
  notes,
  playing,
  speed,
  roundAutoplay,
  onTick,
  onJump,
  onTogglePlay,
  onPlaying,
  onSpeed,
  onRoundAutoplay,
  activeRound,
}: Props) {
  const send = useSendPlaybackCommand();
  const round = activeRound ?? currentRound(replay, tick);
  const fallback = {
    min: replay.ticks.ticks[0] ?? 0,
    max: replay.header.playback_ticks || replay.ticks.ticks[replay.ticks.ticks.length - 1] || 0,
  };
  const { min, max } = roundScrubRange(round ?? undefined, replay.rounds, fallback);
  const [scrubLock, setScrubLock] = useState<{
    min: number;
    max: number;
    roundStart: number;
  } | null>(null);
  const resumePlayRef = useRef(false);
  const scrubbingRef = useRef(false);
  const rangeRef = useRef({ min, max });
  const playingRef = useRef(playing);
  rangeRef.current = { min, max };
  playingRef.current = playing;
  const activeRange =
    scrubLock && scrubLock.roundStart === (round?.start_tick ?? 0)
      ? { min: scrubLock.min, max: scrubLock.max }
      : { min, max };

  const endScrub = useCallback(() => {
    scrubbingRef.current = false;
    setScrubLock(null);
    if (resumePlayRef.current) {
      onPlaying(true);
    }
    resumePlayRef.current = false;
  }, [onPlaying]);

  const startScrub = useCallback(() => {
    scrubbingRef.current = true;
    setScrubLock({ ...rangeRef.current, roundStart: round?.start_tick ?? 0 });
    resumePlayRef.current = playingRef.current;
    onPlaying(false);
  }, [onPlaying, round?.start_tick]);

  const tps = tickRate(replay);
  const inFreeze = !!round && tick < round.freeze_end_tick;
  const freezeLeft =
    round && tick < round.freeze_end_tick ? (round.freeze_end_tick - tick) / tps : 0;
  const clock = inFreeze
    ? `Freeze ${freezeLeft.toFixed(1)}s`
    : formatClock(Math.max(0, (tick - (round?.freeze_end_tick ?? min)) / tps));
  const marks = round ? roundTimelineMarks(round, tps, activeRange) : [];
  const bookmarks = round
    ? roundBookmarkMarks(noteForRound(notes, round.number), round, activeRange)
    : [];
  const eventMarks = round ? roundScrubEventMarks(replay, round, activeRange) : [];
  const freezeAt = round ? freezeWidth(round, activeRange) : 0;
  const span = activeRange.max - activeRange.min;
  const progress =
    span > 0
      ? (Math.min(activeRange.max, Math.max(activeRange.min, tick)) - activeRange.min) / span
      : 0;

  const step = (dir: number) => {
    onJump(Math.min(max, Math.max(min, tick + dir * 8)));
  };

  return (
    <div className="controls">
      <TransportButton playing={playing} onToggle={onTogglePlay} />
      <UnfocusableButton
        title="Previous round ([)"
        onClick={() => send({ type: "jump-round", dir: -1 })}
      >
        ◀ R
      </UnfocusableButton>
      <UnfocusableButton
        title="Next round (])"
        onClick={() => send({ type: "jump-round", dir: 1 })}
      >
        R ▶
      </UnfocusableButton>
      <UnfocusableButton
        title="Previous kill (,)"
        onClick={() => send({ type: "jump-kill", dir: -1 })}
      >
        ◀ K
      </UnfocusableButton>
      <UnfocusableButton title="Next kill (.)" onClick={() => send({ type: "jump-kill", dir: 1 })}>
        K ▶
      </UnfocusableButton>
      <UnfocusableButton title="Step back" onClick={() => step(-1)}>
        −
      </UnfocusableButton>
      <UnfocusableButton title="Step forward" onClick={() => step(1)}>
        +
      </UnfocusableButton>
      {inFreeze && round && (
        <UnfocusableButton
          title="Skip freeze (Home)"
          onClick={() => {
            onJump(round.freeze_end_tick);
          }}
        >
          Skip freeze
        </UnfocusableButton>
      )}
      <label className="speed">
        Speed
        <select
          value={speed}
          onChange={(e) => {
            onSpeed(Number(e.target.value));
          }}
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </label>
      <div className="timeline-wrap">
        <div className="timeline-bar">
          <div className="timeline-track" aria-hidden="true">
            {freezeAt > 0 && (
              <div className="timeline-freeze" style={{ width: `${freezeAt * 100}%` }} />
            )}
          </div>
          <div
            className="timeline-playhead"
            style={{ left: `${progress * 100}%` }}
            aria-hidden="true"
          />
          <div className="timeline-marks" aria-hidden="true">
            {marks.map((m) => (
              <span key={m.tick} className="timeline-tick" style={{ left: `${m.at * 100}%` }} />
            ))}
          </div>
          <input
            key={round?.start_tick ?? "none"}
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
            onChange={(e) => {
              if (!scrubbingRef.current) return;
              onTick(Number(e.target.value));
            }}
          />
          <div className="timeline-events">
            {eventMarks.map((m) => (
              <button
                key={`${m.kind}-${m.tick}`}
                type="button"
                className={`timeline-event ${m.kind}`}
                title={m.label}
                aria-label={m.label}
                style={{ left: `${m.at * 100}%`, color: m.color }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onJump(m.tick);
                }}
              >
                <ScrubEventIcon mark={m} />
              </button>
            ))}
          </div>
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
                    onJump(m.tick);
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
