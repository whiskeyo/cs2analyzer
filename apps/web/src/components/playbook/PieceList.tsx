import type { Note } from "@/lib/notes/types";
import { overlayRows } from "@/lib/playbook/overlay";

interface Props {
  note: Note;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}

export function PieceList({ note, selectedId, onSelect, onRename, onRemove }: Props) {
  const rows = overlayRows(note);
  if (rows.length === 0) {
    return <p className="muted">Nothing on the radar yet. Pick a token or snapshot a round.</p>;
  }
  return (
    <ul className="playbook-pieces">
      {rows.map((row) => {
        const piece = row.piece;
        if (piece) {
          const name = row.detail ?? row.label;
          return (
            <li key={row.id} className="playbook-piece">
              <button
                type="button"
                className={piece.id === selectedId ? "playbook-book is-active" : "playbook-book"}
                onClick={() => onSelect(piece.id)}
              >
                {row.label}
              </button>
              <input
                aria-label={`Label ${name}`}
                placeholder={name}
                value={piece.label ?? ""}
                onChange={(e) => onRename(piece.id, e.target.value)}
              />
              <button
                type="button"
                className="ghost"
                aria-label={`Remove ${name}`}
                onClick={() => onRemove(row.id)}
              >
                Delete
              </button>
            </li>
          );
        }
        const name = row.detail ? `${row.label} (${row.detail})` : row.label;
        return (
          <li key={row.id} className="playbook-piece playbook-piece-mark">
            <span className="playbook-overlay-label">{name}</span>
            <button
              type="button"
              className="ghost"
              aria-label={`Remove ${name}`}
              onClick={() => onRemove(row.id)}
            >
              Delete
            </button>
          </li>
        );
      })}
    </ul>
  );
}
