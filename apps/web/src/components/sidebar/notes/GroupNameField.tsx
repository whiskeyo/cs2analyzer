import { NOTE_GROUP_NAME_MAX } from "@/lib/shared/constants";
import { useEditableName } from "@/lib/shared/useEditableName";
import { groupLabel, renameGroup } from "@/lib/notes";
import type { Stroke } from "@/lib/notes/types";

export function GroupNameField({
  groupId,
  strokes,
  onStrokes,
}: {
  groupId: string;
  strokes: Stroke[];
  onStrokes: (next: Stroke[]) => void;
}) {
  const shown = groupLabel(groupId);
  const { draft, editing, beginEdit, setDraft, commit, onKeyDown } = useEditableName(
    shown,
    (next) => onStrokes(renameGroup(strokes, groupId, next)),
    [groupId],
  );

  if (!editing) {
    return (
      <span
        className="note-group-name"
        title="Double-click to rename"
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          beginEdit();
        }}
      >
        {shown}
      </span>
    );
  }

  return (
    <input
      className="note-group-name"
      value={draft}
      maxLength={NOTE_GROUP_NAME_MAX}
      aria-label="Layer name"
      draggable={false}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}
