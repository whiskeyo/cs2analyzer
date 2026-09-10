import { useCallback, useEffect, useRef, useState } from "react";
import type { Note } from "@/lib/notes/types";
import { PROJECT_SAVE_DEBOUNCE_MS } from "@/lib/shared/constants";
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
  setPageNote,
  setPageVideos,
  setPlaybookPalette,
} from "./pages";
import {
  createPlaybook,
  deletePlaybook,
  loadAllPlaybooks,
  loadPlaybook,
  savePlaybook,
} from "./playbookStore";
import { booksWithDraft, movePlaybookTo, nextPlaybookSort } from "./tree";
import type { Playbook, PlaybookYouTube } from "./types";

export function usePlaybooks(mapName: string | null) {
  const [allBooks, setAllBooks] = useState<Playbook[]>([]);
  const [activeByMap, setActiveByMap] = useState<Record<string, string | null>>({});
  const [draft, setDraft] = useState<Playbook | null>(null);
  const skipSaveRef = useRef(true);
  const activeKey = mapName ? (activeByMap[mapName] ?? null) : null;
  const book =
    draft && mapName && draft.mapName === mapName && draft.key === activeKey ? draft : null;

  const refresh = useCallback(async () => {
    setAllBooks(await loadAllPlaybooks());
  }, []);

  useEffect(() => {
    void loadAllPlaybooks().then(setAllBooks);
  }, []);

  useEffect(() => {
    const onChanged = () => {
      void refresh();
    };
    window.addEventListener(PLAYBOOKS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PLAYBOOKS_CHANGED_EVENT, onChanged);
  }, [refresh]);

  useEffect(() => {
    if (!activeKey) return;
    let cancelled = false;
    skipSaveRef.current = true;
    void loadPlaybook(activeKey).then((loaded) => {
      if (cancelled) return;
      setDraft(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [activeKey]);

  useEffect(() => {
    if (!book) return;
    if (skipSaveRef.current) {
      skipSaveRef.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      void savePlaybook(book).then(() => void refresh());
    }, PROJECT_SAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [book, refresh]);

  const select = useCallback(
    (key: string | null, map = mapName) => {
      if (!map) return;
      setActiveByMap((prev) => ({ ...prev, [map]: key }));
    },
    [mapName],
  );

  const create = useCallback(
    async (title: string, map = mapName) => {
      if (!map) return null;
      const next = await createPlaybook(map, title);
      skipSaveRef.current = true;
      setDraft(next);
      setActiveByMap((prev) => ({ ...prev, [map]: next.key }));
      await refresh();
      return next;
    },
    [mapName, refresh],
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
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh],
  );

  const commitStratTitle = useCallback(
    async (key: string, pageId: string, title: string) => {
      const apply = (current: Playbook) =>
        finishRenamePage(renamePage(current, pageId, title), pageId);
      if (draft?.key === key) {
        patch(apply);
        return;
      }
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh],
  );

  const setBody = useCallback(
    (pageId: string, body: string) => {
      patch((current) => setPageBody(current, pageId, body));
    },
    [patch],
  );

  const setVideos = useCallback(
    (pageId: string, videos: PlaybookYouTube[]) => {
      patch((current) => setPageVideos(current, pageId, videos));
    },
    [patch],
  );

  const removeStrat = useCallback(
    (pageId: string) => {
      patch((current) => deletePage(current, pageId));
    },
    [patch],
  );

  const duplicateStrat = useCallback(
    (pageId: string) => {
      patch((current) => duplicatePage(current, pageId));
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
    (note: Note) => {
      patch((current) => setPageNote(current, current.activePageId, note));
    },
    [patch],
  );

  const remove = useCallback(async () => {
    if (!book || !mapName) return;
    const key = book.key;
    skipSaveRef.current = true;
    setDraft(null);
    setActiveByMap((prev) => ({ ...prev, [mapName]: null }));
    await deletePlaybook(key);
    await refresh();
  }, [book, mapName, refresh]);

  const removeBook = useCallback(
    async (key: string) => {
      if (draft?.key === key) {
        await remove();
        return;
      }
      await deletePlaybook(key);
      await refresh();
    },
    [draft?.key, refresh, remove],
  );

  const duplicateBook = useCallback(
    async (key: string) => {
      const loaded = draft?.key === key ? draft : await loadPlaybook(key);
      if (!loaded) return null;
      const copy = await savePlaybook({
        ...duplicatePlaybook(loaded),
        sort: nextPlaybookSort(allBooks, loaded.mapName),
      });
      skipSaveRef.current = true;
      setDraft(copy);
      setActiveByMap((prev) => ({ ...prev, [copy.mapName]: copy.key }));
      await refresh();
      return copy;
    },
    [allBooks, draft, refresh],
  );

  const addStratTo = useCallback(
    async (key: string) => {
      const apply = (current: Playbook) => addPage(current);
      if (draft?.key === key) {
        patch(apply);
        return;
      }
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh],
  );

  const removeStratFrom = useCallback(
    async (key: string, pageId: string) => {
      const apply = (current: Playbook) => deletePage(current, pageId);
      if (draft?.key === key) {
        patch(apply);
        return;
      }
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh],
  );

  const duplicateStratOn = useCallback(
    async (key: string, pageId: string) => {
      const apply = (current: Playbook) => duplicatePage(current, pageId);
      if (draft?.key === key) {
        patch(apply);
        return;
      }
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh],
  );

  const setPalette = useCallback(
    (paletteId: string, color?: string) => {
      patch((current) => setPlaybookPalette(current, paletteId, color));
    },
    [patch],
  );

  const movePlaybook = useCallback(
    async (key: string, toIndex: number) => {
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
    [allBooks, draft, refresh],
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
      const loaded = await loadPlaybook(key);
      if (!loaded) return;
      await savePlaybook(apply(loaded));
      await refresh();
    },
    [draft?.key, patch, refresh],
  );

  const reload = useCallback(async () => {
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
  }, [refresh, activeKey, mapName]);

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
  };
}
