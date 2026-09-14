import { parseJson } from "@/lib/validate/json.ts";
import { isFiniteNumber, isRecord } from "@/lib/validate/guards.ts";
import { downloadBlob } from "@/lib/shared/download";
import { storageWriteError } from "@/lib/storage/quota";
import { isPlaybookSchema, parsePlaybook } from "./parse";
import { loadAllPlaybooks, savePlaybook } from "./playbookStore";
import { emitPlaybooksChanged } from "./events";
import {
  booksToSaveOnImport,
  findImportConflicts,
  type ImportChoices,
  type ImportConflict,
} from "./merge";
import { playbookImageIds } from "./pages";
import {
  blobToDataUrl,
  dataUrlToBlob,
  deletePlaybookImageBlobs,
  loadPlaybookImageBlobs,
  parsePlaybookImageDataUrls,
  putPlaybookImageBlob,
} from "./playbookImageStore";
import { PLAYBOOK_SCHEMA, type Playbook } from "./types";

export const PLAYBOOK_BUNDLE_SCHEMA = PLAYBOOK_SCHEMA;
export const PLAYBOOK_EXPORT_FILE = "cs2analyzer-playbooks.json";

export interface PlaybookBundle {
  schema: number;
  exportedAt: number;
  playbooks: Playbook[];
  /** Image id → data URL. Live books never store bytes on the page. */
  images: Record<string, string>;
}

export type TransferResult =
  | { ok: true; message: string }
  | {
      ok: false;
      message: string;
      conflicts?: ImportConflict[];
      bundle?: PlaybookBundle;
    };

export function serializePlaybookBundle(
  playbooks: Playbook[],
  exportedAt = Date.now(),
  images: Record<string, string> = {},
): string {
  const bundle: PlaybookBundle = {
    schema: PLAYBOOK_BUNDLE_SCHEMA,
    exportedAt,
    playbooks,
    images,
  };
  return JSON.stringify(bundle);
}

export function parsePlaybookBundle(value: unknown): PlaybookBundle | null {
  if (!isRecord(value)) return null;
  if (!isPlaybookSchema(value.schema)) return null;
  if (Array.isArray(value.playbooks)) {
    const playbooks: Playbook[] = [];
    for (const row of value.playbooks) {
      const book = parsePlaybook(row);
      if (book) playbooks.push(book);
    }
    if (playbooks.length === 0) return null;
    return {
      schema: PLAYBOOK_BUNDLE_SCHEMA,
      exportedAt: isFiniteNumber(value.exportedAt) ? value.exportedAt : 0,
      playbooks,
      images: parsePlaybookImageDataUrls(value.images),
    };
  }
  const single = parsePlaybook(value);
  if (!single) return null;
  return {
    schema: PLAYBOOK_BUNDLE_SCHEMA,
    exportedAt: 0,
    playbooks: [single],
    images: parsePlaybookImageDataUrls(value.images),
  };
}

export async function encodePlaybookBundleImages(
  playbooks: readonly Playbook[],
): Promise<Record<string, string>> {
  const ids = [...new Set(playbooks.flatMap(playbookImageIds))];
  const blobs = await loadPlaybookImageBlobs(ids);
  const images: Record<string, string> = {};
  for (const [id, blob] of blobs) {
    images[id] = await blobToDataUrl(blob);
  }
  return images;
}

export async function writePlaybookBundleImages(images: Record<string, string>): Promise<void> {
  for (const [id, dataUrl] of Object.entries(images)) {
    const blob = dataUrlToBlob(dataUrl);
    if (blob) await putPlaybookImageBlob(id, blob);
  }
}

function staleImportedImageIds(
  existing: readonly Playbook[],
  incoming: readonly Playbook[],
): string[] {
  const incomingIds = new Set(incoming.flatMap(playbookImageIds));
  const incomingKeys = new Set(incoming.map((book) => book.key));
  const stale: string[] = [];
  for (const book of existing) {
    if (!incomingKeys.has(book.key)) continue;
    for (const id of playbookImageIds(book)) {
      if (!incomingIds.has(id)) stale.push(id);
    }
  }
  return stale;
}

export async function exportPlaybooks(): Promise<TransferResult> {
  try {
    const playbooks = await loadAllPlaybooks();
    if (playbooks.length === 0) {
      return { ok: false, message: "No playbooks in this browser yet." };
    }
    const images = await encodePlaybookBundleImages(playbooks);
    downloadBlob(
      PLAYBOOK_EXPORT_FILE,
      "application/json",
      serializePlaybookBundle(playbooks, Date.now(), images),
    );
    const n = playbooks.length;
    return {
      ok: true,
      message: `Exported ${n} playbook${n === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return { ok: false, message: storageWriteError(err, "Could not export playbooks.") };
  }
}

export async function commitPlaybookImport(
  bundle: PlaybookBundle,
  choices: ImportChoices = {},
): Promise<TransferResult> {
  try {
    const existing = await loadAllPlaybooks();
    const books = booksToSaveOnImport(existing, bundle.playbooks, choices);
    await writePlaybookBundleImages(bundle.images);
    await deletePlaybookImageBlobs(staleImportedImageIds(existing, books));
    for (const book of books) {
      await savePlaybook(book);
    }
    emitPlaybooksChanged();
    const n = books.length;
    return {
      ok: true,
      message: `Imported ${n} playbook${n === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return { ok: false, message: storageWriteError(err, "Could not import playbooks.") };
  }
}

export async function importPlaybooksFromText(text: string): Promise<TransferResult> {
  let raw: unknown;
  try {
    raw = parseJson(text);
  } catch {
    return { ok: false, message: "Playbook file is not valid JSON." };
  }
  const bundle = parsePlaybookBundle(raw);
  if (!bundle) {
    return { ok: false, message: "Playbook file has no valid books." };
  }
  try {
    const existing = await loadAllPlaybooks();
    const conflicts = findImportConflicts(existing, bundle.playbooks);
    if (conflicts.length > 0) {
      return {
        ok: false,
        message: "Import has playbooks that already exist. Choose replace or rename.",
        conflicts,
        bundle,
      };
    }
    return commitPlaybookImport(bundle);
  } catch (err) {
    return { ok: false, message: storageWriteError(err, "Could not import playbooks.") };
  }
}
