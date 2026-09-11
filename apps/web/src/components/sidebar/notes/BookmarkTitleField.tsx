import { useRef, useState } from "react";
import { NOTE_GROUP_NAME_MAX } from "@/lib/shared/constants";
import { useMessages } from "@/lib/i18n/useMessages";
import { renameItemText } from "@/lib/notes";
import type { NoteItemRef } from "@/lib/notes/noteGroups";
import type { Note } from "@/lib/notes/types";

export function BookmarkTitleField({
  refItem,
  title,
  note,
  onNote,
}: {
  refItem: NoteItemRef;
  title: string;
  note: Note;
  onNote: (next: Note) => void;
}) {
  const { messages } = useMessages();
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
    onNote(renameItemText(note, refItem, next));
  };

  if (!editing) {
    return (
      <span
        className="review-title"
        title={messages.sidebar.renameHint}
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
      aria-label={messages.sidebar.bookmarkName}
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
