import { useEffect, useRef } from "react";

export type TreeMenuTarget =
  | { kind: "map"; mapName: string }
  | {
      kind: "book";
      mapName: string;
      bookKey: string;
      title: string;
      index: number;
      last: boolean;
    }
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
  onExportPdf: (bookKey: string) => void;
  onDuplicateStrat: (bookKey: string, pageId: string) => void;
  onDeleteBook: (bookKey: string) => void;
  onDeleteStrat: (bookKey: string, pageId: string) => void;
  onMoveBook: (bookKey: string, toIndex: number) => void;
  onMoveStrat: (bookKey: string, pageId: string, toIndex: number) => void;
  sandbox?: boolean;
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
  onExportPdf,
  onDuplicateStrat,
  onDeleteBook,
  onDeleteStrat,
  onMoveBook,
  onMoveStrat,
  sandbox = false,
}: Props) {
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
      ? sandbox
        ? []
        : [
            {
              label: "New playbook",
              onSelect: () => onNewPlaybook(target.mapName),
            },
          ]
      : target.kind === "book"
        ? sandbox
          ? [
              {
                label: "New strat",
                onSelect: () => onNewStrat(target.bookKey),
              },
              { label: "Rename", onSelect: () => onRenameBook(target.bookKey) },
            ]
          : [
              {
                label: "New strat",
                onSelect: () => onNewStrat(target.bookKey),
              },
              { label: "Rename", onSelect: () => onRenameBook(target.bookKey) },
              {
                label: "Duplicate playbook",
                onSelect: () => onDuplicateBook(target.bookKey),
              },
              {
                label: "Export PDF",
                onSelect: () => onExportPdf(target.bookKey),
              },
              {
                label: "Move up",
                disabled: target.index === 0,
                onSelect: () => onMoveBook(target.bookKey, target.index - 1),
              },
              {
                label: "Move down",
                disabled: target.last,
                onSelect: () => onMoveBook(target.bookKey, target.index + 1),
              },
              {
                label: "Delete playbook",
                danger: true,
                onSelect: () => onDeleteBook(target.bookKey),
              },
            ]
        : sandbox
          ? [
              {
                label: "New strat",
                onSelect: () => onNewStrat(target.bookKey),
              },
              {
                label: "Rename",
                onSelect: () => onRenameStrat(target.bookKey, target.pageId),
              },
            ]
          : [
              {
                label: "New strat",
                onSelect: () => onNewStrat(target.bookKey),
              },
              {
                label: "Rename",
                onSelect: () => onRenameStrat(target.bookKey, target.pageId),
              },
              {
                label: "Duplicate strat",
                onSelect: () => onDuplicateStrat(target.bookKey, target.pageId),
              },
              {
                label: "Move up",
                disabled: target.index === 0,
                onSelect: () => onMoveStrat(target.bookKey, target.pageId, target.index - 1),
              },
              {
                label: "Move down",
                disabled: target.last,
                onSelect: () => onMoveStrat(target.bookKey, target.pageId, target.index + 1),
              },
              {
                label: "Delete strat",
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
