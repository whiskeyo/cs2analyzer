import { DEMO_TAG_MAX_COUNT, DEMO_TAG_MAX_LENGTH } from "@/lib/shared/constants";

const TAG_BODY = /[^a-z0-9-]/g;

/**
 * Lowercase, strip one leading hash, and turn spaces or underscores into hyphens.
 * Returns null when nothing tag-like remains.
 */
export function normalizeTag(raw: string): string | null {
  let text = raw.trim().toLowerCase();
  if (text.startsWith("#")) text = text.slice(1).trim();
  text = text
    .replace(/[\s_]+/g, "-")
    .replace(TAG_BODY, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (text.length > DEMO_TAG_MAX_LENGTH) {
    text = text.slice(0, DEMO_TAG_MAX_LENGTH).replace(/-+$/g, "");
  }
  return text.length > 0 ? text : null;
}

/** Unique tags in first-seen order, capped at the demo limit. */
export function normalizeTags(raw: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const tag = normalizeTag(item);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= DEMO_TAG_MAX_COUNT) break;
  }
  return out;
}

/**
 * One field may hold several tags: commas, or a new hash, start the next.
 * Spaces inside a single token become hyphens (`eco round` → `eco-round`).
 */
export function tagsFromInput(raw: string): string[] {
  const chunks: string[] = [];
  for (const commaPart of raw.split(",")) {
    const hashed = commaPart.split("#");
    if (hashed.length === 1) {
      chunks.push(commaPart);
      continue;
    }
    for (const piece of hashed) {
      if (piece.trim() !== "") chunks.push(piece);
    }
  }
  return normalizeTags(chunks);
}

export function sameTags(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((tag, index) => tag === b[index]);
}

/** Empty query keeps every row. A typed query matches tags that contain it. */
export function projectMatchesTag(
  key: string,
  tagsByKey: ReadonlyMap<string, readonly string[]>,
  query: string,
): boolean {
  const needle = normalizeTag(query);
  if (!needle) return true;
  return (tagsByKey.get(key) ?? []).some((tag) => tag.includes(needle));
}
