import { SNAPSHOT_RECENT_MAX } from "@/lib/shared/constants";
import { SNAPSHOT_RECENT_BOOKS_KEY } from "@/lib/shared/storageKeys";
import type { Playbook } from "./types";

function bookStore(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadRecentPlaybookKeys(): string[] {
  const store = bookStore();
  if (!store) return [];
  try {
    const raw = store.getItem(SNAPSHOT_RECENT_BOOKS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((key): key is string => typeof key === "string" && key.trim() !== "")
      .slice(0, SNAPSHOT_RECENT_MAX);
  } catch {
    return [];
  }
}

export function rememberRecentPlaybook(key: string): void {
  const store = bookStore();
  const trimmed = key.trim();
  if (!store || trimmed === "") return;
  const next = [trimmed, ...loadRecentPlaybookKeys().filter((row) => row !== trimmed)].slice(
    0,
    SNAPSHOT_RECENT_MAX,
  );
  store.setItem(SNAPSHOT_RECENT_BOOKS_KEY, JSON.stringify(next));
}

export function sortPlaybooksByRecent(
  books: readonly Playbook[],
  recentKeys: readonly string[],
): Playbook[] {
  const rank = new Map(recentKeys.map((key, index) => [key, index]));
  return [...books].sort((a, b) => {
    const aRank = rank.get(a.key) ?? Number.POSITIVE_INFINITY;
    const bRank = rank.get(b.key) ?? Number.POSITIVE_INFINITY;
    if (aRank !== bRank) return aRank - bRank;
    return a.sort - b.sort;
  });
}

export function defaultSnapshotBookKey(
  books: readonly Playbook[],
  recentKeys: readonly string[],
): string | null {
  for (const key of recentKeys) {
    if (books.some((book) => book.key === key)) return key;
  }
  return books[0]?.key ?? null;
}

export function partitionRecentPlaybooks(
  books: readonly Playbook[],
  recentKeys: readonly string[],
): { recent: Playbook[]; rest: Playbook[] } {
  const recentSet = new Set(recentKeys);
  const recent = sortPlaybooksByRecent(
    books.filter((book) => recentSet.has(book.key)),
    recentKeys,
  );
  const rest = books.filter((book) => !recentSet.has(book.key));
  return { recent, rest };
}
