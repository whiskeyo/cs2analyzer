import { useMemo } from "react";
import { useMessages } from "@/lib/i18n";
import { eventElement } from "@/lib/notes/drag";
import { notesByRound } from "@/lib/notes";
import { useUserSettings } from "@/lib/settings/useUserSettings";
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
  const { messages } = useMessages();
  const { settings } = useUserSettings();
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
    momentSec: settings.noteMomentSec,
  });

  if (rounds.length === 0) {
    return <p className="muted tab-hint">{messages.sidebar.notesEmpty}</p>;
  }

  return (
    <div
      className={`review${dragging ? " notes-dragging" : ""}`}
      onPointerDownCapture={(e) => {
        downOnRef.current = eventElement(e.target) ?? e.target;
      }}
    >
      <p className="tab-hint">{messages.sidebar.notesUsage}</p>
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
