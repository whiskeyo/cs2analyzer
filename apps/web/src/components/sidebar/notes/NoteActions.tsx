import { groupItems, squashItems, ungroupRefs } from "@/lib/notes";
import { updateRoundNote } from "@/lib/notes/roundNotes";
import type { NotePick } from "@/lib/notes/drag";
import type { RoundNote } from "@/lib/notes/types";

export function NoteActions({
  notes,
  selected,
  canGroup,
  canUngroup,
  onNotes,
  onClearSelection,
}: {
  notes: RoundNote[];
  selected: NotePick[];
  canGroup: boolean;
  canUngroup: boolean;
  onNotes: (next: RoundNote[]) => void;
  onClearSelection: () => void;
}) {
  const applyRound = (
    fn: (note: RoundNote["note"], refs: NotePick["ref"][]) => RoundNote["note"],
  ) => {
    const round = selected[0]?.round;
    if (round == null) return;
    const refs = selected.filter((pick) => pick.round === round).map((pick) => pick.ref);
    onNotes(updateRoundNote(notes, round, (note) => fn(note, refs)));
    onClearSelection();
  };

  return (
    <div className="notes-actions">
      <button
        type="button"
        disabled={!canGroup}
        onClick={() => applyRound((note, refs) => squashItems(note, refs))}
      >
        Squash
      </button>
      <button
        type="button"
        disabled={!canGroup}
        onClick={() => applyRound((note, refs) => groupItems(note, refs))}
      >
        Group
      </button>
      <button
        type="button"
        disabled={!canUngroup}
        onClick={() => applyRound((note, refs) => ungroupRefs(note, refs))}
      >
        Ungroup
      </button>
    </div>
  );
}
