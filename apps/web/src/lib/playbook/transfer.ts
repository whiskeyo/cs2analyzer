import { parseJson } from "@/lib/validate/json.ts";
import { isFiniteNumber, isRecord } from "@/lib/validate/guards.ts";
import { en } from "@/lib/i18n/en";
import { t, type Messages } from "@/lib/i18n/messages";
import { downloadBlob } from "@/lib/shared/download";
import { isPlaybookSchema, parsePlaybook } from "./parse";
import { loadAllPlaybooks, savePlaybook } from "./playbookStore";
import { emitPlaybooksChanged } from "./events";
import {
  booksToSaveOnImport,
  findImportConflicts,
  type ImportChoices,
  type ImportConflict,
} from "./merge";
import { PLAYBOOK_SCHEMA, type Playbook } from "./types";

export const PLAYBOOK_BUNDLE_SCHEMA = PLAYBOOK_SCHEMA;
export const PLAYBOOK_EXPORT_FILE = "cs2analyzer-playbooks.json";

export interface PlaybookBundle {
  schema: number;
  exportedAt: number;
  playbooks: Playbook[];
}

export type TransferResult =
  | { ok: true; message: string }
  | {
      ok: false;
      message: string;
      conflicts?: ImportConflict[];
      bundle?: PlaybookBundle;
    };

export function serializePlaybookBundle(playbooks: Playbook[], exportedAt = Date.now()): string {
  const bundle: PlaybookBundle = {
    schema: PLAYBOOK_BUNDLE_SCHEMA,
    exportedAt,
    playbooks,
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
    };
  }
  const single = parsePlaybook(value);
  if (!single) return null;
  return { schema: PLAYBOOK_BUNDLE_SCHEMA, exportedAt: 0, playbooks: [single] };
}

function counted(one: string, other: string, count: number): string {
  return count === 1 ? one : t(other, { count });
}

export async function exportPlaybooks(messages: Messages = en): Promise<TransferResult> {
  try {
    const playbooks = await loadAllPlaybooks();
    if (playbooks.length === 0) {
      return { ok: false, message: messages.notice.noPlaybooksYet };
    }
    downloadBlob(PLAYBOOK_EXPORT_FILE, "application/json", serializePlaybookBundle(playbooks));
    return {
      ok: true,
      message: counted(
        messages.notice.exportedPlaybooksOne,
        messages.notice.exportedPlaybooksOther,
        playbooks.length,
      ),
    };
  } catch {
    return { ok: false, message: messages.notice.exportPlaybooksFailed };
  }
}

export async function commitPlaybookImport(
  bundle: PlaybookBundle,
  choices: ImportChoices = {},
  messages: Messages = en,
): Promise<TransferResult> {
  try {
    const existing = await loadAllPlaybooks();
    const books = booksToSaveOnImport(existing, bundle.playbooks, choices);
    for (const book of books) {
      await savePlaybook(book);
    }
    emitPlaybooksChanged();
    return {
      ok: true,
      message: counted(
        messages.notice.importedPlaybooksOne,
        messages.notice.importedPlaybooksOther,
        books.length,
      ),
    };
  } catch {
    return { ok: false, message: messages.notice.importPlaybooksFailed };
  }
}

export async function importPlaybooksFromText(
  text: string,
  messages: Messages = en,
): Promise<TransferResult> {
  let raw: unknown;
  try {
    raw = parseJson(text);
  } catch {
    return { ok: false, message: messages.notice.playbooksNotJson };
  }
  const bundle = parsePlaybookBundle(raw);
  if (!bundle) {
    return { ok: false, message: messages.notice.playbooksEmptyFile };
  }
  try {
    const existing = await loadAllPlaybooks();
    const conflicts = findImportConflicts(existing, bundle.playbooks);
    if (conflicts.length > 0) {
      return {
        ok: false,
        message: messages.notice.playbookImportConflicts,
        conflicts,
        bundle,
      };
    }
    return commitPlaybookImport(bundle, {}, messages);
  } catch {
    return { ok: false, message: messages.notice.importPlaybooksFailed };
  }
}
