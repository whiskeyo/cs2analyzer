import { memo, useEffect, useMemo, useState } from "react";
import { blockTransportFocus } from "@/lib/playback/transportFocus";
import { tickRate } from "@/lib/shared/constants";
import { activeExecute, findExecutes, type ExecuteBeat } from "@/lib/match/execute";
import { currentRound } from "@/lib/replay/sample";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import type { RoundNote } from "@/lib/notes/types";
import { noteRounds } from "@/lib/notes";
import { ROUND_CHAPTER_LABEL, roundChapter, type RoundChapter } from "@/lib/playback/roundChapter";
import { useSendPlaybackCommand } from "@/lib/playback/playbackCommandContext";
import type { MapPlaces } from "@/lib/match/sites";
import { RoundChapterIcon } from "./RoundChapterIcon";

interface Props {
  replay: Replay;
  tick: number;
  notes: RoundNote[];
  places: MapPlaces | null;
  activeRound?: Round | null;
  /** Tutorial series greys unused rounds; omitted = every chip stays clickable. */
  roundEnabled?: (round: Round) => boolean;
}

export const RoundStrip = memo(function RoundStrip({
  replay,
  tick,
  notes,
  places,
  activeRound,
  roundEnabled,
}: Props) {
  const send = useSendPlaybackCommand();
  const current = activeRound ?? currentRound(replay, tick);
  const [beats, setBeats] = useState<ExecuteBeat[]>([]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled) setBeats(findExecutes(replay, places));
    };
    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(run);
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    const id = window.setTimeout(run, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [replay, places]);

  const actionRounds = new Set(beats.map((b) => b.round));
  const noted = noteRounds(notes);
  const live = activeExecute(beats, tick, tickRate(replay));
  const chapters = useMemo(
    () => replay.rounds.map((round) => roundChapter(replay, round)),
    [replay],
  );
  return (
    <div className="round-strip" role="list">
      {replay.rounds.map((r, index) => {
        const hasAction = !r.is_knife && actionRounds.has(r.number);
        const hasNotes = noted.has(r.number);
        const liveAction = live != null && live.round === r.number;
        const enabled = roundEnabled?.(r) ?? true;
        const chapter = chapters[index] ?? null;
        const title = roundChipTitle(r, chapter, hasAction, hasNotes);
        return (
          <button
            key={r.start_tick}
            type="button"
            tabIndex={-1}
            role="listitem"
            disabled={!enabled}
            data-chapter={chapter ?? undefined}
            className={`rs${current?.start_tick === r.start_tick ? " on" : ""}${hasAction ? " has-action" : ""}${hasNotes ? " has-notes" : ""}${liveAction ? " live-action" : ""}${enabled ? "" : " is-inactive"} ${
              r.winner === "CT" ? "ct" : r.winner === "T" ? "t" : "none"
            }`}
            title={enabled ? title : `${title} · not playable in the tutorial`}
            onMouseDown={blockTransportFocus}
            onClick={() => {
              if (!enabled) return;
              send({ type: "jump", tick: 0, pause: true, round: r });
            }}
          >
            <span className="round-chapter-slot" aria-hidden="true">
              {chapter ? <RoundChapterIcon chapter={chapter} /> : null}
            </span>
            {r.is_knife ? "K" : r.number}
          </button>
        );
      })}
    </div>
  );
});

function roundChipTitle(
  round: Round,
  chapter: RoundChapter | null,
  hasAction: boolean,
  hasNotes: boolean,
): string {
  const parts = [round.is_knife ? "Knife" : `Round ${round.number}`];
  if (chapter && chapter !== "knife") parts.push(ROUND_CHAPTER_LABEL[chapter]);
  if (hasAction) parts.push("execute");
  if (hasNotes) parts.push("notes");
  return parts.join(" · ");
}
