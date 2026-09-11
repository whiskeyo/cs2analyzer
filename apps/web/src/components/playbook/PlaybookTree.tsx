import { useState } from "react";
import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import { useMessages } from "@/lib/i18n/useMessages";
import type { Playbook } from "@/lib/playbook/types";
import { groupPlaybooksByMap, mapsForTree } from "@/lib/playbook/tree";
import { readPlaybookTreeDrag, writePlaybookTreeDrag } from "@/lib/playbook/treeDrag";
import { prettyMap } from "@/lib/weapons/weapons";
import { PlaybookTreeMenu, type TreeMenuTarget } from "./PlaybookTreeMenu";
import { TreeIcon } from "./PlaybookTreeChrome";

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
  onMoveBook: (book: Playbook, toIndex: number) => void;
  onMoveStrat: (book: Playbook, pageId: string, toIndex: number) => void;
  onNewPlaybook: (mapName: string) => void;
  onNewStrat: (book: Playbook) => void;
  onDuplicateBook: (book: Playbook) => void;
  onDuplicateStrat: (book: Playbook, pageId: string) => void;
  onDeleteBook: (book: Playbook) => void;
  onDeleteStrat: (book: Playbook, pageId: string) => void;
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
  onNewPlaybook,
  onNewStrat,
  onDuplicateBook,
  onDuplicateStrat,
  onDeleteBook,
  onDeleteStrat,
}: Props) {
  const { messages } = useMessages();
  const grouped = groupPlaybooksByMap(books);
  const maps = mapsForTree(mapNames, books);
  const [rename, setRename] = useState<RenameTarget | null>(null);
  const [menu, setMenu] = useState<{ target: TreeMenuTarget; x: number; y: number } | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);

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

  const openMenu = (e: MouseEvent, target: TreeMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ target, x: e.clientX, y: e.clientY });
  };

  const bookByKey = (key: string) => books.find((row) => row.key === key);

  const startBookDrag = (e: DragEvent, book: Playbook) => {
    e.dataTransfer.effectAllowed = "move";
    writePlaybookTreeDrag(e.dataTransfer, { kind: "book", mapName: book.mapName, key: book.key });
  };

  const startStratDrag = (e: DragEvent, book: Playbook, pageId: string) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = "move";
    writePlaybookTreeDrag(e.dataTransfer, { kind: "strat", bookKey: book.key, pageId });
  };

  const dropBook = (e: DragEvent, book: Playbook, toIndex: number) => {
    e.preventDefault();
    setDropOn(null);
    const drag = readPlaybookTreeDrag(e.dataTransfer);
    if (!drag || drag.kind !== "book" || drag.mapName !== book.mapName || drag.key === book.key) {
      return;
    }
    const source = bookByKey(drag.key);
    if (source) onMoveBook(source, toIndex);
  };

  const dropStrat = (e: DragEvent, book: Playbook, toIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDropOn(null);
    const drag = readPlaybookTreeDrag(e.dataTransfer);
    if (!drag || drag.kind !== "strat" || drag.bookKey !== book.key) return;
    onMoveStrat(book, drag.pageId, toIndex);
  };

  return (
    <>
      <ul className="playbook-tree" aria-label={messages.playbook.treeAria}>
        {maps.map((map) => {
          const open = !collapsedMaps.has(map);
          const mapBooks = grouped.get(map) ?? [];
          return (
            <li key={map} className="playbook-tree-map">
              <div
                className="playbook-tree-row"
                onContextMenu={(e) => openMenu(e, { kind: "map", mapName: map })}
              >
                <TreeIcon kind="map" />
                <button
                  type="button"
                  className={
                    map === mapName ? "playbook-tree-label is-active" : "playbook-tree-label"
                  }
                  aria-expanded={open}
                  title={messages.playbook.mapExpandTip}
                  onClick={() => onSelectMap(map)}
                  onDoubleClick={() => onToggleMap(map)}
                >
                  {prettyMap(map)}
                </button>
              </div>
              {open ? (
                <ul className="playbook-tree-books">
                  {mapBooks.length === 0 ? (
                    <li className="playbook-tree-empty muted">{messages.playbook.emptyMap}</li>
                  ) : (
                    mapBooks.map((book, bookIndex) => {
                      const bookLast = bookIndex === mapBooks.length - 1;
                      const bookOpen = expandedBooks.has(book.key);
                      const bookDrop = dropOn === `book:${book.key}`;
                      return (
                        <li key={book.key}>
                          <div
                            className={bookDrop ? "playbook-tree-row is-drop" : "playbook-tree-row"}
                            draggable={!editingBook(book.key)}
                            onDragStart={(e) => startBookDrag(e, book)}
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDropOn(`book:${book.key}`);
                            }}
                            onDragLeave={() => setDropOn(null)}
                            onDrop={(e) => dropBook(e, book, bookIndex)}
                            onContextMenu={(e) =>
                              openMenu(e, {
                                kind: "book",
                                mapName: map,
                                bookKey: book.key,
                                title: book.title,
                                index: bookIndex,
                                last: bookLast,
                              })
                            }
                          >
                            <TreeIcon kind="book" />
                            {editingBook(book.key) && rename?.kind === "book" ? (
                              <input
                                aria-label={messages.playbook.fieldBookRename}
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
                                title={messages.playbook.bookTip}
                                onClick={() => onOpenBook(book)}
                                onDoubleClick={() => onToggleBook(book.key)}
                                onKeyDown={(e) => {
                                  if (e.key !== "F2") return;
                                  e.preventDefault();
                                  beginBookRename(book);
                                }}
                              >
                                {book.title}
                              </button>
                            )}
                          </div>
                          {bookOpen ? (
                            <ul className="playbook-tree-strats">
                              {book.pages.map((page, pageIndex) => {
                                const pageLast = pageIndex === book.pages.length - 1;
                                const stratDrop = dropOn === `strat:${page.id}`;
                                return (
                                  <li key={page.id}>
                                    <div
                                      className={
                                        stratDrop
                                          ? "playbook-tree-row is-drop"
                                          : "playbook-tree-row"
                                      }
                                      draggable={!editingPage(book.key, page.id)}
                                      onDragStart={(e) => startStratDrag(e, book, page.id)}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setDropOn(`strat:${page.id}`);
                                      }}
                                      onDragLeave={() => setDropOn(null)}
                                      onDrop={(e) => dropStrat(e, book, pageIndex)}
                                      onContextMenu={(e) =>
                                        openMenu(e, {
                                          kind: "strat",
                                          mapName: map,
                                          bookKey: book.key,
                                          pageId: page.id,
                                          title: page.title,
                                          index: pageIndex,
                                          last: pageLast,
                                        })
                                      }
                                    >
                                      <TreeIcon kind="strat" />
                                      {editingPage(book.key, page.id) && rename?.kind === "page" ? (
                                        <input
                                          aria-label={messages.playbook.fieldStratName}
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
                                          title={messages.playbook.stratTip}
                                          onClick={() => onSelectStrat(book, page.id)}
                                          onDoubleClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            beginPageRename(book, page.id, page.title);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key !== "F2") return;
                                            e.preventDefault();
                                            beginPageRename(book, page.id, page.title);
                                          }}
                                        >
                                          {page.title}
                                        </button>
                                      )}
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
      {menu ? (
        <PlaybookTreeMenu
          target={menu.target}
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onNewPlaybook={onNewPlaybook}
          onNewStrat={(bookKey) => {
            const book = bookByKey(bookKey);
            if (book) onNewStrat(book);
          }}
          onRenameBook={(bookKey) => {
            const book = bookByKey(bookKey);
            if (book) beginBookRename(book);
          }}
          onRenameStrat={(bookKey, pageId) => {
            const book = bookByKey(bookKey);
            const page = book?.pages.find((row) => row.id === pageId);
            if (book && page) beginPageRename(book, pageId, page.title);
          }}
          onDuplicateBook={(bookKey) => {
            const book = bookByKey(bookKey);
            if (book) onDuplicateBook(book);
          }}
          onDuplicateStrat={(bookKey, pageId) => {
            const book = bookByKey(bookKey);
            if (book) onDuplicateStrat(book, pageId);
          }}
          onDeleteBook={(bookKey) => {
            const book = bookByKey(bookKey);
            if (book) onDeleteBook(book);
          }}
          onDeleteStrat={(bookKey, pageId) => {
            const book = bookByKey(bookKey);
            if (book) onDeleteStrat(book, pageId);
          }}
          onMoveBook={(bookKey, toIndex) => {
            const book = bookByKey(bookKey);
            if (book) onMoveBook(book, toIndex);
          }}
          onMoveStrat={(bookKey, pageId, toIndex) => {
            const book = bookByKey(bookKey);
            if (book) onMoveStrat(book, pageId, toIndex);
          }}
        />
      ) : null}
    </>
  );
}
