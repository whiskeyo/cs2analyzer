import { useMessages } from "@/lib/i18n/useMessages";
import type { Note } from "@/lib/notes/types";
import { overlayRowGroupId, overlayRows, type OverlayRow } from "@/lib/playbook/overlay";

interface Props {
  note: Note;
  selectedId: string | null;
  picked: ReadonlySet<string>;
  onTogglePick: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
  onRenameGroup: (groupId: string, name: string) => void;
  onToggleGroup: (groupId: string, hidden: boolean) => void;
  onUngroup: (groupId: string) => void;
}

function OverlayItem({
  row,
  selectedId,
  picked,
  onTogglePick,
  onSelect,
  onRename,
  onRemove,
}: {
  row: OverlayRow;
  selectedId: string | null;
  picked: ReadonlySet<string>;
  onTogglePick: (id: string) => void;
  onSelect: (id: string) => void;
  onRename: (id: string, label: string) => void;
  onRemove: (id: string) => void;
}) {
  const { messages, t } = useMessages();
  const piece = row.piece;
  if (piece) {
    const name = row.detail ?? row.label;
    return (
      <li className="playbook-piece">
        <input
          type="checkbox"
          aria-label={t(messages.sidebar.selectNamed, { name })}
          checked={picked.has(row.id)}
          onChange={() => onTogglePick(row.id)}
        />
        <button
          type="button"
          className={piece.id === selectedId ? "playbook-book is-active" : "playbook-book"}
          onClick={() => onSelect(piece.id)}
        >
          {row.label}
        </button>
        <input
          aria-label={t(messages.playbook.labelNamed, { name })}
          placeholder={name}
          value={piece.label ?? ""}
          onChange={(e) => onRename(piece.id, e.target.value)}
        />
        <button
          type="button"
          className="ghost"
          aria-label={t(messages.playbook.removeNamed, { name })}
          onClick={() => onRemove(row.id)}
        >
          {messages.drop.deleteNotes}
        </button>
      </li>
    );
  }
  const name = row.detail ? `${row.label} (${row.detail})` : row.label;
  return (
    <li className="playbook-piece playbook-piece-mark">
      <input
        type="checkbox"
        aria-label={t(messages.sidebar.selectNamed, { name })}
        checked={picked.has(row.id)}
        onChange={() => onTogglePick(row.id)}
      />
      <span className="playbook-overlay-label">{name}</span>
      <button
        type="button"
        className="ghost"
        aria-label={t(messages.playbook.removeNamed, { name })}
        onClick={() => onRemove(row.id)}
      >
        {messages.drop.deleteNotes}
      </button>
    </li>
  );
}

export function PieceList({
  note,
  selectedId,
  picked,
  onTogglePick,
  onSelect,
  onRename,
  onRemove,
  onRenameGroup,
  onToggleGroup,
  onUngroup,
}: Props) {
  const { messages, t } = useMessages();
  const rows = overlayRows(note);
  if (rows.length === 0 && note.groups.length === 0) {
    return <p className="muted">{messages.playbook.overlayEmpty}</p>;
  }
  const itemProps = { selectedId, picked, onTogglePick, onSelect, onRename, onRemove };
  const ungrouped = rows.filter((row) => overlayRowGroupId(row) == null);
  return (
    <div className="playbook-overlay">
      {note.groups.map((group) => {
        const members = rows.filter((row) => overlayRowGroupId(row) === group.id);
        return (
          <div key={group.id} className="playbook-group">
            <div className="playbook-group-head">
              <label className="playbook-group-name">
                <span className="visually-hidden">{messages.playbook.groupName}</span>
                <input
                  aria-label={t(messages.playbook.groupNamed, { name: group.name })}
                  value={group.name}
                  onChange={(e) => onRenameGroup(group.id, e.target.value)}
                />
              </label>
              <button
                type="button"
                className="ghost"
                aria-pressed={group.hidden !== true}
                aria-label={
                  group.hidden
                    ? t(messages.playbook.showNamed, { name: group.name })
                    : t(messages.playbook.hideNamed, { name: group.name })
                }
                onClick={() => onToggleGroup(group.id, group.hidden !== true)}
              >
                {group.hidden ? messages.playbook.hidden : messages.playbook.shown}
              </button>
              <button
                type="button"
                className="ghost"
                aria-label={t(messages.playbook.ungroupNamed, { name: group.name })}
                onClick={() => onUngroup(group.id)}
              >
                {messages.sidebar.ungroup}
              </button>
            </div>
            {members.length > 0 ? (
              <ul className="playbook-pieces playbook-group-items">
                {members.map((row) => (
                  <OverlayItem key={row.id} row={row} {...itemProps} />
                ))}
              </ul>
            ) : null}
          </div>
        );
      })}
      {ungrouped.length > 0 ? (
        <ul className="playbook-pieces">
          {ungrouped.map((row) => (
            <OverlayItem key={row.id} row={row} {...itemProps} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}
