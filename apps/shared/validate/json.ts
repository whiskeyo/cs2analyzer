/**
 * Parse JSON text without leaking `any` from `JSON.parse`.
 * Callers must narrow the return value before use.
 */
export function parseJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}

/** Narrow unknown catch values to a log or UI string. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
