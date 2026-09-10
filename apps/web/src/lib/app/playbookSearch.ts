import { ROUTES } from "./routes";
import type { Playbook, PlaybookPage } from "@/lib/playbook/types";

export const PLAYBOOK_QUERY = {
  map: "map",
  playbook: "playbook",
  strat: "strat",
} as const;

export interface PlaybookQuery {
  map: string | null;
  playbook: string | null;
  strat: string | null;
}

function readParam(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function parsePlaybookQuery(search: string): PlaybookQuery {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  return {
    map: readParam(params, PLAYBOOK_QUERY.map),
    playbook: readParam(params, PLAYBOOK_QUERY.playbook),
    strat: readParam(params, PLAYBOOK_QUERY.strat),
  };
}

/** `+` vs `%20` and param order collapse so apply/write compare the same query. */
export function canonicalPlaybookSearch(query: PlaybookQuery): string {
  return playbookSearch(query);
}

export function playbookSearch(query: {
  map?: string | null;
  playbook?: string | null;
  strat?: string | null;
}): string {
  const params = new URLSearchParams();
  if (query.map) params.set(PLAYBOOK_QUERY.map, query.map);
  if (query.playbook) params.set(PLAYBOOK_QUERY.playbook, query.playbook);
  if (query.strat) params.set(PLAYBOOK_QUERY.strat, query.strat);
  const text = params.toString();
  return text === "" ? "" : `?${text}`;
}

export function playbookHref(query: {
  map?: string | null;
  playbook?: string | null;
  strat?: string | null;
}): string {
  return `${ROUTES.playbook}${playbookSearch(query)}`;
}

function uniqueLabel<T>(
  items: readonly T[],
  labelOf: (item: T) => string,
  keyOf: (item: T) => string,
  item: T,
): string {
  const label = labelOf(item);
  const hits = items.filter((row) => labelOf(row) === label);
  return hits.length === 1 ? label : keyOf(item);
}

function findByLabel<T>(
  items: readonly T[],
  labelOf: (item: T) => string,
  keyOf: (item: T) => string,
  wanted: string,
): T | undefined {
  return items.find((row) => labelOf(row) === wanted) ?? items.find((row) => keyOf(row) === wanted);
}

export function playbookQueryLabel(books: readonly Playbook[], book: Playbook): string {
  const onMap = books.filter((row) => row.mapName === book.mapName);
  return uniqueLabel(
    onMap,
    (row) => row.title,
    (row) => row.key,
    book,
  );
}

export function stratQueryLabel(pages: readonly PlaybookPage[], page: PlaybookPage): string {
  return uniqueLabel(
    pages,
    (row) => row.title,
    (row) => row.id,
    page,
  );
}

export function findPlaybook(
  books: readonly Playbook[],
  mapName: string,
  playbook: string,
): Playbook | undefined {
  const onMap = books.filter((row) => row.mapName === mapName);
  return findByLabel(
    onMap,
    (row) => row.title,
    (row) => row.key,
    playbook,
  );
}

export function findStrat(book: Playbook, strat: string): PlaybookPage | undefined {
  return findByLabel(
    book.pages,
    (row) => row.title,
    (row) => row.id,
    strat,
  );
}
