import type { Piece } from "@/lib/notes/types";
import { pieceKindLabel, pieceLabel } from "@/lib/playbook/pieces";

interface Props {
  pieces: readonly Piece[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}

export function PieceList({ pieces, selectedId, onSelect, onRename, onRemove }: Props) {
  if (pieces.length === 0) {
    return <p className="muted">No tokens yet. Pick one and click the radar.</p>;
  }
  return (
    <ul className="playbook-pieces">
      {pieces.map((piece) => {
        const name = pieceLabel(piece);
        return (
          <li key={piece.id} className="playbook-piece">
            <button
              type="button"
              className={piece.id === selectedId ? "playbook-book is-active" : "playbook-book"}
              onClick={() => onSelect(piece.id)}
            >
              {pieceKindLabel(piece.kind)}
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
              onClick={() => onRemove(piece.id)}
            >
              Delete
            </button>
          </li>
        );
      })}
    </ul>
  );
}
