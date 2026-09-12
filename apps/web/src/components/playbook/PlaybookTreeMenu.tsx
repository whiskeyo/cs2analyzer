import { useEffect, useRef } from "react";
import { useMessages } from "@/lib/i18n";
export type TreeMenuTarget =
  | { kind: "map"; mapName: string }
  | { kind: "book"; mapName: string; bookKey: string; title: string; index: number; last: boolean }
  | {
      kind: "strat";
      mapName: string;
      bookKey: string;
      pageId: string;
      title: string;
      index: number;
      last: boolean;
    };

interface Item {
  label: string;
  disabled?: boolean;
  danger?: boolean;
  onSelect: () => void;
}

interface Props {
  target: TreeMenuTarget;
  x: number;
  y: number;
  onClose: () => void;
  onNewPlaybook: (mapName: string) => void;
  onNewStrat: (bookKey: string) => void;
  onRenameBook: (bookKey: string) => void;
  onRenameStrat: (bookKey: string, pageId: string) => void;
  onDuplicateBook: (bookKey: string) => void;
  onDuplicateStrat: (bookKey: string, pageId: string) => void;
  onDeleteBook: (bookKey: string) => void;
  onDeleteStrat: (bookKey: string, pageId: string) => void;
  onMoveBook: (bookKey: string, toIndex: number) => void;
  onMoveStrat: (bookKey: string, pageId: string, toIndex: number) => void;
}

export function PlaybookTreeMenu({
  target,
  x,
  y,
  onClose,
  onNewPlaybook,
  onNewStrat,
  onRenameBook,
  onRenameStrat,
  onDuplicateBook,
  onDuplicateStrat,
  onDeleteBook,
  onDeleteStrat,
  onMoveBook,
  onMoveStrat,
}: Props) {
  const { messages } = useMessages();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const items: Item[] =
    target.kind === "map"
      ? [{ label: messages.playbook.menuNewBook, onSelect: () => onNewPlaybook(target.mapName) }]
      : target.kind === "book"
        ? [
            { label: messages.playbook.menuNewStrat, onSelect: () => onNewStrat(target.bookKey) },
            { label: messages.playbook.menuRename, onSelect: () => onRenameBook(target.bookKey) },
            {
              label: messages.playbook.menuDuplicateBook,
              onSelect: () => onDuplicateBook(target.bookKey),
            },
            {
              label: messages.playbook.menuMoveUp,
              disabled: target.index === 0,
              onSelect: () => onMoveBook(target.bookKey, target.index - 1),
            },
            {
              label: messages.playbook.menuMoveDown,
              disabled: target.last,
              onSelect: () => onMoveBook(target.bookKey, target.index + 1),
            },
            {
              label: messages.playbook.menuDeleteBook,
              danger: true,
              onSelect: () => onDeleteBook(target.bookKey),
            },
          ]
        : [
            { label: messages.playbook.menuNewStrat, onSelect: () => onNewStrat(target.bookKey) },
            {
              label: messages.playbook.menuRename,
              onSelect: () => onRenameStrat(target.bookKey, target.pageId),
            },
            {
              label: messages.playbook.menuDuplicateStrat,
              onSelect: () => onDuplicateStrat(target.bookKey, target.pageId),
            },
            {
              label: messages.playbook.menuMoveUp,
              disabled: target.index === 0,
              onSelect: () => onMoveStrat(target.bookKey, target.pageId, target.index - 1),
            },
            {
              label: messages.playbook.menuMoveDown,
              disabled: target.last,
              onSelect: () => onMoveStrat(target.bookKey, target.pageId, target.index + 1),
            },
            {
              label: messages.playbook.menuDeleteStrat,
              danger: true,
              onSelect: () => onDeleteStrat(target.bookKey, target.pageId),
            },
          ];

  return (
    <div
      ref={ref}
      className="playbook-tree-menu"
      role="menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          className={item.danger ? "is-danger" : undefined}
          disabled={item.disabled}
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
