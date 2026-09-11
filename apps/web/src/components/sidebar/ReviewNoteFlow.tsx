import { useMemo, useState } from "react";
import { useMessages } from "@/lib/i18n/useMessages";
import { sortReviewNotes, type ReviewNote, type ReviewNoteSort } from "@/lib/match/review";

function noteClass(severity: string, pending: boolean): string {
  return `review-note ${severity}${pending ? " pending" : ""}`.trim();
}

interface Props<T extends ReviewNote> {
  notes: T[];
  pendingAtTick?: number;
  onJump: (note: T) => void;
}

/** Flat note list like Utility/Action: round order, or worst-first severity. */
export function ReviewNoteFlow<T extends ReviewNote>({ notes, pendingAtTick, onJump }: Props<T>) {
  const { messages } = useMessages();
  const [sort, setSort] = useState<ReviewNoteSort>("round");
  const rows = useMemo(() => sortReviewNotes(notes, sort), [notes, sort]);

  if (notes.length === 0) return null;

  return (
    <>
      <div className="filters" role="toolbar" aria-label={messages.sidebar.reviewSort}>
        <button
          type="button"
          className={`filter${sort === "round" ? " on" : ""}`}
          onClick={() => setSort("round")}
        >
          {messages.sidebar.sortRound}
        </button>
        <button
          type="button"
          className={`filter${sort === "severity" ? " on" : ""}`}
          onClick={() => setSort("severity")}
        >
          {messages.sidebar.sortSeverity}
        </button>
      </div>
      <ul className="review-notes">
        {rows.map((note, i) => (
          <li key={`${note.tick}-${note.title}-${i}`}>
            <button
              type="button"
              className={noteClass(
                note.severity,
                pendingAtTick != null && note.tick > pendingAtTick,
              )}
              onClick={() => onJump(note)}
            >
              <span className="pill review-round">{note.roundLabel}</span>
              <span className="review-copy">
                <span className="review-title">{note.title}</span>
                <span className="review-detail">{note.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
