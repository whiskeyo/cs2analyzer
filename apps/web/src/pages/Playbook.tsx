import { useEffect, useRef, useState } from "react";
import { PlaybookCanvas } from "@/components/playbook/PlaybookCanvas";
import { PlaybookEmpty } from "@/components/playbook/PlaybookEmpty";
import { PlaybookStratPanel } from "@/components/playbook/PlaybookStratPanel";
import { PlaybookTree } from "@/components/playbook/PlaybookTree";
import { TokenPalette } from "@/components/playbook/TokenPalette";
import type { NadeStyle } from "@/lib/notes/types";
import { consumePlaybookFocus } from "@/lib/playbook/focus";
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
import { prettyMap } from "@/lib/weapons/weapons";
import { errorMessage } from "@/lib/validate/json.ts";
import type { MapCalibration } from "@/lib/replay/replayTypes";

export function Playbook() {
  const [maps, setMaps] = useState<Record<string, MapCalibration> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapName, setMapName] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [tool, setTool] = useState<PlaybookTool>("pan");
  const [nadeTrail, setNadeTrail] = useState(false);
  const [nadeStyle, setNadeStyle] = useState<NadeStyle>("icon");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedMaps, setCollapsedMaps] = useState<Set<string>>(() => new Set());
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(() => new Set());
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
    remove,
    movePlaybook,
    moveStrat,
  } = usePlaybooks(mapName);

  const treeWidthRef = useRef(PLAYBOOK_TREE_DEFAULT_WIDTH);
  const detailWidthRef = useRef(PLAYBOOK_DETAIL_DEFAULT_WIDTH);
  const page = book ? activePage(book) : null;
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

  const treeBooks = booksWithDraft(allBooks, book);
  const cal = mapName && maps ? maps[mapName] : undefined;
  const visibleSelectedId = page?.note.pieces.some((piece) => piece.id === selectedId)
    ? selectedId
    : null;

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

  return (
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
                onNote={setNote}
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
            onNote={setNote}
            note={page.note}
            onNewStrat={addStrat}
            onDuplicateStrat={() => duplicateStrat(page.id)}
            onDeleteStrat={() => removeStrat(page.id)}
            onDeletePlaybook={() => void remove()}
          />
        </aside>
      ) : null}
      <aside className="playbook-sidebar playbook-tree-pane" style={{ width: treeResize.width }}>
        <div {...treeResize.handleProps} />
        <h2>Playbooks</h2>
        <p className="playbook-lead">Maps, then named books. Drawings stay on this machine.</p>
        {loadError ? <p className="error">{loadError}</p> : null}
        <form
          className="playbook-create"
          onSubmit={(e) => {
            e.preventDefault();
            void create(newTitle).then((next) => {
              setNewTitle("");
              if (next) setExpandedBooks((prev) => new Set(prev).add(next.key));
            });
          }}
        >
          <input
            aria-label="New playbook title"
            value={newTitle}
            placeholder={mapName ? `New ${prettyMap(mapName)} playbook` : UNTITLED_PLAYBOOK}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className="ghost" disabled={!mapName}>
            New playbook
          </button>
        </form>
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
          onCommitStratTitle={(row, pageId, title) => void commitStratTitle(row.key, pageId, title)}
          onMoveBook={(row, delta) => void movePlaybook(row.key, delta)}
          onMoveStrat={(row, pageId, delta) => void moveStrat(row.key, pageId, delta)}
        />
      </aside>
    </div>
  );
}
