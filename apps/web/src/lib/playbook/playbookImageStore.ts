import { PLAYBOOK_IMAGE_STORE, idbAvailable, openCs2Db, requestOf } from "@/lib/storage/idb";

export interface PlaybookImageRow {
  id: string;
  blob: Blob;
}

const memory = new Map<string, Blob>();

export async function putPlaybookImageBlob(id: string, blob: Blob): Promise<void> {
  memory.set(id, blob);
  if (!idbAvailable()) return;
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PLAYBOOK_IMAGE_STORE, "readwrite");
    await requestOf(tx.objectStore(PLAYBOOK_IMAGE_STORE).put({ id, blob }));
  } finally {
    db.close();
  }
}

export async function getPlaybookImageBlob(id: string): Promise<Blob | null> {
  if (idbAvailable()) {
    const db = await openCs2Db();
    try {
      const tx = db.transaction(PLAYBOOK_IMAGE_STORE, "readonly");
      const row = await requestOf(tx.objectStore(PLAYBOOK_IMAGE_STORE).get(id));
      if (row && row.blob instanceof Blob) {
        memory.set(id, row.blob);
        return row.blob;
      }
    } finally {
      db.close();
    }
  }
  return memory.get(id) ?? null;
}

export async function loadPlaybookImageBlobs(ids: readonly string[]): Promise<Map<string, Blob>> {
  const out = new Map<string, Blob>();
  const unique = [...new Set(ids)];
  if (unique.length === 0) return out;
  if (idbAvailable()) {
    const db = await openCs2Db();
    try {
      const tx = db.transaction(PLAYBOOK_IMAGE_STORE, "readonly");
      const store = tx.objectStore(PLAYBOOK_IMAGE_STORE);
      await Promise.all(
        unique.map(async (id) => {
          const row = await requestOf(store.get(id));
          if (row && row.blob instanceof Blob) {
            memory.set(id, row.blob);
            out.set(id, row.blob);
          }
        }),
      );
    } finally {
      db.close();
    }
  }
  for (const id of unique) {
    if (out.has(id)) continue;
    const blob = memory.get(id);
    if (blob) out.set(id, blob);
  }
  return out;
}

export async function deletePlaybookImageBlobs(ids: readonly string[]): Promise<void> {
  const unique = [...new Set(ids)];
  for (const id of unique) memory.delete(id);
  if (!idbAvailable() || unique.length === 0) return;
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PLAYBOOK_IMAGE_STORE, "readwrite");
    const store = tx.objectStore(PLAYBOOK_IMAGE_STORE);
    await Promise.all(unique.map((id) => requestOf(store.delete(id))));
  } finally {
    db.close();
  }
}

export async function copyPlaybookImageBlobs(idMap: ReadonlyMap<string, string>): Promise<void> {
  if (idMap.size === 0) return;
  const blobs = await loadPlaybookImageBlobs([...idMap.keys()]);
  for (const [from, to] of idMap) {
    const blob = blobs.get(from);
    if (blob) await putPlaybookImageBlob(to, blob);
  }
}

export async function clearPlaybookImageBlobs(): Promise<void> {
  memory.clear();
  if (!idbAvailable()) return;
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PLAYBOOK_IMAGE_STORE, "readwrite");
    await requestOf(tx.objectStore(PLAYBOOK_IMAGE_STORE).clear());
  } finally {
    db.close();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not encode image."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not encode image."));
    reader.readAsDataURL(blob);
  });
}

export function isPlaybookImageDataUrl(value: string): boolean {
  return /^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(value);
}

export function dataUrlToBlob(dataUrl: string): Blob | null {
  if (!isPlaybookImageDataUrl(dataUrl)) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const header = dataUrl.slice(5, comma);
  const mime = header.split(";")[0]?.toLowerCase();
  if (!mime) return null;
  try {
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime === "image/jpg" ? "image/jpeg" : mime });
  } catch {
    return null;
  }
}

export function parsePlaybookImageDataUrls(value: unknown): Record<string, string> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [id, url] of Object.entries(value as Record<string, unknown>)) {
    if (id.trim() === "" || typeof url !== "string" || !isPlaybookImageDataUrl(url)) continue;
    out[id] = url;
  }
  return out;
}
