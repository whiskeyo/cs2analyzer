import { useMemo } from "react";
import { eventElement } from "@/lib/notes/drag";
import { notesByRound } from "@/lib/notes";
import { useNoteDrag } from "@/lib/notes/useNoteDrag";
import { useNoteSelection } from "@/lib/notes/useNoteSelection";
import { NoteActions } from "./notes/NoteActions";
import { NoteRoundList } from "./notes/NoteRoundList";
import { useNoteMoments } from "./notes/useNoteMoments";
import type { Replay } from "@/lib/replay/replayTypes";
import type { Stroke } from "@/lib/notes/types";

interface Props {
  replay: Replay;
  tick: number;
  strokes: Stroke[];
  onJump: (tick: number) => void;
  onStrokes: (next: Stroke[]) => void;
}

export function Notes({ replay, tick, strokes, onJump, onStrokes }: Props) {
  const rounds = useMemo(() => notesByRound(strokes), [strokes]);
  const { selected, canGroup, canUngroup, toggle, toggleAll, clearSelection } =
    useNoteSelection(strokes);
  const {
    dragging,
    dropOn,
    downOnRef,
    skipClick,
    startDrag,
    markDrag,
    endDrag,
    dropAt,
    allowDrop,
  } = useNoteDrag({ strokes, onStrokes, clearSelection });
  const { tps, setEdge, setClock, clearWindow } = useNoteMoments({
    replay,
    tick,
    strokes,
    onStrokes,
  });

  if (rounds.length === 0) {
    return (
      <p className="muted tab-hint">
        Draw or add a text box on the radar. Use Moment to time it. Squash drawings into a layer so
        the list stays short.
      </p>
    );
  }

  return (
    <div
      className={`review${dragging ? " notes-dragging" : ""}`}
      onPointerDownCapture={(e) => {
        downOnRef.current = eventElement(e.target) ?? e.target;
      }}
    >
      <p className="tab-hint">
        Drag a layer or a note. Drop on the top slot to ungroup, on the bottom slot to make a new
        group, or onto a layer box to add it there. Double-click a layer or bookmark name to rename.
        Start/End clocks use the arrows (0:59 then 1:00). Double-click a clock to pin it to the
        playhead. The eye hides a map note or a timeline bookmark.
      </p>
      <NoteActions
        strokes={strokes}
        selected={selected}
        canGroup={canGroup}
        canUngroup={canUngroup}
        onStrokes={onStrokes}
        onClearSelection={clearSelection}
      />
      <NoteRoundList
        replay={replay}
        rounds={rounds}
        strokes={strokes}
        selected={selected}
        dragging={dragging}
        dropOn={dropOn}
        skipClick={skipClick}
        tps={tps}
        onJump={onJump}
        onStrokes={onStrokes}
        toggle={toggle}
        toggleAll={toggleAll}
        startDrag={startDrag}
        markDrag={markDrag}
        endDrag={endDrag}
        dropAt={dropAt}
        allowDrop={allowDrop}
        setEdge={setEdge}
        setClock={setClock}
        clearWindow={clearWindow}
      />
    </div>
  );
}
