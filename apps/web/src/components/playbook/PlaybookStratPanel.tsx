import { PieceList } from "@/components/playbook/PieceList";
import type { Note } from "@/lib/notes/types";
import { removeOverlay } from "@/lib/playbook/overlay";
import { setPieceLabel } from "@/lib/playbook/pieces";

interface Props {
  stratTitle: string;
  body: string;
  selectedId: string | null;
  onBody: (body: string) => void;
  onSelect: (id: string | null) => void;
  onNote: (note: Note) => void;
  note: Note;
  onNewStrat: () => void;
  onDuplicateStrat: () => void;
  onDeleteStrat: () => void;
  onDeletePlaybook: () => void;
}

export function PlaybookStratPanel({
  stratTitle,
  body,
  selectedId,
  onBody,
  onSelect,
  onNote,
  note,
  onNewStrat,
  onDuplicateStrat,
  onDeleteStrat,
  onDeletePlaybook,
}: Props) {
  return (
    <>
      <h2>Strat</h2>
      <p className="playbook-lead">{stratTitle}</p>
      <div className="playbook-strat-actions">
        <button type="button" className="ghost" onClick={onNewStrat}>
          New strat
        </button>
        <button type="button" className="ghost" onClick={onDuplicateStrat}>
          Duplicate strat
        </button>
        <button type="button" className="ghost" onClick={onDeleteStrat}>
          Delete strat
        </button>
        <button type="button" className="ghost" onClick={onDeletePlaybook}>
          Delete playbook
        </button>
      </div>
      <label className="playbook-field">
        Strat notes
        <textarea
          aria-label="Strat notes"
          rows={5}
          value={body}
          placeholder="Callouts, timings, utility…"
          onChange={(e) => onBody(e.target.value)}
        />
      </label>
      <div className="playbook-tokens">
        <p className="playbook-strats-label">On radar</p>
        <PieceList
          note={note}
          selectedId={selectedId}
          onSelect={onSelect}
          onRename={(id, label) => onNote(setPieceLabel(note, id, label))}
          onRemove={(id) => {
            const pieceId = id.startsWith("piece:") ? id.slice("piece:".length) : null;
            onNote(removeOverlay(note, id));
            if (pieceId && selectedId === pieceId) onSelect(null);
          }}
        />
      </div>
    </>
  );
}
