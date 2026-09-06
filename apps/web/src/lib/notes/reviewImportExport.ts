import { parseJson } from "@/lib/validate/json.ts";
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

/** Export every saved note in this browser as JSON. */
export async function exportSavedNotes(
  loadAll: () => Promise<ReviewProject[]>,
  status: NotesStatus,
): Promise<void> {
  try {
    const projects = await loadAll();
    if (projects.length === 0) {
      status.setNotice("No saved notes in this browser yet.");
      return;
    }
    downloadBlob("cs2analyzer-notes.json", "application/json", serializeBundle(projects));
    status.setNotice(
      `Exported ${projects.length} saved match${projects.length === 1 ? "" : "es"}.`,
    );
  } catch {
    status.setError("Could not export notes.");
  }
}

/** Wipe every saved note in IndexedDB for this browser. */
export async function removeAllSavedNotes(
  refreshSaved: () => void,
  status: NotesStatus,
): Promise<void> {
  try {
    const n = await deleteAllProjects();
    refreshSaved();
    if (n === 0) {
      status.setNotice("No saved notes in this browser.");
    } else {
      status.setNotice(`Removed ${n} saved match${n === 1 ? "" : "es"} from this browser.`);
    }
  } catch {
    status.setError("Could not remove saved notes.");
  }
}

/** Import a notes JSON bundle; optionally apply the row for the loaded demo. */
export async function importNotesFromText(text: string, ctx: ReviewImportContext): Promise<void> {
  let raw: unknown;
  try {
    raw = parseJson(text);
  } catch {
    ctx.status.setError("Notes file is not valid JSON.");
    return;
  }
  const bundle = parseBundle(raw);
  if (!bundle || bundle.projects.length === 0) {
    ctx.status.setError("Notes file has no valid reviews.");
    return;
  }
  const n = await importProjects(bundle);
  ctx.refreshSaved();
  ctx.status.setError(null);
  ctx.status.setNotice(
    `Imported ${n} saved match${n === 1 ? "" : "es"}. Drop the demo to restore drawings.`,
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
): Promise<File | null> {
  const file = await readLinkedDemoFile(project.key);
  if (!file) {
    return null;
  }
  if (file.name !== project.fileName) {
    status.setError(`Linked file is ${file.name}, expected ${project.fileName}. Re-link the demo.`);
    return null;
  }
  return file;
}

/** Link a `.dem` on disk to a saved note (Chrome/Edge File System Access API). */
export async function linkDemoFile(
  project: ReviewProject,
  refreshSaved: () => void,
  status: NotesStatus,
): Promise<void> {
  if (!demoFilePickerAvailable()) {
    status.setNotice("Link demo file works in Chrome/Edge. Otherwise drop the .dem manually.");
    return;
  }
  try {
    const handle = await pickDemoFileHandle();
    if (!handle) {
      return;
    }
    if (handle.name !== project.fileName) {
      status.setError(
        `Pick ${project.fileName} — selected ${handle.name}. Notes stay keyed by filename.`,
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
    status.setNotice(`Linked ${handle.name} for saved notes.`);
  } catch {
    status.setNotice("Demo link cancelled.");
  }
}
