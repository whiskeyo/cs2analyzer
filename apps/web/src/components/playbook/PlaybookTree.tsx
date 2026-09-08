import { useState } from "react";
import type { KeyboardEvent, MouseEvent } from "react";
import type { Playbook } from "@/lib/playbook/types";
import { groupPlaybooksByMap, mapsForTree, treeGuide } from "@/lib/playbook/tree";
import { prettyMap } from "@/lib/weapons/weapons";

type RenameTarget =
  | { kind: "book"; key: string; value: string }
  | { kind: "page"; key: string; pageId: string; value: string };

interface Props {
  mapNames: string[];
  books: Playbook[];
  mapName: string | null;
  activeKey: string | null;
  activePageId: string | null;
  expandedBooks: ReadonlySet<string>;
  collapsedMaps: ReadonlySet<string>;
  onSelectMap: (mapName: string) => void;
  onToggleMap: (mapName: string) => void;
  onOpenBook: (book: Playbook) => void;
  onToggleBook: (bookKey: string) => void;
  onSelectStrat: (book: Playbook, pageId: string) => void;
  onCommitBookTitle: (book: Playbook, title: string) => void;
  onCommitStratTitle: (book: Playbook, pageId: string, title: string) => void;
  onMoveBook: (book: Playbook, delta: -1 | 1) => void;
  onMoveStrat: (book: Playbook, pageId: string, delta: -1 | 1) => void;
}

function TreeIcon({ kind }: { kind: "map" | "book" | "strat" }) {
  if (kind === "map") {
    return (
      <svg className="playbook-tree-icon" viewBox="0 0 16 16" aria-hidden>
        <path
          fill="currentColor"
          d="M2 3.2 6 2l4 1.4L14 2v10.8L10 14l-4-1.4L2 14zM6 3.4v8.4m4-7.6v8.4"
          fillOpacity="0"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (kind === "book") {
    return (
      <svg className="playbook-tree-icon" viewBox="0 0 16 16" aria-hidden>
        <path
          fill="currentColor"
          d="M3 2.5h7.2A2.3 2.3 0 0 1 12.5 4.8V13H4.2A1.2 1.2 0 0 1 3 11.8z"
          opacity="0.85"
        />
        <path fill="#0b0e12" d="M4.4 4.2h6.2v1.1H4.4zm0 2.2h5.2v1H4.4z" />
      </svg>
    );
  }
  return (
    <svg className="playbook-tree-icon" viewBox="0 0 16 16" aria-hidden>
      <path fill="currentColor" d="M4 2h6.2L13 5v9H4z" opacity="0.9" />
      <path fill="#0b0e12" d="M5.2 7h5.6v1H5.2zm0 2.2h4.2v1H5.2z" />
    </svg>
  );
}

function MoveButtons({
  label,
  index,
  last,
  onMove,
}: {
  label: string;
  index: number;
  last: boolean;
  onMove: (delta: -1 | 1) => void;
}) {
  return (
    <span className="playbook-tree-move">
      <button
        type="button"
        className="playbook-tree-move-btn"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={(e) => {
          e.stopPropagation();
          onMove(-1);
        }}
      >
        ↑
      </button>
      <button
        type="button"
        className="playbook-tree-move-btn"
        aria-label={`Move ${label} down`}
        disabled={last}
        onClick={(e) => {
          e.stopPropagation();
          onMove(1);
        }}
      >
        ↓
      </button>
    </span>
  );
}

export function PlaybookTree({
  mapNames,
  books,
  mapName,
  activeKey,
  activePageId,
  expandedBooks,
  collapsedMaps,
  onSelectMap,
  onToggleMap,
  onOpenBook,
  onToggleBook,
  onSelectStrat,
  onCommitBookTitle,
  onCommitStratTitle,
  onMoveBook,
  onMoveStrat,
}: Props) {
  const grouped = groupPlaybooksByMap(books);
  const maps = mapsForTree(mapNames, books);
  const [rename, setRename] = useState<RenameTarget | null>(null);

  const editingBook = (key: string) => rename?.kind === "book" && rename.key === key;
  const editingPage = (key: string, pageId: string) =>
    rename?.kind === "page" && rename.key === key && rename.pageId === pageId;

  const commitRename = () => {
    if (!rename) return;
    if (rename.kind === "book") {
      const book = books.find((row) => row.key === rename.key);
      if (book) onCommitBookTitle(book, rename.value);
    } else {
      const book = books.find((row) => row.key === rename.key);
      if (book) onCommitStratTitle(book, rename.pageId, rename.value);
    }
    setRename(null);
  };

  const onRenameKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setRename(null);
    }
  };

  const beginBookRename = (book: Playbook) => {
    setRename({ kind: "book", key: book.key, value: book.title });
  };

  const beginPageRename = (book: Playbook, pageId: string, title: string) => {
    setRename({ kind: "page", key: book.key, pageId, value: title });
  };

  const startPageRename = (e: MouseEvent, book: Playbook, pageId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    beginPageRename(book, pageId, title);
  };

  const onBookKey = (e: KeyboardEvent<HTMLButtonElement>, book: Playbook) => {
    if (e.key !== "F2") return;
    e.preventDefault();
    beginBookRename(book);
  };

  const onPageKey = (
    e: KeyboardEvent<HTMLButtonElement>,
    book: Playbook,
    pageId: string,
    title: string,
  ) => {
    if (e.key !== "F2") return;
    e.preventDefault();
    beginPageRename(book, pageId, title);
  };

  return (
    <ul className="playbook-tree" aria-label="Playbooks">
      {maps.map((map) => {
        const open = !collapsedMaps.has(map);
        const mapBooks = grouped.get(map) ?? [];
        return (
          <li key={map} className="playbook-tree-map">
            <div className="playbook-tree-row">
              <TreeIcon kind="map" />
              <button
                type="button"
                className={
                  map === mapName ? "playbook-tree-label is-active" : "playbook-tree-label"
                }
                aria-expanded={open}
                title="Double-click to expand or collapse"
                onClick={() => onSelectMap(map)}
                onDoubleClick={() => onToggleMap(map)}
              >
                {prettyMap(map)}
              </button>
            </div>
            {open ? (
              <ul className="playbook-tree-books">
                {mapBooks.length === 0 ? (
                  <li className="playbook-tree-empty muted">
                    <span className="playbook-tree-guide" aria-hidden>
                      {treeGuide(true)}
                    </span>
                    No playbooks
                  </li>
                ) : (
                  mapBooks.map((book, bookIndex) => {
                    const bookLast = bookIndex === mapBooks.length - 1;
                    const bookOpen = expandedBooks.has(book.key);
                    return (
                      <li key={book.key}>
                        <div className="playbook-tree-row">
                          <span className="playbook-tree-guide" aria-hidden>
                            {treeGuide(bookLast)}
                          </span>
                          <TreeIcon kind="book" />
                          {editingBook(book.key) && rename?.kind === "book" ? (
                            <input
                              aria-label="Book title"
                              className="playbook-tree-rename"
                              value={rename.value}
                              autoFocus
                              onChange={(e) =>
                                setRename({ kind: "book", key: book.key, value: e.target.value })
                              }
                              onBlur={commitRename}
                              onKeyDown={onRenameKey}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <button
                              type="button"
                              className={
                                book.key === activeKey
                                  ? "playbook-tree-label is-active"
                                  : "playbook-tree-label"
                              }
                              aria-expanded={bookOpen}
                              title="Double-click to expand or collapse. F2 to rename."
                              onClick={() => onOpenBook(book)}
                              onDoubleClick={() => onToggleBook(book.key)}
                              onKeyDown={(e) => onBookKey(e, book)}
                            >
                              {book.title}
                            </button>
                          )}
                          <MoveButtons
                            label={book.title}
                            index={bookIndex}
                            last={bookLast}
                            onMove={(delta) => onMoveBook(book, delta)}
                          />
                        </div>
                        {bookOpen ? (
                          <ul className="playbook-tree-strats">
                            {book.pages.map((page, pageIndex) => {
                              const pageLast = pageIndex === book.pages.length - 1;
                              return (
                                <li key={page.id}>
                                  <div className="playbook-tree-row">
                                    <span className="playbook-tree-guide" aria-hidden>
                                      {treeGuide(pageLast, [bookLast])}
                                    </span>
                                    <TreeIcon kind="strat" />
                                    {editingPage(book.key, page.id) && rename?.kind === "page" ? (
                                      <input
                                        aria-label="Strat name"
                                        className="playbook-tree-rename"
                                        value={rename.value}
                                        autoFocus
                                        onChange={(e) =>
                                          setRename({
                                            kind: "page",
                                            key: book.key,
                                            pageId: page.id,
                                            value: e.target.value,
                                          })
                                        }
                                        onBlur={commitRename}
                                        onKeyDown={onRenameKey}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      <button
                                        type="button"
                                        className={
                                          book.key === activeKey && page.id === activePageId
                                            ? "playbook-tree-strat is-active"
                                            : "playbook-tree-strat"
                                        }
                                        title="Double-click or F2 to rename"
                                        onClick={() => onSelectStrat(book, page.id)}
                                        onDoubleClick={(e) =>
                                          startPageRename(e, book, page.id, page.title)
                                        }
                                        onKeyDown={(e) => onPageKey(e, book, page.id, page.title)}
                                      >
                                        {page.title}
                                      </button>
                                    )}
                                    <MoveButtons
                                      label={page.title}
                                      index={pageIndex}
                                      last={pageLast}
                                      onMove={(delta) => onMoveStrat(book, page.id, delta)}
                                    />
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })
                )}
              </ul>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
