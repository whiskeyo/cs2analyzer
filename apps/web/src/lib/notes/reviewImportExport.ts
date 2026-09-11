import { parseJson } from "@/lib/validate/json.ts";
import { en } from "@/lib/i18n/translations/en";
import { t, type Messages } from "@/lib/i18n/messages";
import { downloadBlob } from "@/lib/shared/download";
import type { LoadedDemo } from "@/lib/parse/session";
import {
  deleteAllProjects,
  demoFilePickerAvailable,
  importProjects,
  loadProject,
  matchKey,
  parseBundle,
  pickDemoFileHandle,
  readLinkedDemoFile,
  saveDemoFileHandle,
  saveProject,
  serializeBundle,
  type ReviewProject,
} from "./projectStore";

export interface NotesStatus {
  setError: (message: string | null) => void;
  setNotice: (message: string | null | ((prev: string | null) => string | null)) => void;
}

export interface ReviewImportContext {
  demo: LoadedDemo | null;
  applyProject: (project: ReviewProject, jumpTick: boolean) => void;
  refreshSaved: () => void;
  status: NotesStatus;
}

function counted(one: string, other: string, count: number): string {
  return count === 1 ? one : t(other, { count });
}

/** Export every saved note in this browser as JSON. */
export async function exportSavedNotes(
  loadAll: () => Promise<ReviewProject[]>,
  status: NotesStatus,
  messages: Messages = en,
): Promise<void> {
  try {
    const projects = await loadAll();
    if (projects.length === 0) {
      status.setNotice(messages.notice.noSavedNotesYet);
      return;
    }
    downloadBlob("cs2analyzer-notes.json", "application/json", serializeBundle(projects));
    status.setNotice(
      counted(
        messages.notice.exportedNotesOne,
        messages.notice.exportedNotesOther,
        projects.length,
      ),
    );
  } catch {
    status.setError(messages.notice.exportNotesFailed);
  }
}

/** Wipe every saved note in IndexedDB for this browser. */
export async function removeAllSavedNotes(
  refreshSaved: () => void,
  status: NotesStatus,
  messages: Messages = en,
): Promise<void> {
  try {
    const n = await deleteAllProjects();
    refreshSaved();
    if (n === 0) {
      status.setNotice(messages.notice.noSavedNotes);
    } else {
      status.setNotice(
        counted(messages.notice.removedNotesOne, messages.notice.removedNotesOther, n),
      );
    }
  } catch {
    status.setError(messages.notice.removeNotesFailed);
  }
}

/** Import a notes JSON bundle; optionally apply the row for the loaded demo. */
export async function importNotesFromText(
  text: string,
  ctx: ReviewImportContext,
  messages: Messages = en,
): Promise<void> {
  let raw: unknown;
  try {
    raw = parseJson(text);
  } catch {
    ctx.status.setError(messages.notice.notesNotJson);
    return;
  }
  const bundle = parseBundle(raw);
  if (!bundle || bundle.projects.length === 0) {
    ctx.status.setError(messages.notice.notesEmptyFile);
    return;
  }
  const n = await importProjects(bundle);
  ctx.refreshSaved();
  ctx.status.setError(null);
  ctx.status.setNotice(
    counted(messages.notice.importedNotesOne, messages.notice.importedNotesOther, n),
  );
  const current = ctx.demo;
  if (!current) {
    return;
  }
  const mine = bundle.projects.find((p) => p.key === matchKey(current.replay, current.fileName));
  if (mine) {
    ctx.applyProject(mine, false);
  }
}

/** Open the browser-linked demo file for a saved note, if any. */
export async function tryOpenLinkedDemo(
  project: ReviewProject,
  status: NotesStatus,
  messages: Messages = en,
): Promise<File | null> {
  const file = await readLinkedDemoFile(project.key);
  if (!file) {
    return null;
  }
  if (file.name !== project.fileName) {
    status.setError(
      t(messages.notice.linkedFileMismatch, { found: file.name, expected: project.fileName }),
    );
    return null;
  }
  return file;
}

/** Link a `.dem` on disk to a saved note (Chrome/Edge File System Access API). */
export async function linkDemoFile(
  project: ReviewProject,
  refreshSaved: () => void,
  status: NotesStatus,
  messages: Messages = en,
): Promise<void> {
  if (!demoFilePickerAvailable()) {
    status.setNotice(messages.notice.linkDemoHint);
    return;
  }
  try {
    const handle = await pickDemoFileHandle();
    if (!handle) {
      return;
    }
    if (handle.name !== project.fileName) {
      status.setError(
        t(messages.notice.pickFileMismatch, { wanted: project.fileName, got: handle.name }),
      );
      return;
    }
    await saveDemoFileHandle(project.key, handle);
    const existing = await loadProject(project.key);
    if (existing) {
      await saveProject({
        ...existing,
        linkedFileLabel: handle.name,
        savedAt: Date.now(),
      });
    }
    refreshSaved();
    status.setNotice(t(messages.notice.linkedDemo, { name: handle.name }));
  } catch {
    status.setNotice(messages.notice.linkCancelled);
  }
}
