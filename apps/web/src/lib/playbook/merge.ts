import { copiedTitle } from "./pages";
import type { Playbook, PlaybookPage } from "./types";

export type BookImportAction = "replace" | "rename" | "merge";
export type StratImportAction = "replace" | "rename" | "skip";

export interface StratConflict {
  pageId: string;
  title: string;
}

export interface ImportConflict {
  incoming: Playbook;
  existing: Playbook;
  reason: "key" | "title";
  stratConflicts: StratConflict[];
}

export type StratChoices = Record<string, StratImportAction>;

export interface BookImportChoice {
  action: BookImportAction;
  title?: string;
  strats?: StratChoices;
}

export type ImportChoices = Record<string, BookImportChoice>;

function titlesOnMap(books: readonly Playbook[], mapName: string, exceptKey?: string): Set<string> {
  const used = new Set<string>();
  for (const book of books) {
    if (book.mapName !== mapName) continue;
    if (exceptKey && book.key === exceptKey) continue;
    used.add(book.title);
  }
  return used;
}

export function uniqueBookTitle(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  let next = `${base} (${n})`;
  while (used.has(next)) {
    n += 1;
    next = `${base} (${n})`;
  }
  return next;
}

export function uniqueStratTitle(base: string, used: Set<string>): string {
  return uniqueBookTitle(base, used);
}

export function stratConflictLabel(conflicts: readonly StratConflict[], pageId: string): string {
  const row = conflicts.find((item) => item.pageId === pageId);
  if (!row) return "";
  const same = conflicts.filter((item) => item.title === row.title);
  if (same.length <= 1) return row.title;
  return `${row.title} (${same.findIndex((item) => item.pageId === pageId) + 1})`;
}

export function findImportConflicts(
  existing: readonly Playbook[],
  incoming: readonly Playbook[],
): ImportConflict[] {
  const byKey = new Map(existing.map((book) => [book.key, book]));
  const conflicts: ImportConflict[] = [];
  for (const book of incoming) {
    const sameKey = byKey.get(book.key);
    const sameTitle = existing.find(
      (row) => row.mapName === book.mapName && row.title === book.title && row.key !== book.key,
    );
    const match = sameKey ?? sameTitle;
    if (!match) continue;
    const existingTitles = new Set(match.pages.map((page) => page.title));
    const stratConflicts = book.pages
      .filter((page) => existingTitles.has(page.title))
      .map((page) => ({ pageId: page.id, title: page.title }));
    conflicts.push({
      incoming: book,
      existing: match,
      reason: sameKey ? "key" : "title",
      stratConflicts,
    });
  }
  return conflicts;
}

function withUniquePageIds(pages: PlaybookPage[], used: Set<string>): PlaybookPage[] {
  return pages.map((page) => {
    if (!used.has(page.id)) {
      used.add(page.id);
      return page;
    }
    const id = crypto.randomUUID();
    used.add(id);
    return { ...page, id };
  });
}

function mergeBooks(existing: Playbook, incoming: Playbook, strats: StratChoices): Playbook {
  const pages = existing.pages.slice();
  const usedTitles = new Set(pages.map((page) => page.title));
  const usedIds = new Set(pages.map((page) => page.id));
  const claimed = new Set<string>();
  for (const page of incoming.pages) {
    const clash = pages.find((row) => row.title === page.title && !claimed.has(row.id));
    const action = strats[page.id] ?? (clash ? "rename" : "replace");
    if (!clash) {
      const [copy] = withUniquePageIds([page], usedIds);
      if (copy) pages.push(copy);
      usedTitles.add(page.title);
      continue;
    }
    if (action === "skip") continue;
    if (action === "replace") {
      claimed.add(clash.id);
      const index = pages.findIndex((row) => row.id === clash.id);
      const [copy] = withUniquePageIds([{ ...page, id: clash.id }], usedIds);
      if (index >= 0 && copy) pages[index] = copy;
      continue;
    }
    const title = uniqueStratTitle(copiedTitle(page.title), usedTitles);
    usedTitles.add(title);
    const [copy] = withUniquePageIds([{ ...page, title }], usedIds);
    if (copy) pages.push(copy);
  }
  const activePageId = pages.some((page) => page.id === existing.activePageId)
    ? existing.activePageId
    : (pages[0]?.id ?? existing.activePageId);
  return { ...existing, pages, activePageId };
}

export function booksToSaveOnImport(
  existing: readonly Playbook[],
  incoming: readonly Playbook[],
  choices: ImportChoices,
): Playbook[] {
  const kept = existing.slice();
  const out: Playbook[] = [];
  for (const book of incoming) {
    const conflict = findImportConflicts(kept, [book])[0];
    const choice = choices[book.key] ?? (conflict ? { action: "rename" as const } : undefined);
    if (!conflict || !choice) {
      out.push(book);
      kept.push(book);
      continue;
    }
    if (choice.action === "replace") {
      const replaced = {
        ...book,
        key: conflict.existing.key,
        sort: conflict.existing.sort,
      };
      out.push(replaced);
      const index = kept.findIndex((row) => row.key === conflict.existing.key);
      if (index >= 0) kept[index] = replaced;
      continue;
    }
    if (choice.action === "merge") {
      const merged = mergeBooks(conflict.existing, book, choice.strats ?? {});
      out.push(merged);
      const index = kept.findIndex((row) => row.key === conflict.existing.key);
      if (index >= 0) kept[index] = merged;
      continue;
    }
    const used = titlesOnMap(kept, book.mapName, book.key);
    const title = uniqueBookTitle(choice.title?.trim() || copiedTitle(book.title), used);
    const renamed = { ...book, key: crypto.randomUUID(), title };
    out.push(renamed);
    kept.push(renamed);
  }
  return out;
}
