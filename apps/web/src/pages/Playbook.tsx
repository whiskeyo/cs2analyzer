import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearchParams } from "react-router";
import {
  canonicalPlaybookSearch,
  findPlaybook,
  findStrat,
  parsePlaybookQuery,
  playbookQueryLabel,
  playbookSearch,
  stratQueryLabel,
} from "@/lib/app/playbookSearch";
import { PlaybookCanvas } from "@/components/playbook/PlaybookCanvas";
import { PlaybookEmpty } from "@/components/playbook/PlaybookEmpty";
import { PlaybookPdfExportDialog } from "@/components/playbook/PlaybookPdfExportDialog";
import { PlaybookStratPanel } from "@/components/playbook/PlaybookStratPanel";
import { PlaybookTree } from "@/components/playbook/PlaybookTree";
import { TokenPalette } from "@/components/playbook/TokenPalette";
import { downloadPlaybookPdf } from "@/lib/export/exportPlaybook";
import type { PdfPhotos } from "@/lib/settings/userSettings";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import { ingestPlaybookImages } from "@/lib/playbook/addPlaybookImages";
import { consumePlaybookFocus } from "@/lib/playbook/focus";
import { useNoteHistory } from "@/lib/playbook/history";
import { PLAYBOOK_KEYS_HINT } from "@/lib/playbook/hotkeys";
import { pickInitialMap, sortedMapNames } from "@/lib/playbook/maps";
import { playbookUsesLower } from "@/lib/playbook/paint";
import { openPlaybookVideoWatch } from "@/lib/playbook/videos";
import {
  activePage,
  playbookFloorImages,
  playbookFloorLayer,
  playbookFloorNote,
  playbookFloorVideos,
} from "@/lib/playbook/pages";
import { booksWithDraft } from "@/lib/playbook/tree";
import type { Playbook as PlaybookDoc } from "@/lib/playbook/types";
import { PLAYBOOK_PREFERRED_MAP, UNTITLED_PLAYBOOK } from "@/lib/playbook/types";
import { usePlaybookBoard } from "@/lib/playbook/usePlaybookBoard";
import { usePlaybooks } from "@/lib/playbook/usePlaybooks";
import { loadCalibrations } from "@/lib/radar/maps";
import { loadTutorialPlaybook } from "@/lib/tutorial/load";
import { isTutorialPlaybookPath } from "@/lib/tutorial/query";
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
  const { settings, update } = useUserSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const { pathname } = useLocation();
  const searchKey = searchParams.toString();
  const query = useMemo(() => parsePlaybookQuery(searchKey), [searchKey]);
  const tutorialPlaybook = isTutorialPlaybookPath(pathname);
  const [loadedSample, setLoadedSample] = useState<PlaybookDoc | null>(null);
  const incomingSearch = useMemo(() => canonicalPlaybookSearch(query), [query]);
  const initialMapFromUrl = useRef(query.map);
  const appliedSearchRef = useRef<string | null>(null);
  const [maps, setMaps] = useState<Record<string, MapCalibration> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapName, setMapName] = useState<string | null>(null);
  const boardMap = tutorialPlaybook ? PLAYBOOK_PREFERRED_MAP : mapName;
  const sandboxBook = tutorialPlaybook ? loadedSample : null;
  const [videoPageId, setVideoPageId] = useState<string | null>(null);
  const [openVideoIdState, setOpenVideoIdState] = useState<string | null>(null);
  const [imagePageId, setImagePageId] = useState<string | null>(null);
  const [openImageIdState, setOpenImageIdState] = useState<string | null>(null);
  const [pendingPinState, setPendingPinState] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [pendingImagePinState, setPendingImagePinState] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [collapsedMaps, setCollapsedMaps] = useState<Set<string>>(() => new Set());
  const [expandedBooks, setExpandedBooks] = useState<Set<string>>(() => new Set());
  const openedBooksRef = useRef<Set<string>>(new Set());
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [pdfExportBook, setPdfExportBook] = useState<PlaybookDoc | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
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
    setVideos,
    setImages,
    setFloor,
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
    saveError,
  } = usePlaybooks(
    boardMap,
    tutorialPlaybook ? { mode: "sandbox", book: sandboxBook } : { mode: "idb" },
  );

  const treeWidthRef = useRef(PLAYBOOK_TREE_DEFAULT_WIDTH);
  const detailWidthRef = useRef(PLAYBOOK_DETAIL_DEFAULT_WIDTH);
  const cal = boardMap && maps ? maps[boardMap] : undefined;
  const page = book ? activePage(book) : null;
  const floorLayer = playbookFloorLayer(playbookUsesLower(cal, page?.floor ?? "auto"));
  const floorNote = page ? playbookFloorNote(page, floorLayer) : null;
  const floorVideos = page ? playbookFloorVideos(page, floorLayer) : [];
  const floorImages = page ? playbookFloorImages(page, floorLayer) : [];
  const openVideoId = videoPageId === page?.id ? openVideoIdState : null;
  const openImageId = imagePageId === page?.id ? openImageIdState : null;
  const pendingPin = videoPageId === page?.id ? pendingPinState : null;
  const pendingImagePin = imagePageId === page?.id ? pendingImagePinState : null;
  const setOpenVideoId = (id: string | null) => {
    setVideoPageId(page?.id ?? null);
    setOpenVideoIdState(id);
  };
  const setOpenImageId = (id: string | null) => {
    setImagePageId(page?.id ?? null);
    setOpenImageIdState(id);
  };
  const setPendingPin = (at: { x: number; y: number } | null) => {
    setVideoPageId(page?.id ?? null);
    setPendingPinState(at);
  };
  const setPendingImagePin = (at: { x: number; y: number } | null) => {
    if (at) setImagePageId(page?.id ?? null);
    setPendingImagePinState(at);
  };
  const history = useNoteHistory(page ? `${page.id}:${floorLayer}` : null, floorNote);
  const board = usePlaybookBoard({
    book,
    page,
    floorLayer,
    history,
    setNote: (note) => setNote(note, floorLayer),
    setPalette,
    defaultTool: settings.defaultDrawTool,
  });
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
    if (!tutorialPlaybook) return;
    let cancelled = false;
    void loadTutorialPlaybook().then((sample) => {
      if (!cancelled) setLoadedSample(structuredClone(sample));
    });
    return () => {
      cancelled = true;
    };
  }, [tutorialPlaybook]);

  useEffect(() => {
    let cancelled = false;
    void loadCalibrations()
      .then((cals) => {
        if (cancelled) return;
        setMaps(cals);
        setMapName((current) => {
          if (tutorialPlaybook) return PLAYBOOK_PREFERRED_MAP;
          if (current) return current;
          const mapFromUrl = initialMapFromUrl.current;
          if (mapFromUrl && cals[mapFromUrl]) return mapFromUrl;
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
  }, [tutorialPlaybook]);

  useEffect(() => {
    if (!boardMap) return;
    if (appliedSearchRef.current === incomingSearch) return;
    if (query.playbook) {
      const match = findPlaybook(allBooks, boardMap, query.playbook);
      if (!match) return;
      appliedSearchRef.current = incomingSearch;
      select(match.key);
      if (query.strat) {
        const strat = findStrat(match, query.strat);
        if (strat) pendingPage.current = strat.id;
      }
      return;
    }
    appliedSearchRef.current = incomingSearch;
    const focus = pendingFocus.current;
    if (
      !tutorialPlaybook &&
      focus &&
      boardMap === focus.mapName &&
      allBooks.some((row) => row.key === focus.bookKey)
    ) {
      select(focus.bookKey);
      pendingFocus.current = null;
    }
  }, [allBooks, incomingSearch, boardMap, query.playbook, query.strat, select, tutorialPlaybook]);

  useEffect(() => {
    if (!book) return;
    const pageId = pendingPage.current;
    if (!pageId) return;
    pendingPage.current = null;
    selectStrat(pageId);
  }, [book, selectStrat]);

  useEffect(() => {
    if (tutorialPlaybook) return;
    if (!boardMap) return;
    if (activeKey && !book) return;
    if (query.playbook && appliedSearchRef.current !== incomingSearch) return;
    const next = playbookSearch({
      map: boardMap,
      playbook: book ? playbookQueryLabel(allBooks, book) : null,
      strat: book && page ? stratQueryLabel(book.pages, page) : null,
    });
    if (next === incomingSearch) return;
    appliedSearchRef.current = next;
    const params = new URLSearchParams(next.startsWith("?") ? next.slice(1) : next);
    setSearchParams(Object.fromEntries(params), { replace: true });
  }, [
    activeKey,
    allBooks,
    book,
    incomingSearch,
    boardMap,
    page,
    query.playbook,
    searchKey,
    setSearchParams,
    tutorialPlaybook,
  ]);

  const treeBooks = booksWithDraft(allBooks, book);
  if (activeKey) openedBooksRef.current.add(activeKey);
  const treeExpandedBooks = new Set(openedBooksRef.current);
  for (const key of expandedBooks) treeExpandedBooks.add(key);

  const openBook = (row: PlaybookDoc) => {
    setExpandedBooks((prev) => new Set(prev).add(row.key));
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

  const requestExport = (row: PlaybookDoc) => {
    if (exportingKey) return;
    setExportError(null);
    setPdfExportBook(row.key === activeKey && book ? book : row);
  };

  const exportBook = (row: PlaybookDoc, photos: PdfPhotos) => {
    if (exportingKey) return;
    setExportError(null);
    setExportingKey(row.key);
    void update({ pdfPhotos: photos })
      .then(() =>
        downloadPlaybookPdf(
          row,
          maps?.[row.mapName],
          Date.now(),
          settings.pdfTheme,
          settings.radarGray,
          photos === "with",
        ),
      )
      .catch(() => {
        setExportError("Could not export PDF.");
      })
      .finally(() => {
        setExportingKey(null);
        setPdfExportBook(null);
      });
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
          {page && book && boardMap ? (
            <>
              <TokenPalette
                tool={board.tool}
                onTool={board.setTool}
                nadeTrail={board.nadeTrail}
                onNadeTrail={board.setNadeTrail}
                nadeStyle={board.nadeStyle}
                onNadeStyle={board.setNadeStyle}
                paletteId={book.paletteId}
                color={book.color}
                onPalette={(id) => setPalette(id)}
                onColor={(color) => setPalette(book.paletteId, color)}
                canUndo={board.canUndo}
                canRedo={board.canRedo}
                onUndo={board.undo}
                onRedo={board.redo}
                onResetView={board.resetView}
                floorMode={page.floor}
                hasFloors={Boolean(cal?.lower_radar)}
                onFloorMode={(floor) => setFloor(page.id, floor)}
              />
              <div className="playbook-board">
                <PlaybookCanvas
                  cal={cal}
                  floorMode={page.floor}
                  radarGray={settings.radarGray}
                  note={floorNote ?? page.note}
                  tool={board.tool}
                  color={book.color}
                  selectedId={board.visibleSelectedId}
                  nadeTrail={board.nadeTrail}
                  nadeStyle={board.nadeStyle}
                  viewEpoch={board.viewEpoch}
                  legend={board.legend}
                  videos={floorVideos}
                  selectedVideoId={openVideoId}
                  pendingPin={pendingPin}
                  pendingImagePin={pendingImagePin}
                  pageImages={floorImages}
                  selectedImageId={openImageId}
                  onNote={board.commitNote}
                  onSelect={board.setSelectedId}
                  onVideos={(videos) => setVideos(page.id, videos, floorLayer)}
                  onImages={(images) => setImages(page.id, images, floorLayer)}
                  onDropImages={(files, at) => {
                    void ingestPlaybookImages(files, floorImages, at).then((result) => {
                      setImages(page.id, result.images, floorLayer);
                      setImageError(result.error);
                      const added = result.images[result.images.length - 1];
                      if (added) setOpenImageId(added.id);
                    });
                  }}
                  onOpenImage={setOpenImageId}
                  onOpenVideo={(id) => {
                    const clip = floorVideos.find((row) => row.id === id);
                    if (clip) openPlaybookVideoWatch(clip);
                  }}
                  onPlaceYouTube={(at) => {
                    setPendingPin(at);
                    setPendingImagePin(null);
                    setOpenVideoId(null);
                  }}
                  onPlaceImage={(at) => {
                    setPendingImagePin(at);
                    setPendingPin(null);
                    setOpenImageId(null);
                  }}
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
              videos={floorVideos}
              images={floorImages}
              openVideoId={openVideoId}
              pendingPin={pendingPin}
              onCancelPin={() => setPendingPin(null)}
              pendingImagePin={pendingImagePin}
              onCancelImagePin={() => setPendingImagePin(null)}
              selectedId={board.visibleSelectedId}
              openImageId={openImageId}
              onBody={(body) => setBody(page.id, body)}
              onVideos={(videos) => {
                setVideos(page.id, videos, floorLayer);
                setPendingPin(null);
              }}
              onImages={(images) => {
                setImages(page.id, images, floorLayer);
                setPendingImagePin(null);
              }}
              onOpenImage={setOpenImageId}
              imageError={imageError}
              onImageError={setImageError}
              onOpenVideo={setOpenVideoId}
              onSelect={board.setSelectedId}
              onNote={board.commitNote}
              note={floorNote ?? page.note}
            />
          </aside>
        ) : null}
        <aside className="playbook-sidebar playbook-tree-pane" style={{ width: treeResize.width }}>
          <div {...treeResize.handleProps} />
          <h2>Playbooks</h2>
          <p className="playbook-lead">Maps, then named books. Drawings stay on this machine.</p>
          {loadError ? <p className="error">{loadError}</p> : null}
          {exportError ? <p className="error">{exportError}</p> : null}
          {saveError ? (
            <p className="error" role="alert">
              {saveError}
            </p>
          ) : null}
          <PlaybookTree
            mapNames={tutorialPlaybook ? [PLAYBOOK_PREFERRED_MAP] : names}
            books={treeBooks}
            mapName={boardMap}
            activeKey={activeKey}
            activePageId={book?.activePageId ?? null}
            expandedBooks={treeExpandedBooks}
            collapsedMaps={collapsedMaps}
            onSelectMap={tutorialPlaybook ? () => undefined : setMapName}
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
              const isOpen = openedBooksRef.current.has(key) || expandedBooks.has(key);
              if (isOpen) {
                openedBooksRef.current.delete(key);
                setExpandedBooks((prev) => {
                  const next = new Set(prev);
                  next.delete(key);
                  return next;
                });
                return;
              }
              setExpandedBooks((prev) => new Set(prev).add(key));
            }}
            onSelectStrat={openStrat}
            onCommitBookTitle={(row, title) => void commitBookTitle(row.key, title)}
            onCommitStratTitle={(row, pageId, title) =>
              void commitStratTitle(row.key, pageId, title)
            }
            onMoveBook={(row, toIndex) => void movePlaybook(row.key, toIndex)}
            onMoveStrat={(row, pageId, toIndex) => void moveStrat(row.key, pageId, toIndex)}
            onNewPlaybook={tutorialPlaybook ? () => undefined : createBookOnMap}
            onNewStrat={(row) => {
              setExpandedBooks((prev) => new Set(prev).add(row.key));
              if (row.key === activeKey) addStrat();
              else void addStratTo(row.key);
            }}
            onExportPdf={requestExport}
            onDuplicateBook={(row) => {
              if (tutorialPlaybook) return;
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
            onDeleteBook={(row) => {
              if (tutorialPlaybook) return;
              void removeBook(row.key);
            }}
            onDeleteStrat={(row, pageId) => {
              if (row.key === activeKey) removeStrat(pageId);
              else void removeStratFrom(row.key, pageId);
            }}
            sandbox={tutorialPlaybook}
          />
        </aside>
      </div>
      <p className="keys">{PLAYBOOK_KEYS_HINT}</p>
      {pdfExportBook ? (
        <PlaybookPdfExportDialog
          bookTitle={pdfExportBook.title}
          current={settings.pdfPhotos}
          busy={exportingKey === pdfExportBook.key}
          onChoose={(photos) => exportBook(pdfExportBook, photos)}
          onClose={() => {
            if (!exportingKey) setPdfExportBook(null);
          }}
        />
      ) : null}
    </div>
  );
}
