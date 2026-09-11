import { COLOR_PRESETS } from "@/lib/notes/palettes";
import { cloneNote, emptyNote } from "@/lib/notes/note";
import type { FloorMode, Note } from "@/lib/notes/types";
import {
  COPY_SUFFIX,
  PLAYBOOK_SCHEMA,
  UNTITLED_PLAYBOOK,
  UNTITLED_STRAT,
  type Playbook,
  type PlaybookPage,
  type PlaybookYouTube,
} from "./types";

export function newId(): string {
  return crypto.randomUUID();
}

export function defaultPlaybookPaletteId(): string {
  return COLOR_PRESETS[0].id;
}

export function defaultPlaybookColor(): string {
  return COLOR_PRESETS[0].colors[0];
}

function titled(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? fallback : trimmed;
}

/** Apply untitled fallback only when the field is left empty (on blur). */
export function commitTitle(value: string, fallback: string): string {
  return titled(value, fallback);
}

export function newPage(title = UNTITLED_STRAT, floor: FloorMode = "auto"): PlaybookPage {
  return {
    id: newId(),
    title: titled(title, UNTITLED_STRAT),
    body: "",
    floor,
    note: emptyNote(),
    videos: [],
  };
}

export function newPlaybook(
  mapName: string,
  title: string,
  sort = 0,
  drawing?: { paletteId?: string; color?: string },
): Playbook {
  const page = newPage();
  return {
    schema: PLAYBOOK_SCHEMA,
    key: newId(),
    mapName,
    title: titled(title, UNTITLED_PLAYBOOK),
    savedAt: 0,
    sort,
    pages: [page],
    activePageId: page.id,
    paletteId: drawing?.paletteId ?? defaultPlaybookPaletteId(),
    color: drawing?.color ?? defaultPlaybookColor(),
  };
}

export function copiedTitle(title: string): string {
  return `${title}${COPY_SUFFIX}`;
}

export function activePage(book: Playbook): PlaybookPage {
  const page = book.pages.find((p) => p.id === book.activePageId) ?? book.pages[0];
  if (!page) {
    throw new Error("playbook has no pages");
  }
  return page;
}

function withPages(
  book: Playbook,
  pages: PlaybookPage[],
  activePageId = book.activePageId,
): Playbook {
  const active = pages.some((p) => p.id === activePageId)
    ? activePageId
    : (pages[0]?.id ?? book.activePageId);
  return { ...book, pages, activePageId: active };
}

function updatePage(
  book: Playbook,
  pageId: string,
  patch: (page: PlaybookPage) => PlaybookPage,
): Playbook {
  let found = false;
  const pages = book.pages.map((page) => {
    if (page.id !== pageId) return page;
    found = true;
    return patch(page);
  });
  return found ? withPages(book, pages) : book;
}

export function addPage(
  book: Playbook,
  title = UNTITLED_STRAT,
  floor: FloorMode = "auto",
): Playbook {
  const page = newPage(title, floor);
  return withPages(book, [...book.pages, page], page.id);
}

export function renamePage(book: Playbook, pageId: string, title: string): Playbook {
  return updatePage(book, pageId, (page) => ({ ...page, title }));
}

export function finishRenamePage(book: Playbook, pageId: string): Playbook {
  return updatePage(book, pageId, (page) => ({
    ...page,
    title: titled(page.title, UNTITLED_STRAT),
  }));
}

export function setPageBody(book: Playbook, pageId: string, body: string): Playbook {
  return updatePage(book, pageId, (page) => ({ ...page, body }));
}

export function setPageVideos(book: Playbook, pageId: string, videos: PlaybookYouTube[]): Playbook {
  return updatePage(book, pageId, (page) => ({ ...page, videos }));
}

export function setPageFloor(book: Playbook, pageId: string, floor: FloorMode): Playbook {
  return updatePage(book, pageId, (page) => ({ ...page, floor }));
}

export function setPageNote(book: Playbook, pageId: string, note: Note): Playbook {
  return updatePage(book, pageId, (page) => ({
    ...page,
    note: cloneNote(note),
  }));
}

export function setActivePage(book: Playbook, pageId: string): Playbook {
  if (!book.pages.some((p) => p.id === pageId)) return book;
  if (book.activePageId === pageId) return book;
  return { ...book, activePageId: pageId };
}

export function deletePage(book: Playbook, pageId: string): Playbook {
  if (book.pages.length <= 1) {
    const only = book.pages[0];
    if (!only || only.id !== pageId) return book;
    const page = newPage();
    return withPages(book, [page], page.id);
  }
  const pages = book.pages.filter((p) => p.id !== pageId);
  if (pages.length === book.pages.length) return book;
  return withPages(book, pages);
}

export function duplicatePage(book: Playbook, pageId: string): Playbook {
  const index = book.pages.findIndex((p) => p.id === pageId);
  const source = book.pages[index];
  if (!source) return book;
  const copy: PlaybookPage = {
    ...source,
    id: newId(),
    title: copiedTitle(source.title),
    body: source.body,
    note: cloneNote(source.note),
    videos: cloneVideos(source.videos),
  };
  const pages = book.pages.slice();
  pages.splice(index + 1, 0, copy);
  return withPages(book, pages, copy.id);
}

export function reorderPages(book: Playbook, from: number, to: number): Playbook {
  if (from === to) return book;
  if (from < 0 || to < 0 || from >= book.pages.length || to >= book.pages.length) return book;
  const pages = book.pages.slice();
  const [moved] = pages.splice(from, 1);
  if (!moved) return book;
  pages.splice(to, 0, moved);
  return withPages(book, pages);
}

export function renamePlaybook(book: Playbook, title: string): Playbook {
  return { ...book, title };
}

export function finishRenamePlaybook(book: Playbook): Playbook {
  return { ...book, title: titled(book.title, UNTITLED_PLAYBOOK) };
}

export function setPlaybookPalette(book: Playbook, paletteId: string, color?: string): Playbook {
  const preset = COLOR_PRESETS.find((row) => row.id === paletteId) ?? COLOR_PRESETS[0];
  if (!preset) return book;
  const nextColor =
    color && (preset.colors as readonly string[]).includes(color) ? color : preset.colors[0];
  return { ...book, paletteId: preset.id, color: nextColor };
}

export function duplicatePlaybook(book: Playbook): Playbook {
  const idMap = new Map<string, string>();
  const pages = book.pages.map((page) => {
    const id = newId();
    idMap.set(page.id, id);
    return {
      ...page,
      id,
      note: cloneNote(page.note),
      videos: cloneVideos(page.videos),
    };
  });
  const activePageId = idMap.get(book.activePageId) ?? pages[0]?.id ?? newId();
  return {
    ...book,
    key: newId(),
    title: copiedTitle(book.title),
    savedAt: 0,
    sort: book.sort,
    pages,
    activePageId,
  };
}

function cloneVideos(videos: PlaybookYouTube[]): PlaybookYouTube[] {
  return videos.map((clip) => ({ ...clip, id: newId() }));
}
