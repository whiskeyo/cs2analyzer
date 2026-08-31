import { useRef, useState } from "react";
import { NOTE_GROUP_NAME_MAX } from "@/lib/shared/constants";
import { renameStrokeText } from "@/lib/notes";
import type { Stroke } from "@/lib/notes/types";

export function BookmarkTitleField({
  index,
  title,
  strokes,
  onStrokes,
}: {
  index: number;
  title: string;
  strokes: Stroke[];
  onStrokes: (next: Stroke[]) => void;
}) {
  const [draft, setDraft] = useState(title);
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
    if (!next || next === title) {
      setDraft(title);
      return;
    }
    onStrokes(renameStrokeText(strokes, index, next));
  };

  if (!editing) {
    return (
      <span
        className="review-title"
        title="Double-click to rename"
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setDraft(title);
          setEditing(true);
        }}
      >
        {title}
      </span>
    );
  }

  return (
    <input
      className="note-group-name"
      value={draft}
      maxLength={NOTE_GROUP_NAME_MAX}
      aria-label="Bookmark name"
      draggable={false}
      autoFocus
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          skipBlur.current = true;
          setDraft(title);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
