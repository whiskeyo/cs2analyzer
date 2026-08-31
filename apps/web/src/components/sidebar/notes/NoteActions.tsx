import { groupStrokes, squashStrokes, ungroupStrokes } from "@/lib/notes";
import type { Stroke } from "@/lib/notes/types";

export function NoteActions({
  strokes,
  selected,
  canGroup,
  canUngroup,
  onStrokes,
  onClearSelection,
}: {
  strokes: Stroke[];
  selected: number[];
  canGroup: boolean;
  canUngroup: boolean;
  onStrokes: (next: Stroke[]) => void;
  onClearSelection: () => void;
}) {
  return (
    <div className="notes-actions">
      <button
        type="button"
        disabled={!canGroup}
        onClick={() => {
          onStrokes(squashStrokes(strokes, selected));
          onClearSelection();
        }}
      >
        Squash
      </button>
      <button
        type="button"
        disabled={!canGroup}
        onClick={() => {
          onStrokes(groupStrokes(strokes, selected));
          onClearSelection();
        }}
      >
        Group
      </button>
      <button
        type="button"
        disabled={!canUngroup}
        onClick={() => {
          onStrokes(ungroupStrokes(strokes, selected));
          onClearSelection();
        }}
      >
        Ungroup
      </button>
    </div>
  );
}
