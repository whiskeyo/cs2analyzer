import { useCallback, useEffect, useRef, useState } from "react";
import type { FloorMode, Note } from "@/lib/notes/types";
import { PROJECT_SAVE_DEBOUNCE_MS } from "@/lib/shared/constants";
import { reportQuotaError } from "@/lib/storage/quota";
import { PLAYBOOKS_CHANGED_EVENT } from "./events";
import {
  addPage,
  deletePage,
  duplicatePage,
  duplicatePlaybook,
  finishRenamePage,
  finishRenamePlaybook,
  renamePage,
  renamePlaybook,
  reorderPages,
  setActivePage,
  setPageBody,
  setPageFloor,
  clonedPageImageIdMap,
  pageImageIds,
  playbookFloorImages,
  setPageLayerImages,
  setPageLayerNote,
  setPageLayerVideos,
  type PlaybookFloorLayer,
  setPlaybookPalette,
} from "./pages";
import { copyPlaybookImageBlobs, deletePlaybookImageBlobs } from "./playbookImageStore";
import { forgetPlaybookImages } from "./playbookImageBitmaps";
import type { Playbook, PlaybookImage, PlaybookYouTube } from "./types";
import {
  createPlaybook,
  deletePlaybook,
  loadAllPlaybooks,
  loadPlaybook,
  savePlaybook,
} from "./playbookStore";
import { booksWithDraft, movePlaybookTo, nextPlaybookSort } from "./tree";

export function usePlaybooks(
  mapName: string | null,
  source: { mode: "idb" } | { mode: "sandbox"; books: Playbook[] } = {
    mode: "idb",
  },
) {
  const sandboxMode = source.mode === "sandbox";
  const sandboxBooks = source.mode === "sandbox" ? source.books : [];
  const [allBooks, setAllBooks] = useState<Playbook[]>([]);
  const [activeByMap, setActiveByMap] = useState<Record<string, string | null>>({});
  const [draft, setDraft] = useState<Playbook | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const skipSaveRef = useRef(true);
  const [sandboxSeed, setSandboxSeed] = useState<Playbook[] | "idb">("idb");
  if (sandboxMode) {
    const sameSeed =
      sandboxSeed !== "idb" &&
      sandboxSeed.length === sandboxBooks.length &&
      sandboxSeed.every((book, index) => book === sandboxBooks[index]);
    if (!sameSeed) {
      setSandboxSeed(sandboxBooks);
      skipSaveRef.current = true;
      setAllBooks(sandboxBooks);
      const active: Record<string, string | null> = {};
      for (const row of sandboxBooks) {
        if (active[row.mapName] == null) active[row.mapName] = row.key;
      }
      setActiveByMap(active);
      const key = mapName ? active[mapName] : null;
      setDraft(key ? (sandboxBooks.find((row) => row.key === key) ?? null) : null);
    } else if (!mapName) {
      if (draft) setDraft(null);
    } else {
      const key = activeByMap[mapName];
      const next =
        allBooks.find((row) => row.mapName === mapName && (key == null || row.key === key)) ??
        allBooks.find((row) => row.mapName === mapName) ??
        null;
      if (draft?.key !== next?.key) setDraft(next);
      if (draft) {
        const index = allBooks.findIndex((row) => row.key === draft.key);
        if (index < 0) setAllBooks([...allBooks, draft]);
        else if (allBooks[index] !== draft) {
          const merged = allBooks.slice();
          merged[index] = draft;
          setAllBooks(merged);
        }
      }
    }
  } else if (sandboxSeed !== "idb") {
    setSandboxSeed("idb");
    skipSaveRef.current = true;
    setAllBooks([]);
    setDraft(null);
    setActiveByMap({});
  }
  const activeKey = mapName ? (activeByMap[mapName] ?? null) : null;
  const book =
    draft && mapName && draft.mapName === mapName && draft.key === activeKey ? draft : null;

  const refresh = useCallback(async () => {
    if (sandboxMode) return;
    setAllBooks(await loadAllPlaybooks());
  }, [sandboxMode]);

  useEffect(() => {
    if (sandboxMode) return;
    void loadAllPlaybooks().then(setAllBooks);
  }, [sandboxMode]);

  useEffect(() => {
    if (sandboxMode) return;
    const onChanged = () => {
      void refresh();
    };
    window.addEventListener(PLAYBOOKS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PLAYBOOKS_CHANGED_EVENT, onChanged);
  }, [refresh, sandboxMode]);

  useEffect(() => {
    if (sandboxMode || !activeKey) return;
    let cancelled = false;
    skipSaveRef.current = true;
    void loadPlaybook(activeKey).then((loaded) => {
      if (cancelled) return;
      setDraft(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [activeKey, sandboxMode]);

  useEffect(() => {
    if (sandboxMode || !book) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      void savePlaybook(book)
        .then(() => {
          setSaveError(null);
          void refresh();
        })
        .catch((err) => {
          reportQuotaError(err, setSaveError);
        });
    }, PROJECT_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [book, refresh, sandboxMode]);

  const select = useCallback(
    (key: string | null, map = mapName) => {
      if (!map) return;
      setActiveByMap((prev) => ({ ...prev, [map]: key }));
    },
    [mapName],
  );

  const create = useCallback(
    async (title: string, map = mapName) => {
      if (sandboxMode || !map) return null;
      const next = await createPlaybook(map, title);
      skipSaveRef.current = true;
      setDraft(next);
      setActiveByMap((prev) => ({ ...prev, [map]: next.key }));
      await refresh();
      return next;
    },
    [mapName, refresh, sandboxMode],
  );

  const patch = useCallback((fn: (current: Playbook) => Playbook) => {
    setDraft((prev) => (prev ? fn(prev) : prev));
  }, []);

  const rename = useCallback(
    (title: string) => {
      patch((current) => renamePlaybook(current, title));
    },
    [patch],
  );

  const finishRename = useCallback(() => {
    patch((current) => finishRenamePlaybook(current));
  }, [patch]);

  const addStrat = useCallback(() => {
    patch((current) => addPage(current));
  }, [patch]);

  const renameStrat = useCallback(
    (pageId: string, title: string) => {
      patch((current) => renamePage(current, pageId, title));
    },
    [patch],
  );

  const finishRenameStrat = useCallback(
    (pageId: string) => {
      patch((current) => finishRenamePage(current, pageId));
    },
    [patch],
  );

  const commitBookTitle = useCallback(
    async (key: string, title: string) => {
      const apply = (current: Playbook) => finishRenamePlaybook(renamePlaybook(current, title));
      if (draft?.key === key) {
        patch(apply);
        return;
      }
      if (sandboxMode) return;
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh, sandboxMode],
  );

  const commitStratTitle = useCallback(
    async (key: string, pageId: string, title: string) => {
      const apply = (current: Playbook) =>
        finishRenamePage(renamePage(current, pageId, title), pageId);
      if (draft?.key === key) {
        patch(apply);
        return;
      }
      if (sandboxMode) return;
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh, sandboxMode],
  );

  const setBody = useCallback(
    (pageId: string, body: string) => {
      patch((current) => setPageBody(current, pageId, body));
    },
    [patch],
  );

  const setVideos = useCallback(
    (pageId: string, videos: PlaybookYouTube[], layer: PlaybookFloorLayer = "upper") => {
      patch((current) => setPageLayerVideos(current, pageId, layer, videos));
    },
    [patch],
  );

  const setImages = useCallback(
    (pageId: string, images: PlaybookImage[], layer: PlaybookFloorLayer = "upper") => {
      patch((current) => {
        const page = current.pages.find((row) => row.id === pageId);
        if (page) {
          const prev = playbookFloorImages(page, layer);
          const kept = new Set(images.map((image) => image.id));
          const removed = prev.filter((image) => !kept.has(image.id)).map((image) => image.id);
          if (removed.length > 0) {
            forgetPlaybookImages(removed);
            void deletePlaybookImageBlobs(removed);
          }
        }
        return setPageLayerImages(current, pageId, layer, images);
      });
    },
    [patch],
  );

  const setFloor = useCallback(
    (pageId: string, floor: FloorMode) => {
      patch((current) => setPageFloor(current, pageId, floor));
    },
    [patch],
  );

  const removeStrat = useCallback(
    (pageId: string) => {
      patch((current) => {
        const page = current.pages.find((row) => row.id === pageId);
        if (page) {
          const ids = pageImageIds(page);
          forgetPlaybookImages(ids);
          void deletePlaybookImageBlobs(ids);
        }
        return deletePage(current, pageId);
      });
    },
    [patch],
  );

  const duplicateStrat = useCallback(
    (pageId: string) => {
      patch((current) => {
        const source = current.pages.find((row) => row.id === pageId);
        const next = duplicatePage(current, pageId);
        const copy = next.pages.find((row) => row.id === next.activePageId);
        if (source && copy) {
          void copyPlaybookImageBlobs(clonedPageImageIdMap(source, copy)).catch((err) => {
            reportQuotaError(err, setSaveError);
          });
        }
        return next;
      });
    },
    [patch],
  );

  const selectStrat = useCallback(
    (pageId: string) => {
      patch((current) => setActivePage(current, pageId));
    },
    [patch],
  );

  const setNote = useCallback(
    (note: Note, layer: PlaybookFloorLayer = "upper") => {
      patch((current) => setPageLayerNote(current, current.activePageId, layer, note));
    },
    [patch],
  );

  const remove = useCallback(async () => {
    if (sandboxMode || !book || !mapName) return;
    const key = book.key;
    skipSaveRef.current = true;
    setDraft(null);
    setActiveByMap((prev) => ({ ...prev, [mapName]: null }));
    await deletePlaybook(key);
    await refresh();
  }, [book, mapName, refresh, sandboxMode]);

  const removeBook = useCallback(
    async (key: string) => {
      if (sandboxMode) return;
      if (draft?.key === key) {
        await remove();
        return;
      }
      await deletePlaybook(key);
      await refresh();
    },
    [draft?.key, refresh, remove, sandboxMode],
  );

  const duplicateBook = useCallback(
    async (key: string) => {
      if (sandboxMode) return null;
      const loaded = draft?.key === key ? draft : await loadPlaybook(key);
      if (!loaded) return null;
      const duplicated = duplicatePlaybook(loaded);
      const idMap = new Map<string, string>();
      loaded.pages.forEach((page, index) => {
        const copy = duplicated.pages[index];
        if (copy) {
          for (const [from, to] of clonedPageImageIdMap(page, copy)) idMap.set(from, to);
        }
      });
      if (idMap.size > 0) {
        try {
          await copyPlaybookImageBlobs(idMap);
        } catch (err) {
          reportQuotaError(err, setSaveError);
          return null;
        }
      }
      try {
        const copy = await savePlaybook({
          ...duplicated,
          sort: nextPlaybookSort(allBooks, loaded.mapName),
        });
        skipSaveRef.current = true;
        setDraft(copy);
        setActiveByMap((prev) => ({ ...prev, [copy.mapName]: copy.key }));
        await refresh();
        return copy;
      } catch (err) {
        reportQuotaError(err, setSaveError);
        return null;
      }
    },
    [allBooks, draft, refresh, sandboxMode],
  );

  const addStratTo = useCallback(
    async (key: string) => {
      const apply = (current: Playbook) => addPage(current);
      if (draft?.key === key) {
        patch(apply);
        return;
      }
      if (sandboxMode) return;
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh, sandboxMode],
  );

  const removeStratFrom = useCallback(
    async (key: string, pageId: string) => {
      const apply = (current: Playbook) => {
        const page = current.pages.find((row) => row.id === pageId);
        if (page) {
          const ids = pageImageIds(page);
          forgetPlaybookImages(ids);
          void deletePlaybookImageBlobs(ids);
        }
        return deletePage(current, pageId);
      };
      if (draft?.key === key) {
        patch(apply);
        return;
      }
      if (sandboxMode) return;
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh, sandboxMode],
  );

  const duplicateStratOn = useCallback(
    async (key: string, pageId: string) => {
      const apply = (current: Playbook) => {
        const source = current.pages.find((row) => row.id === pageId);
        const next = duplicatePage(current, pageId);
        const copy = next.pages.find((row) => row.id === next.activePageId);
        if (source && copy) {
          void copyPlaybookImageBlobs(clonedPageImageIdMap(source, copy)).catch((err) => {
            reportQuotaError(err, setSaveError);
          });
        }
        return next;
      };
      if (draft?.key === key) {
        patch(apply);
        return;
      }
      if (sandboxMode) return;
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh, sandboxMode],
  );

  const setPalette = useCallback(
    (paletteId: string, color?: string) => {
      patch((current) => setPlaybookPalette(current, paletteId, color));
    },
    [patch],
  );

  const movePlaybook = useCallback(
    async (key: string, toIndex: number) => {
      if (sandboxMode) return;
      const merged = booksWithDraft(allBooks, draft);
      const target = merged.find((row) => row.key === key);
      if (!target) return;
      const changed = movePlaybookTo(merged, target.mapName, key, toIndex);
      if (changed.length === 0) return;
      const saved: Playbook[] = [];
      for (const row of changed) {
        saved.push(await savePlaybook(row));
      }
      const nextDraft = saved.find((row) => row.key === draft?.key);
      if (nextDraft) {
        skipSaveRef.current = true;
        setDraft(nextDraft);
      }
      await refresh();
    },
    [allBooks, draft, refresh, sandboxMode],
  );

  const moveStrat = useCallback(
    async (key: string, pageId: string, toIndex: number) => {
      const apply = (current: Playbook) => {
        const from = current.pages.findIndex((page) => page.id === pageId);
        return reorderPages(current, from, toIndex);
      };
      if (draft?.key === key) {
        patch(apply);
        return;
      }
      if (sandboxMode) return;
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh, sandboxMode],
  );

  const reload = useCallback(async () => {
    if (sandboxMode) return;
    await refresh();
    if (!activeKey) {
      setDraft(null);
      return;
    }
    skipSaveRef.current = true;
    const loaded = await loadPlaybook(activeKey);
    setDraft(loaded);
    if (!loaded && mapName) {
      setActiveByMap((prev) => ({ ...prev, [mapName]: null }));
    }
  }, [refresh, activeKey, mapName, sandboxMode]);

  return {
    allBooks,
    books: mapName ? allBooks.filter((row) => row.mapName === mapName) : [],
    book,
    activeKey,
    select,
    create,
    rename,
    finishRename,
    addStrat,
    renameStrat,
    finishRenameStrat,
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
    remove,
    removeBook,
    duplicateBook,
    addStratTo,
    removeStratFrom,
    duplicateStratOn,
    movePlaybook,
    moveStrat,
    reload,
    saveError,
  };
}
