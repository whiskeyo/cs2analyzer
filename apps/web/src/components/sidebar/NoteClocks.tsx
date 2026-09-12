import { NOTE_MOMENT_STEP_SECONDS } from "@/lib/shared/constants";
import { useMessages } from "@/lib/i18n";
import { roundClock } from "@/lib/match/roundEvents";
import { roundScrubRange } from "@/lib/playback/roundTimeline";
import type { Replay, Round } from "@/lib/replay/replayTypes";

export function roundWindowEnd(rnd: Round | undefined, replay: Replay): number {
  const fallback =
    replay.header.playback_ticks || replay.ticks.ticks[replay.ticks.ticks.length - 1] || 0;
  return roundScrubRange(rnd, replay.rounds, {
    min: rnd?.start_tick ?? 0,
    max: fallback,
  }).max;
}

function MomentEdgeField({
  label,
  seconds,
  maxSeconds,
  clock,
  onChange,
  onPlayhead,
}: {
  label: string;
  seconds: number;
  maxSeconds: number;
  clock: string;
  onChange: (seconds: number) => void;
  onPlayhead: () => void;
}) {
  const { messages, t } = useMessages();
  const sec = Math.round(seconds);
  const cap = maxSeconds > 0 ? maxSeconds : Number.POSITIVE_INFINITY;
  const nudge = (dir: number) => {
    onChange(Math.min(cap, Math.max(0, sec + dir * NOTE_MOMENT_STEP_SECONDS)));
  };
  return (
    <span className="note-edge">
      <span className="note-edge-label">{label}</span>
      <span className="note-clock">
        <button
          type="button"
          className="note-clock-read"
          title={t(messages.sidebar.clockPlayhead, { clock })}
          onDoubleClick={(e) => {
            e.preventDefault();
            onPlayhead();
          }}
        >
          {clock}
        </button>
        <span className="note-clock-spin">
          <button
            type="button"
            aria-label={t(messages.sidebar.clockLater, { label })}
            title={t(messages.sidebar.clockLater, { label })}
            onClick={() => nudge(1)}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={t(messages.sidebar.clockEarlier, { label })}
            title={t(messages.sidebar.clockEarlier, { label })}
            onClick={() => nudge(-1)}
          >
            ▼
          </button>
        </span>
      </span>
    </span>
  );
}

export function MomentInOut({
  win,
  round,
  tps,
  roundEndTick,
  onSetEdge,
  onClear,
  onClockEdge,
}: {
  win: { start: number; end: number } | null;
  round: Round | undefined;
  tps: number;
  roundEndTick: number;
  onSetEdge: (edge: "start" | "end") => void;
  onClear: () => void;
  onClockEdge: (edge: "start" | "end", seconds: number) => void;
}) {
  const origin = round ? round.freeze_end_tick || round.start_tick : 0;
  const start = win?.start ?? origin;
  const end = win?.end ?? (roundEndTick > origin ? roundEndTick : origin);
  const maxSeconds = tps > 0 && roundEndTick > origin ? (roundEndTick - origin) / tps : 0;
  const startSec = tps > 0 ? Math.max(0, (start - origin) / tps) : 0;
  const endSec = tps > 0 ? Math.max(0, (end - origin) / tps) : 0;
  const { messages } = useMessages();
  return (
    <span className="note-io">
      <MomentEdgeField
        label={messages.sidebar.clockStart}
        seconds={startSec}
        maxSeconds={maxSeconds}
        clock={round ? roundClock(round, start, tps) : messages.sidebar.clockIn}
        onChange={(seconds) => onClockEdge("start", seconds)}
        onPlayhead={() => onSetEdge("start")}
      />
      <MomentEdgeField
        label={messages.sidebar.clockEnd}
        seconds={endSec}
        maxSeconds={maxSeconds}
        clock={round ? roundClock(round, end, tps) : messages.sidebar.clockOut}
        onChange={(seconds) => onClockEdge("end", seconds)}
        onPlayhead={() => onSetEdge("end")}
      />
      {win && (
        <button type="button" title={messages.sidebar.clockWholeRound} onClick={onClear}>
          {messages.sidebar.clockRoundBtn}
        </button>
      )}
    </span>
  );
}
