import { PLAYBOOK_STORE, idbAvailable, openCs2Db, requestOf } from "@/lib/storage/idb";
import { parsePlaybook } from "./parse";
import { newPlaybook } from "./pages";
import type { Playbook } from "./types";

function byRecency(a: Playbook, b: Playbook): number {
  if (b.savedAt !== a.savedAt) return b.savedAt - a.savedAt;
  return a.title.localeCompare(b.title);
}

export async function savePlaybook(book: Playbook): Promise<Playbook> {
  const next = { ...book, savedAt: Date.now() };
  if (!idbAvailable()) return next;
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PLAYBOOK_STORE, "readwrite");
    await requestOf(tx.objectStore(PLAYBOOK_STORE).put(next));
  } finally {
    db.close();
  }
  return next;
}

export async function loadPlaybook(key: string): Promise<Playbook | null> {
  if (!idbAvailable()) return null;
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PLAYBOOK_STORE, "readonly");
    const raw = await requestOf(tx.objectStore(PLAYBOOK_STORE).get(key));
    return parsePlaybook(raw);
  } finally {
    db.close();
  }
}

export async function loadAllPlaybooks(): Promise<Playbook[]> {
  if (!idbAvailable()) return [];
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PLAYBOOK_STORE, "readonly");
    const raw = await requestOf(tx.objectStore(PLAYBOOK_STORE).getAll());
    const out: Playbook[] = [];
    for (const row of raw ?? []) {
      const book = parsePlaybook(row);
      if (book) out.push(book);
    }
    return out.sort(byRecency);
  } finally {
    db.close();
  }
}

export async function listPlaybooksForMap(mapName: string): Promise<Playbook[]> {
  const all = await loadAllPlaybooks();
  return all.filter((book) => book.mapName === mapName);
}

export async function createPlaybook(mapName: string, title: string): Promise<Playbook> {
  return savePlaybook(newPlaybook(mapName, title));
}

export async function deletePlaybook(key: string): Promise<void> {
  if (!idbAvailable()) return;
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PLAYBOOK_STORE, "readwrite");
    await requestOf(tx.objectStore(PLAYBOOK_STORE).delete(key));
  } finally {
    db.close();
  }
}

export async function deleteAllPlaybooks(): Promise<number> {
  if (!idbAvailable()) return 0;
  const existing = await loadAllPlaybooks();
  if (existing.length === 0) return 0;
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PLAYBOOK_STORE, "readwrite");
    await requestOf(tx.objectStore(PLAYBOOK_STORE).clear());
  } finally {
    db.close();
  }
  return existing.length;
}

export async function countPlaybooks(): Promise<number> {
  if (!idbAvailable()) return 0;
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PLAYBOOK_STORE, "readonly");
    return await requestOf(tx.objectStore(PLAYBOOK_STORE).count());
  } finally {
    db.close();
  }
}
