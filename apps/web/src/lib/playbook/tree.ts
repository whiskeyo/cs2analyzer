import type { Playbook } from "./types";

export function comparePlaybooks(a: Playbook, b: Playbook): number {
  if (a.sort !== b.sort) return a.sort - b.sort;
  return a.title.localeCompare(b.title) || a.key.localeCompare(b.key);
}

export function nextPlaybookSort(books: readonly Playbook[], mapName: string): number {
  let max = -1;
  for (const book of books) {
    if (book.mapName !== mapName) continue;
    if (book.sort > max) max = book.sort;
  }
  return max + 1;
}

/** Keep the live draft in its stored slot instead of moving it to the top. */
export function booksWithDraft(books: readonly Playbook[], draft: Playbook | null): Playbook[] {
  if (!draft) return books.slice();
  let found = false;
  const next = books.map((row) => {
    if (row.key !== draft.key) return row;
    found = true;
    return draft;
  });
  return found ? next : [...next, draft];
}

export function movePlaybookInMap(
  books: readonly Playbook[],
  mapName: string,
  key: string,
  delta: -1 | 1,
): Playbook[] {
  const mapBooks = books
    .filter((book) => book.mapName === mapName)
    .slice()
    .sort(comparePlaybooks);
  const from = mapBooks.findIndex((book) => book.key === key);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= mapBooks.length) return [];
  const next = mapBooks.slice();
  const [moved] = next.splice(from, 1);
  if (!moved) return [];
  next.splice(to, 0, moved);
  const changed: Playbook[] = [];
  next.forEach((book, index) => {
    if (book.sort !== index) changed.push({ ...book, sort: index });
  });
  return changed;
}

export function groupPlaybooksByMap(books: readonly Playbook[]): Map<string, Playbook[]> {
  const grouped = new Map<string, Playbook[]>();
  for (const book of books) {
    const list = grouped.get(book.mapName) ?? [];
    list.push(book);
    grouped.set(book.mapName, list);
  }
  for (const list of grouped.values()) {
    list.sort(comparePlaybooks);
  }
  return grouped;
}

/** Calibration maps first, then any book whose map is missing from calibrations. */
export function mapsForTree(mapNames: readonly string[], books: readonly Playbook[]): string[] {
  const seen = new Set(mapNames);
  const extra: string[] = [];
  for (const book of books) {
    if (seen.has(book.mapName)) continue;
    seen.add(book.mapName);
    extra.push(book.mapName);
  }
  extra.sort((a, b) => a.localeCompare(b));
  return [...mapNames, ...extra];
}

/** `tree` guide for one row: `│   ` / `    ` ancestors, then `├── ` or `└── `. */
export function treeGuide(isLast: boolean, ancestorsLast: readonly boolean[] = []): string {
  let prefix = "";
  for (const last of ancestorsLast) {
    prefix += last ? "    " : "│   ";
  }
  prefix += isLast ? "└── " : "├── ";
  return prefix;
}
