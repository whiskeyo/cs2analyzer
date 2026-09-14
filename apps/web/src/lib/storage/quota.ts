import { errorMessage } from "@/lib/validate/json.ts";

/**
 * Shown when IndexedDB (notes, playbooks, photos, settings) cannot grow.
 * Local-first: nothing is uploaded; the user has to free space on this machine.
 */
export const IDB_QUOTA_MESSAGE =
  "This browser is out of storage space. Free disk space, remove playbooks or photos, or export notes/playbooks from Settings then wipe saved data.";

/** DOMException.QUOTA_ERR / legacy code for QuotaExceededError. */
const QUOTA_ERR = 22;

export function isQuotaExceededError(err: unknown): boolean {
  if (err == null || typeof err !== "object") return false;
  const name = "name" in err ? String(err.name) : "";
  if (name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED") return true;
  const code = "code" in err ? err.code : undefined;
  if (code === QUOTA_ERR) return true;
  return "message" in err && String(err.message) === IDB_QUOTA_MESSAGE;
}

export function wrapIdbError(err: unknown): Error {
  if (isQuotaExceededError(err)) {
    const mapped = new Error(IDB_QUOTA_MESSAGE);
    mapped.name = "QuotaExceededError";
    return mapped;
  }
  return err instanceof Error ? err : new Error(errorMessage(err) || "indexedDB request failed");
}

export function reportQuotaError(err: unknown, setError: (message: string) => void): boolean {
  if (!isQuotaExceededError(err)) return false;
  setError(IDB_QUOTA_MESSAGE);
  return true;
}

/** Prefer quota copy on IndexedDB writes; keep the caller's fallback otherwise. */
export function storageWriteError(err: unknown, fallback: string): string {
  return isQuotaExceededError(err) ? IDB_QUOTA_MESSAGE : fallback;
}
