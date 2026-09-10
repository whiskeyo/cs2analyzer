import { useMemo } from "react";
import { eventElement } from "@/lib/notes/drag";
import { notesByRound } from "@/lib/notes";
import { useNoteDrag } from "@/lib/notes/useNoteDrag";
import { useNoteSelection } from "@/lib/notes/useNoteSelection";
import { NoteActions } from "./notes/NoteActions";
import { NoteRoundList } from "./notes/NoteRoundList";
import { useNoteMoments } from "./notes/useNoteMoments";
import type { Replay } from "@/lib/replay/replayTypes";
import type { RoundNote } from "@/lib/notes/types";

interface Props {
  replay: Replay;
  tick: number;
  notes: RoundNote[];
  onJump: (tick: number) => void;
  onNotes: (next: RoundNote[]) => void;
}

export function Notes({ replay, tick, notes, onJump, onNotes }: Props) {
  const rounds = useMemo(() => notesByRound(notes), [notes]);
  const { selected, canGroup, canUngroup, toggle, toggleAll, clearSelection } =
    useNoteSelection(notes);
  const {
    dragging,
    dropOn,
    downOnRef,
    skipClickRef,
    startDrag,
    markDrag,
    endDrag,
    dropAt,
    allowDrop,
  } = useNoteDrag({ notes, onNotes, clearSelection });
  const { tps, setEdge, setClock, clearWindow } = useNoteMoments({
    replay,
    tick,
    notes,
    onNotes,
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
        notes={notes}
        selected={selected}
        canGroup={canGroup}
        canUngroup={canUngroup}
        onNotes={onNotes}
        onClearSelection={clearSelection}
      />
      <NoteRoundList
        replay={replay}
        rounds={rounds}
        selected={selected}
        dragging={dragging}
        dropOn={dropOn}
        skipClickRef={skipClickRef}
        tps={tps}
        onJump={onJump}
        onNotes={onNotes}
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
