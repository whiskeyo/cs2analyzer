import { useEffect, useRef, useState } from "react";
import { PlaybookCanvas } from "@/components/playbook/PlaybookCanvas";
import { PlaybookEmpty } from "@/components/playbook/PlaybookEmpty";
import { PlaybookStratPanel } from "@/components/playbook/PlaybookStratPanel";
import { PlaybookTree } from "@/components/playbook/PlaybookTree";
import { TokenPalette } from "@/components/playbook/TokenPalette";
import type { NadeStyle, Note } from "@/lib/notes/types";
import { consumePlaybookFocus } from "@/lib/playbook/focus";
import { useNoteHistory } from "@/lib/playbook/history";
import {
  colorAtSwatch,
  cyclePaletteId,
  PLAYBOOK_COLOR_KEYS,
  PLAYBOOK_KEYS_HINT,
  PLAYBOOK_TOOL_KEYS,
  typingInField,
} from "@/lib/playbook/hotkeys";
import { pawnLegend, shouldShowPawnLegend, visiblePieces } from "@/lib/playbook/legend";
import { pickInitialMap, sortedMapNames } from "@/lib/playbook/maps";
import { activePage } from "@/lib/playbook/pages";
import { booksWithDraft } from "@/lib/playbook/tree";
import type { PlaybookTool } from "@/lib/playbook/pieces";
import type { Playbook as PlaybookDoc } from "@/lib/playbook/types";
import { UNTITLED_PLAYBOOK } from "@/lib/playbook/types";
import { usePlaybooks } from "@/lib/playbook/usePlaybooks";
import { loadCalibrations } from "@/lib/radar/maps";
import {
  PLAYBOOK_DETAIL_DEFAULT_WIDTH,
  PLAYBOOK_DETAIL_MAX_WIDTH,
  PLAYBOOK_DETAIL_MIN_WIDTH,
  PLAYBOOK_DETAIL_WIDTH_STORAGE_KEY,
  PLAYBOOK_TREE_DEFAULT_WIDTH,
  PLAYBOOK_TREE_MAX_WIDTH,
  PLAYBOOK_TREE_MIN_WIDTH,
  PLAYBOOK_TREE_WIDTH_STORAGE_KEY,
} from "@/lib/shared/constants";
import { usePanelResize } from "@/lib/shared/usePanelResize";
import { errorMessage } from "@/lib/validate/json.ts";
import type { MapCalibration } from "@/lib/replay/replayTypes";

export function Playbook() {
  const [maps, setMaps] = useState<Record<string, MapCalibration> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapName, setMapName] = useState<string | null>(null);
  const [tool, setTool] = useState<PlaybookTool>("pan");
  const [nadeTrail, setNadeTrail] = useState(false);
  const [nadeStyle, setNadeStyle] = useState<NadeStyle>("icon");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedMaps, setCollapsedMaps] = useState<Set<string>>(() => new Set());
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(() => new Set());
  const [viewEpoch, setViewEpoch] = useState(0);
  const pendingFocus = useRef(consumePlaybookFocus());
  const pendingPage = useRef<string | null>(null);
  const names = maps ? sortedMapNames(maps) : [];
  const {
    allBooks,
    book,
    activeKey,
    select,
    create,
    addStrat,
    commitBookTitle,
    commitStratTitle,
    setBody,
    removeStrat,
    duplicateStrat,
    selectStrat,
    setNote,
    setPalette,
    removeBook,
    duplicateBook,
    addStratTo,
    removeStratFrom,
    duplicateStratOn,
    movePlaybook,
    moveStrat,
  } = usePlaybooks(mapName);

  const treeWidthRef = useRef(PLAYBOOK_TREE_DEFAULT_WIDTH);
  const detailWidthRef = useRef(PLAYBOOK_DETAIL_DEFAULT_WIDTH);
  const page = book ? activePage(book) : null;
  const history = useNoteHistory(page?.id ?? null, page?.note ?? null);
  const treeResize = usePanelResize({
    storageKey: PLAYBOOK_TREE_WIDTH_STORAGE_KEY,
    minWidth: PLAYBOOK_TREE_MIN_WIDTH,
    maxWidth: PLAYBOOK_TREE_MAX_WIDTH,
    defaultWidth: PLAYBOOK_TREE_DEFAULT_WIDTH,
    stageSelector: ".playbook",
    extraReserved: () => (page ? detailWidthRef.current : 0),
    label: "Resize playbook tree",
  });
  const detailResize = usePanelResize({
    storageKey: PLAYBOOK_DETAIL_WIDTH_STORAGE_KEY,
    minWidth: PLAYBOOK_DETAIL_MIN_WIDTH,
    maxWidth: PLAYBOOK_DETAIL_MAX_WIDTH,
    defaultWidth: PLAYBOOK_DETAIL_DEFAULT_WIDTH,
    stageSelector: ".playbook",
    extraReserved: () => treeWidthRef.current,
    label: "Resize strat panel",
  });
  treeWidthRef.current = treeResize.width;
  detailWidthRef.current = detailResize.width;

  useEffect(() => {
    let cancelled = false;
    void loadCalibrations()
      .then((cals) => {
        if (cancelled) return;
        setMaps(cals);
        setMapName((current) => {
          if (current) return current;
          const focus = pendingFocus.current;
          if (focus && cals[focus.mapName]) return focus.mapName;
          return pickInitialMap(sortedMapNames(cals));
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(errorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const focus = pendingFocus.current;
    if (!focus || mapName !== focus.mapName) return;
    if (!allBooks.some((row) => row.key === focus.bookKey)) return;
    select(focus.bookKey);
    setExpandedBooks((prev) => new Set(prev).add(focus.bookKey));
    pendingFocus.current = null;
  }, [allBooks, mapName, select]);

  useEffect(() => {
    if (!book) return;
    const pageId = pendingPage.current;
    if (!pageId) return;
    pendingPage.current = null;
    selectStrat(pageId);
  }, [book, selectStrat]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typingInField()) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          const next = history.redo();
          if (next) setNote(next);
        } else {
          const prev = history.undo();
          if (prev) setNote(prev);
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        const next = history.redo();
        if (next) setNote(next);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        setSelectedId(null);
        setTool("pan");
        return;
      }
      if (e.key.toLowerCase() === "r") {
        setViewEpoch((n) => n + 1);
        return;
      }
      if (e.key.toLowerCase() === "n") {
        setNadeTrail((on) => !on);
        return;
      }
      if (e.key.toLowerCase() === "g") {
        setNadeStyle((style) => (style === "icon" ? "effect" : "icon"));
        return;
      }
      if (e.key === "[" || e.key === "]") {
        if (!book) return;
        const nextId = cyclePaletteId(book.paletteId, e.key === "]" ? 1 : -1);
        setPalette(nextId);
        return;
      }
      const swatch = PLAYBOOK_COLOR_KEYS.findIndex((key) => key === e.key);
      if (swatch >= 0 && book) {
        const next = colorAtSwatch(book.paletteId, swatch);
        if (next) setPalette(book.paletteId, next);
        return;
      }
      const nextTool = PLAYBOOK_TOOL_KEYS[e.key.toLowerCase()];
      if (nextTool) setTool(nextTool);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [book, history, setNote, setPalette]);

  const treeBooks = booksWithDraft(allBooks, book);
  const cal = mapName && maps ? maps[mapName] : undefined;
  const visibleSelectedId = page?.note.pieces.some((piece) => piece.id === selectedId)
    ? selectedId
    : null;
  const boardPieces = page ? visiblePieces(page.note) : [];
  const legend = shouldShowPawnLegend(boardPieces) ? pawnLegend(boardPieces) : [];

  const commitNote = (note: Note) => {
    history.pushPresent(note);
    setNote(note);
  };

  const openBook = (row: PlaybookDoc) => {
    setMapName(row.mapName);
    select(row.key, row.mapName);
  };

  const openStrat = (row: PlaybookDoc, pageId: string) => {
    setExpandedBooks((prev) => new Set(prev).add(row.key));
    if (row.key === activeKey) {
      selectStrat(pageId);
      return;
    }
    pendingPage.current = pageId;
    setMapName(row.mapName);
    select(row.key, row.mapName);
  };

  const createBookOnMap = (map: string) => {
    setMapName(map);
    void create(UNTITLED_PLAYBOOK, map).then((next) => {
      if (next) setExpandedBooks((prev) => new Set(prev).add(next.key));
    });
  };

  return (
    <div className="playbook-page">
      <div className="playbook">
        <div className="playbook-stage">
          {page && book && mapName ? (
            <>
              <TokenPalette
                tool={tool}
                onTool={setTool}
                nadeTrail={nadeTrail}
                onNadeTrail={setNadeTrail}
                nadeStyle={nadeStyle}
                onNadeStyle={setNadeStyle}
                paletteId={book.paletteId}
                color={book.color}
                onPalette={(id) => setPalette(id)}
                onColor={(color) => setPalette(book.paletteId, color)}
                canUndo={history.canUndo}
                canRedo={history.canRedo}
                onUndo={() => {
                  const prev = history.undo();
                  if (prev) setNote(prev);
                }}
                onRedo={() => {
                  const next = history.redo();
                  if (next) setNote(next);
                }}
                onResetView={() => setViewEpoch((n) => n + 1)}
              />
              <div className="playbook-board">
                <PlaybookCanvas
                  cal={cal}
                  floorMode={page.floor}
                  note={page.note}
                  tool={tool}
                  color={book.color}
                  selectedId={visibleSelectedId}
                  nadeTrail={nadeTrail}
                  nadeStyle={nadeStyle}
                  viewEpoch={viewEpoch}
                  legend={legend}
                  onNote={commitNote}
                  onSelect={setSelectedId}
                />
              </div>
            </>
          ) : (
            <PlaybookEmpty />
          )}
        </div>
        {page && book ? (
          <aside className="playbook-sidebar playbook-detail" style={{ width: detailResize.width }}>
            <div {...detailResize.handleProps} />
            <PlaybookStratPanel
              stratTitle={page.title}
              body={page.body}
              selectedId={visibleSelectedId}
              onBody={(body) => setBody(page.id, body)}
              onSelect={setSelectedId}
              onNote={commitNote}
              note={page.note}
            />
          </aside>
        ) : null}
        <aside className="playbook-sidebar playbook-tree-pane" style={{ width: treeResize.width }}>
          <div {...treeResize.handleProps} />
          <h2>Playbooks</h2>
          <p className="playbook-lead">Maps, then named books. Drawings stay on this machine.</p>
          {loadError ? <p className="error">{loadError}</p> : null}
          <PlaybookTree
            mapNames={names}
            books={treeBooks}
            mapName={mapName}
            activeKey={activeKey}
            activePageId={book?.activePageId ?? null}
            expandedBooks={expandedBooks}
            collapsedMaps={collapsedMaps}
            onSelectMap={setMapName}
            onToggleMap={(map) => {
              setCollapsedMaps((prev) => {
                const next = new Set(prev);
                if (next.has(map)) next.delete(map);
                else next.add(map);
                return next;
              });
            }}
            onOpenBook={openBook}
            onToggleBook={(key) => {
              setExpandedBooks((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
            onSelectStrat={openStrat}
            onCommitBookTitle={(row, title) => void commitBookTitle(row.key, title)}
            onCommitStratTitle={(row, pageId, title) =>
              void commitStratTitle(row.key, pageId, title)
            }
            onMoveBook={(row, toIndex) => void movePlaybook(row.key, toIndex)}
            onMoveStrat={(row, pageId, toIndex) => void moveStrat(row.key, pageId, toIndex)}
            onNewPlaybook={createBookOnMap}
            onNewStrat={(row) => {
              setExpandedBooks((prev) => new Set(prev).add(row.key));
              if (row.key === activeKey) addStrat();
              else void addStratTo(row.key);
            }}
            onDuplicateBook={(row) => {
              void duplicateBook(row.key).then((copy) => {
                if (copy) {
                  setMapName(copy.mapName);
                  setExpandedBooks((prev) => new Set(prev).add(copy.key));
                }
              });
            }}
            onDuplicateStrat={(row, pageId) => {
              setExpandedBooks((prev) => new Set(prev).add(row.key));
              if (row.key === activeKey) duplicateStrat(pageId);
              else void duplicateStratOn(row.key, pageId);
            }}
            onDeleteBook={(row) => void removeBook(row.key)}
            onDeleteStrat={(row, pageId) => {
              if (row.key === activeKey) removeStrat(pageId);
              else void removeStratFrom(row.key, pageId);
            }}
          />
        </aside>
      </div>
      <p className="keys">{PLAYBOOK_KEYS_HINT}</p>
    </div>
  );
}
