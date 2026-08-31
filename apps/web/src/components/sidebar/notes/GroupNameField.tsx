import { useRef, useState } from "react";
import { NOTE_GROUP_NAME_MAX } from "@/lib/shared/constants";
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
  const [draft, setDraft] = useState(shown);
  const [editing, setEditing] = useState(false);
  const skipBlur = useRef(false);

  const commit = () => {
    if (skipBlur.current) {
      skipBlur.current = false;
      setEditing(false);
      return;
    }
    const next = draft.trim();
    setEditing(false);
    if (!next) {
      setDraft(shown);
      return;
    }
    if (next === groupId || next === shown) {
      setDraft(shown);
      return;
    }
    onStrokes(renameGroup(strokes, groupId, next));
  };

  if (!editing) {
    return (
      <span
        className="note-group-name"
        title="Double-click to rename"
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setDraft(shown);
          setEditing(true);
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
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          skipBlur.current = true;
          setDraft(shown);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
