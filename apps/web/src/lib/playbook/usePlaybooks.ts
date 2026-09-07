import { useCallback, useEffect, useRef, useState } from "react";
import { PROJECT_SAVE_DEBOUNCE_MS } from "@/lib/shared/constants";
import {
  addPage,
  deletePage,
  duplicatePage,
  renamePage,
  renamePlaybook,
  setActivePage,
} from "./pages";
import { createPlaybook, listPlaybooksForMap, loadPlaybook, savePlaybook } from "./playbookStore";
import type { Playbook } from "./types";

export function usePlaybooks(mapName: string | null) {
  const [books, setBooks] = useState<Playbook[]>([]);
  const [activeByMap, setActiveByMap] = useState<Record<string, string | null>>({});
  const [draft, setDraft] = useState<Playbook | null>(null);
  const skipSaveRef = useRef(true);
  const activeKey = mapName ? (activeByMap[mapName] ?? null) : null;
  const book =
    draft && mapName && draft.mapName === mapName && draft.key === activeKey ? draft : null;

  const refresh = useCallback(async () => {
    if (!mapName) return;
    setBooks(await listPlaybooksForMap(mapName));
  }, [mapName]);

  useEffect(() => {
    if (!mapName) return;
    let cancelled = false;
    void listPlaybooksForMap(mapName).then((list) => {
      if (!cancelled) setBooks(list);
    });
    return () => {
      cancelled = true;
    };
  }, [mapName]);

  useEffect(() => {
    if (!activeKey) return;
    let cancelled = false;
    skipSaveRef.current = true;
    void loadPlaybook(activeKey).then((loaded) => {
      if (cancelled) return;
      if (loaded) setDraft(loaded);
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
    (key: string | null) => {
      if (!mapName) return;
      setActiveByMap((prev) => ({ ...prev, [mapName]: key }));
    },
    [mapName],
  );

  const create = useCallback(
    async (title: string) => {
      if (!mapName) return;
      const next = await createPlaybook(mapName, title);
      skipSaveRef.current = true;
      setDraft(next);
      setActiveByMap((prev) => ({ ...prev, [mapName]: next.key }));
      await refresh();
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

  const addStrat = useCallback(() => {
    patch((current) => addPage(current));
  }, [patch]);

  const renameStrat = useCallback(
    (pageId: string, title: string) => {
      patch((current) => renamePage(current, pageId, title));
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

  return {
    books: mapName ? books.filter((row) => row.mapName === mapName) : [],
    book,
    activeKey,
    select,
    create,
    rename,
    addStrat,
    renameStrat,
    removeStrat,
    duplicateStrat,
    selectStrat,
  };
}
