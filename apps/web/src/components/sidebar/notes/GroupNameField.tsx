import { NOTE_GROUP_NAME_MAX } from "@/lib/shared/constants";
import { useEditableName } from "@/lib/shared/useEditableName";
import { groupLabel, renameGroup } from "@/lib/notes";
import type { Note } from "@/lib/notes/types";

export function GroupNameField({
  groupIndex,
  groupName,
  note,
  onNote,
}: {
  groupIndex: number;
  groupName: string;
  note: Note;
  onNote: (next: Note) => void;
}) {
  const shown = groupLabel(groupName);
  const { draft, editing, beginEdit, setDraft, commit, onKeyDown } = useEditableName(
    shown,
    (next) => onNote(renameGroup(note, groupIndex, next)),
    [groupName],
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
