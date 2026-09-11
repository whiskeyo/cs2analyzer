import { useMessages } from "@/lib/i18n/useMessages";
import { tNodes } from "@/lib/i18n/messages";

export type RemoveKind = "notes" | "playbooks";

export function removeConfirmPhrase(
  kind: RemoveKind,
  phrases?: { notes: string; playbooks: string },
): string {
  const notes = phrases?.notes ?? "yes, remove notes";
  const playbooks = phrases?.playbooks ?? "yes, remove playbooks";
  return kind === "playbooks" ? playbooks : notes;
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
  const { messages } = useMessages();
  const phrase = removeConfirmPhrase(kind, {
    notes: messages.dialog.removeNotesPhrase,
    playbooks: messages.dialog.removePlaybooksPhrase,
  });
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
          {kind === "playbooks"
            ? messages.dialog.removePlaybooksTitle
            : messages.dialog.removeNotesTitle}
        </h2>
        <p>
          {kind === "playbooks"
            ? messages.dialog.removePlaybooksBody
            : messages.dialog.removeNotesBody}
        </p>
        <p>
          {tNodes(messages.dialog.typeToConfirm, {
            phrase: <code>{phrase}</code>,
          })}
        </p>
        <input
          className="remove-notes-input"
          type="text"
          value={confirm}
          autoComplete="off"
          spellCheck={false}
          aria-label={messages.dialog.confirmPhrase}
          onChange={(e) => onConfirmChange(e.target.value)}
        />
        <div className="home-modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            {messages.preferences.cancel}
          </button>
          <button
            type="button"
            className="danger"
            disabled={confirm !== phrase}
            onClick={onConfirm}
          >
            {kind === "playbooks"
              ? messages.dialog.removePlaybooksConfirm
              : messages.dialog.removeNotesConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}
