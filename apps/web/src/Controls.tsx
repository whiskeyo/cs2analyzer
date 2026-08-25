import { tickRate } from "./constants";
import { freezeWidth, markLabelShift, roundScrubRange, roundTimelineMarks } from "./roundTimeline";
import { currentRound } from "./sample";
import { nextEventTick } from "./stats";
import type { Replay } from "./types";
import { formatClock } from "./weapons";

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

interface Props {
  replay: Replay;
  tick: number;
  playing: boolean;
  speed: number;
  onTick: (tick: number) => void;
  onPlaying: (v: boolean) => void;
  onSpeed: (v: number) => void;
}

export function Controls({ replay, tick, playing, speed, onTick, onPlaying, onSpeed }: Props) {
  const round = currentRound(replay, tick);
  const fallback = {
    min: replay.ticks.ticks[0] ?? 0,
    max: replay.header.playback_ticks || replay.ticks.ticks[replay.ticks.ticks.length - 1] || 0,
  };
  const { min, max } = roundScrubRange(round ?? undefined, replay.rounds, fallback);
  const tps = tickRate(replay);
  const inFreeze = !!round && tick < round.freeze_end_tick;
  const freezeLeft =
    round && tick < round.freeze_end_tick ? (round.freeze_end_tick - tick) / tps : 0;
  const clock = inFreeze
    ? `Freeze ${freezeLeft.toFixed(1)}s`
    : formatClock(Math.max(0, (tick - (round?.freeze_end_tick ?? min)) / tps));
  const roundIdx = replay.rounds.findIndex((r) => r.start_tick === round?.start_tick);
  const killTicks = replay.kills.map((k) => k.tick);
  const marks = round ? roundTimelineMarks(round, tps, { min, max }) : [];
  const freezeAt = round ? freezeWidth(round, { min, max }) : 0;
  const span = max - min;
  const progress = span > 0 ? (Math.min(max, Math.max(min, tick)) - min) / span : 0;

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
        {speed}×
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
            min={min}
            max={max}
            aria-label="Round timeline"
            value={Math.min(max, Math.max(min, tick))}
            onChange={(e) => onTick(Number(e.target.value))}
          />
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
      <span className="clock">
        {round ? (round.is_knife ? "Knife" : `R${round.number}`) : "—"} {clock}
      </span>
    </div>
  );
}
