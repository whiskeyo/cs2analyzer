import { DEMO_TAG_STORE, idbAvailable, openCs2Db, requestOf } from "@/lib/storage/idb";
import { isTutorialProject } from "@/lib/tutorial/identity";
import { normalizeTags } from "./tags";

export interface DemoTagRow {
  key: string;
  tags: string[];
}

function parseRow(raw: unknown): DemoTagRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as { key?: unknown; tags?: unknown };
  if (typeof row.key !== "string" || row.key.length === 0) return null;
  if (isTutorialProject({ key: row.key })) return null;
  if (!Array.isArray(row.tags)) return null;
  const tags = normalizeTags(row.tags.filter((tag): tag is string => typeof tag === "string"));
  if (tags.length === 0) return null;
  return { key: row.key, tags };
}

/** Tags for one demo key. Missing and tutorial rows are an empty list. */
export async function loadDemoTags(key: string): Promise<string[]> {
  if (!idbAvailable() || key.length === 0 || isTutorialProject({ key })) return [];
  const db = await openCs2Db();
  try {
    const tx = db.transaction(DEMO_TAG_STORE, "readonly");
    const raw = await requestOf(tx.objectStore(DEMO_TAG_STORE).get(key));
    return parseRow(raw)?.tags ?? [];
  } finally {
    db.close();
  }
}

/** Replace tags for a demo. An empty list deletes the row. */
export async function saveDemoTags(key: string, tags: readonly string[]): Promise<void> {
  if (!idbAvailable() || key.length === 0 || isTutorialProject({ key })) return;
  const normalized = normalizeTags(tags);
  const db = await openCs2Db();
  try {
    const tx = db.transaction(DEMO_TAG_STORE, "readwrite");
    const store = tx.objectStore(DEMO_TAG_STORE);
    if (normalized.length === 0) {
      await requestOf(store.delete(key));
      return;
    }
    await requestOf(store.put({ key, tags: normalized }));
  } finally {
    db.close();
  }
}

export async function loadAllDemoTags(): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!idbAvailable()) return out;
  const db = await openCs2Db();
  try {
    const tx = db.transaction(DEMO_TAG_STORE, "readonly");
    const raw = await requestOf(tx.objectStore(DEMO_TAG_STORE).getAll());
    for (const row of raw ?? []) {
      const parsed = parseRow(row);
      if (parsed) out.set(parsed.key, parsed.tags);
    }
    return out;
  } finally {
    db.close();
  }
}
