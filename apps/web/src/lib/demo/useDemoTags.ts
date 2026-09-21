import { useCallback, useEffect, useRef, useState } from "react";
import type { LoadedDemo } from "@/lib/parse/session";
import { matchKey } from "@/lib/notes/projectStore";
import { isTutorialLoadedDemo } from "@/lib/tutorial/identity";
import { loadDemoTags, saveDemoTags } from "./tagStore";
import { normalizeTags, sameTags } from "./tags";

/** IndexedDB key for a real demo. Tutorial fixtures stay in memory only. */
export function demoTagKey(demo: LoadedDemo | null): string | null {
  if (!demo || isTutorialLoadedDemo(demo)) return null;
  return matchKey(demo.replay, demo.fileName);
}

/**
 * Tags for the open demo. Writes are serialized so a slower save cannot
 * overwrite a newer list.
 */
export function useDemoTags(demo: LoadedDemo | null): {
  tags: string[];
  setTags: (next: readonly string[]) => void;
} {
  const key = demoTagKey(demo);
  const [tags, setTagsState] = useState<string[]>([]);
  const [seenKey, setSeenKey] = useState(key);
  const tagsRef = useRef(tags);
  const keyRef = useRef(key);
  const editedRef = useRef(false);
  const pendingRef = useRef<{ key: string; tags: string[] } | null>(null);
  const chainRef = useRef(Promise.resolve());

  if (key !== seenKey) {
    setSeenKey(key);
    setTagsState([]);
    tagsRef.current = [];
  } else {
    tagsRef.current = tags;
  }
  keyRef.current = key;

  useEffect(() => {
    editedRef.current = false;
    if (!key) return;
    let cancelled = false;
    void loadDemoTags(key)
      .then((loaded) => {
        if (cancelled || editedRef.current || keyRef.current !== key) return;
        tagsRef.current = loaded;
        setTagsState((prev) => (sameTags(prev, loaded) ? prev : loaded));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [key]);

  const setTags = useCallback((next: readonly string[]) => {
    const normalized = normalizeTags(next);
    const currentKey = keyRef.current;
    editedRef.current = true;
    tagsRef.current = normalized;
    setTagsState(normalized);
    if (!currentKey) return;
    pendingRef.current = { key: currentKey, tags: normalized };
    chainRef.current = chainRef.current
      .catch(() => undefined)
      .then(async () => {
        const pending = pendingRef.current;
        if (!pending) return;
        pendingRef.current = null;
        try {
          await saveDemoTags(pending.key, pending.tags);
        } catch {
          if (pendingRef.current == null) pendingRef.current = pending;
        }
      });
  }, []);

  return { tags, setTags };
}
