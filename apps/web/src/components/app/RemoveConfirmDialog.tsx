const REMOVE_NOTES_CONFIRM = "yes, remove notes";
const REMOVE_PLAYBOOKS_CONFIRM = "yes, remove playbooks";

export type RemoveKind = "notes" | "playbooks";

export function removeConfirmPhrase(kind: RemoveKind): string {
  return kind === "playbooks" ? REMOVE_PLAYBOOKS_CONFIRM : REMOVE_NOTES_CONFIRM;
}

export function RemoveConfirmDialog({
  kind,
  confirm,
  titleId,
  onConfirmChange,
  onCancel,
  onConfirm,
}: {
  kind: RemoveKind;
  confirm: string;
  titleId: string;
  onConfirmChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const phrase = removeConfirmPhrase(kind);
  return (
    <div className="home-modal" onClick={onCancel}>
      <div
        className="home-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>
          {kind === "playbooks" ? "Remove all playbooks?" : "Remove all saved notes?"}
        </h2>
        <p>
          {kind === "playbooks"
            ? "This deletes every playbook stored in this browser. Export a JSON backup first if you might need them later."
            : "This deletes every drawing project stored in this browser. Export a JSON backup first if you might need them later."}
        </p>
        <p>
          Type <code>{phrase}</code> to confirm.
        </p>
        <input
          className="remove-notes-input"
          type="text"
          value={confirm}
          autoComplete="off"
          spellCheck={false}
          aria-label="Confirmation phrase"
          onChange={(e) => onConfirmChange(e.target.value)}
        />
        <div className="home-modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="danger"
            disabled={confirm !== phrase}
            onClick={onConfirm}
          >
            {kind === "playbooks" ? "Remove all playbooks" : "Remove all notes"}
          </button>
        </div>
      </div>
    </div>
  );
}
