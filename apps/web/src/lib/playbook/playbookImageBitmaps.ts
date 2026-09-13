import { loadPlaybookImageBlobs } from "./playbookImageStore";

const cache = new Map<string, { img: HTMLImageElement; url: string }>();

export function rememberPlaybookImage(id: string, blob: Blob): HTMLImageElement {
  const existing = cache.get(id);
  if (existing) URL.revokeObjectURL(existing.url);
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.src = url;
  cache.set(id, { img, url });
  return img;
}

export function forgetPlaybookImages(ids: readonly string[]): void {
  for (const id of ids) {
    const row = cache.get(id);
    if (!row) continue;
    URL.revokeObjectURL(row.url);
    cache.delete(id);
  }
}

export function peekPlaybookImageBitmap(id: string): HTMLImageElement | undefined {
  return cache.get(id)?.img;
}

export async function loadPlaybookImageBitmaps(
  ids: readonly string[],
): Promise<Map<string, HTMLImageElement>> {
  const out = new Map<string, HTMLImageElement>();
  const missing: string[] = [];
  for (const id of ids) {
    const cached = cache.get(id);
    if (cached) out.set(id, cached.img);
    else missing.push(id);
  }
  if (missing.length === 0) return out;
  const blobs = await loadPlaybookImageBlobs(missing);
  for (const [id, blob] of blobs) {
    out.set(id, rememberPlaybookImage(id, blob));
  }
  return out;
}
