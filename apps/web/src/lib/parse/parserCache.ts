import { matchKey as matchKeyFor } from "@/lib/notes/projectStore";
import type { ParseTimings, Replay } from "@/lib/replay/replayTypes";
import { PARSED_DEMO_STORE, hasStore, idbAvailable, openCs2Db, requestOf } from "@/lib/storage/idb";
import { isQuotaExceededError } from "@/lib/storage/quota";
import { isRecord } from "@/lib/validate/guards";
import type { ParseFileResult, ParseWorkerPool } from "./parsePool";
import { loadedDemo, type LoadedDemo } from "./session";

/**
 * Parser-output generation stored on each cached demo.
 *
 * Bump this when a parse change adds or corrects `Replay` fields (blinds
 * victims, `match_info`, and the same kind of change). It is the only copy
 * of the number — do not duplicate it.
 *
 * On load, a missing or different `schema` is re-parsed from the stored
 * `.dem` bytes and the row is overwritten. A matching schema is used as-is.
 * With no stored bytes, the stale row is left unused (no throw, no notice).
 */
export const PARSER_CACHE_SCHEMA = 1;

export interface StoredParse {
  replay: Replay;
  timings?: ParseTimings;
}

export type ParserCacheLoad =
  | { status: "cached"; replay: Replay }
  | { status: "reparsed"; replay: Replay; timings?: ParseTimings }
  | { status: "unavailable" };

interface ParserCacheRow {
  key: string;
  schema?: number;
  fileName: string;
  savedAt: number;
  replay: unknown;
  source?: ArrayBuffer;
  fileKey: string;
  matchKey: string;
  lastModified: number;
}

export interface SaveParserCacheInput {
  key: string;
  fileName: string;
  replay: Replay;
  matchKey: string;
  lastModified: number;
  source?: ArrayBuffer;
}

/** Drop identity for a `.dem` file. Same name, size, and mtime share one row. */
export function parserCacheFileKey(file: {
  name: string;
  size: number;
  lastModified: number;
}): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export function logParserCacheHit(fileName: string): void {
  console.info("[cs2analyzer parse]", fileName, "cache hit");
}

function isReplay(value: unknown): value is Replay {
  if (!isRecord(value) || !isRecord(value.header)) return false;
  return typeof value.header.map_name === "string" && Array.isArray(value.rounds);
}

function isCurrentSchema(schema: number | undefined): boolean {
  return schema === PARSER_CACHE_SCHEMA;
}

/** IndexedDB can hand back an ArrayBuffer from another realm (`instanceof` fails). */
function copySource(value: unknown): ArrayBuffer | null {
  let view: Uint8Array | null = null;
  if (Object.prototype.toString.call(value) === "[object ArrayBuffer]") {
    const buffer = value as ArrayBuffer;
    if (buffer.byteLength === 0) return null;
    view = new Uint8Array(buffer);
  } else if (ArrayBuffer.isView(value)) {
    if (value.byteLength === 0) return null;
    view = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  if (!view || view.byteLength === 0) return null;
  return view.slice().buffer;
}

function parseRow(raw: unknown): ParserCacheRow | null {
  if (!isRecord(raw) || typeof raw.key !== "string" || raw.key === "") return null;
  const schema =
    typeof raw.schema === "number" && Number.isFinite(raw.schema) ? raw.schema : undefined;
  const source = copySource(raw.source);
  return {
    key: raw.key,
    ...(schema !== undefined ? { schema } : {}),
    fileName: typeof raw.fileName === "string" ? raw.fileName : "",
    savedAt: typeof raw.savedAt === "number" && Number.isFinite(raw.savedAt) ? raw.savedAt : 0,
    replay: raw.replay,
    ...(source ? { source } : {}),
    fileKey: typeof raw.fileKey === "string" && raw.fileKey !== "" ? raw.fileKey : raw.key,
    matchKey: typeof raw.matchKey === "string" ? raw.matchKey : "",
    lastModified:
      typeof raw.lastModified === "number" && Number.isFinite(raw.lastModified)
        ? raw.lastModified
        : 0,
  };
}

function rowRecord(row: ParserCacheRow, source: ArrayBuffer | undefined): ParserCacheRow {
  return {
    key: row.key,
    schema: PARSER_CACHE_SCHEMA,
    fileName: row.fileName,
    savedAt: row.savedAt,
    replay: row.replay,
    fileKey: row.fileKey,
    matchKey: row.matchKey,
    lastModified: row.lastModified,
    ...(source ? { source } : {}),
  };
}

async function putRecord(record: ParserCacheRow): Promise<void> {
  const db = await openCs2Db();
  try {
    if (!hasStore(db, PARSED_DEMO_STORE)) return;
    const tx = db.transaction(PARSED_DEMO_STORE, "readwrite");
    await requestOf(tx.objectStore(PARSED_DEMO_STORE).put(record));
  } finally {
    db.close();
  }
}

async function writeRow(row: ParserCacheRow): Promise<void> {
  if (!idbAvailable()) return;
  const source = copySource(row.source);
  const record = rowRecord(row, source ?? undefined);
  try {
    await putRecord(record);
  } catch (err) {
    if (!source || !isQuotaExceededError(err)) {
      console.error("[cs2analyzer parse] cache write failed", err);
      return;
    }
    try {
      await putRecord(rowRecord(row, undefined));
    } catch (retryErr) {
      console.error("[cs2analyzer parse] cache write failed", retryErr);
    }
  }
}

async function readRow(key: string): Promise<ParserCacheRow | null> {
  if (!idbAvailable() || key === "") return null;
  const db = await openCs2Db();
  try {
    if (!hasStore(db, PARSED_DEMO_STORE)) return null;
    const tx = db.transaction(PARSED_DEMO_STORE, "readonly");
    return parseRow(await requestOf(tx.objectStore(PARSED_DEMO_STORE).get(key)));
  } finally {
    db.close();
  }
}

async function readAllRows(): Promise<ParserCacheRow[]> {
  if (!idbAvailable()) return [];
  const db = await openCs2Db();
  try {
    if (!hasStore(db, PARSED_DEMO_STORE)) return [];
    const tx = db.transaction(PARSED_DEMO_STORE, "readonly");
    const raw = await requestOf(tx.objectStore(PARSED_DEMO_STORE).getAll());
    const out: ParserCacheRow[] = [];
    for (const item of raw ?? []) {
      const row = parseRow(item);
      if (row) out.push(row);
    }
    return out;
  } finally {
    db.close();
  }
}

function freshReplay(row: ParserCacheRow | null): Replay | null {
  if (!row || !isCurrentSchema(row.schema) || !isReplay(row.replay)) return null;
  return row.replay;
}

/** Fresh cached demo for this file, or null when the row is missing or stale. */
export async function readFreshDemo(file: File): Promise<LoadedDemo | null> {
  const replay = await readFreshParserCache(parserCacheFileKey(file));
  if (!replay) return null;
  logParserCacheHit(file.name);
  return loadedDemo(replay, file.name, file);
}

export async function readFreshParserCache(key: string): Promise<Replay | null> {
  try {
    return freshReplay(await readRow(key));
  } catch {
    return null;
  }
}

export async function saveParserCache(input: SaveParserCacheInput): Promise<void> {
  if (input.key === "") return;
  await writeRow({
    key: input.key,
    schema: PARSER_CACHE_SCHEMA,
    fileName: input.fileName,
    savedAt: Date.now(),
    replay: input.replay,
    fileKey: input.key,
    matchKey: input.matchKey,
    lastModified: input.lastModified,
    ...(input.source ? { source: input.source } : {}),
  });
}

export interface ParserCacheRefreshMeta {
  fileName: string;
  lastModified: number;
}

/**
 * Load one cached parse.
 * Matching schema returns the stored replay and does not call `parse`.
 * A missing or different schema re-parses `source` and overwrites the row.
 * No source bytes (or a failed re-parse) returns `unavailable` and leaves the row.
 */
export async function loadParserCache(
  key: string,
  parse: (bytes: ArrayBuffer, meta: ParserCacheRefreshMeta) => Promise<StoredParse | null>,
): Promise<ParserCacheLoad> {
  let row: ParserCacheRow | null;
  try {
    row = await readRow(key);
  } catch {
    return { status: "unavailable" };
  }
  if (!row) return { status: "unavailable" };
  const fresh = freshReplay(row);
  if (fresh) return { status: "cached", replay: fresh };
  const source = copySource(row.source);
  if (!source) return { status: "unavailable" };
  let parsed: StoredParse | null;
  try {
    parsed = await parse(source.slice(0), {
      fileName: row.fileName,
      lastModified: row.lastModified,
    });
  } catch (err) {
    console.error("[cs2analyzer parse] cache refresh failed", err);
    return { status: "unavailable" };
  }
  if (!parsed || !isReplay(parsed.replay)) return { status: "unavailable" };
  await writeRow({
    ...row,
    schema: PARSER_CACHE_SCHEMA,
    replay: parsed.replay,
    source,
    savedAt: Date.now(),
  });
  return { status: "reparsed", replay: parsed.replay, timings: parsed.timings };
}

/**
 * True when a stale row still has `.dem` bytes.
 * A visit with nothing to refresh does not start WASM.
 */
export async function hasStaleParserCache(): Promise<boolean> {
  try {
    const rows = await readAllRows();
    return rows.some((row) => freshReplay(row) == null && copySource(row.source) != null);
  } catch {
    return false;
  }
}

/**
 * Re-parse stale rows that still have `.dem` bytes. Returns a cancel function.
 * A visit with nothing stale does not call `openPool`, so WASM stays unloaded.
 */
export function reparseStaleDemos(
  openPool: () => ParseWorkerPool | Promise<ParseWorkerPool>,
  onParsed: (fileName: string, timings: ParseTimings, replay: Replay) => void,
): () => void {
  let cancel = false;
  void (async () => {
    try {
      if (!(await hasStaleParserCache()) || cancel) return;
      const raw = openPool();
      const pool = raw instanceof Promise ? await raw : raw;
      if (cancel) return;
      await refreshStaleParserCache(async (bytes, meta) => {
        const file = new File([bytes], meta.fileName || "demo.dem", {
          lastModified: meta.lastModified,
        });
        const result = await pool.parseFile(file, () => undefined);
        if (cancel || result.cancelled) return null;
        if (result.error || !result.demo) {
          throw new Error(result.error ?? "Parse failed");
        }
        if (result.timings) onParsed(meta.fileName, result.timings, result.demo.replay);
        return { replay: result.demo.replay, timings: result.timings };
      });
    } catch (err) {
      if (!cancel) console.error("[cs2analyzer parse] cache refresh failed", err);
    }
  })();
  return () => {
    cancel = true;
  };
}

/** Re-parse every stale row that still has `.dem` bytes. Fresh rows are skipped. */
export async function refreshStaleParserCache(
  parse: (bytes: ArrayBuffer, meta: ParserCacheRefreshMeta) => Promise<StoredParse | null>,
): Promise<void> {
  let rows: ParserCacheRow[];
  try {
    rows = await readAllRows();
  } catch {
    return;
  }
  for (const row of rows) {
    if (freshReplay(row)) continue;
    await loadParserCache(row.key, parse);
  }
}

async function rowsForMatch(matchKeyValue: string): Promise<ParserCacheRow[]> {
  if (!idbAvailable() || matchKeyValue === "") return [];
  const db = await openCs2Db();
  try {
    if (!hasStore(db, PARSED_DEMO_STORE)) return [];
    const tx = db.transaction(PARSED_DEMO_STORE, "readonly");
    const store = tx.objectStore(PARSED_DEMO_STORE);
    if (!store.indexNames.contains("matchKey")) return [];
    const raw = await requestOf(store.index("matchKey").getAll(matchKeyValue));
    const out: ParserCacheRow[] = [];
    for (const item of raw ?? []) {
      const row = parseRow(item);
      if (row) out.push(row);
    }
    return out;
  } finally {
    db.close();
  }
}

/**
 * A `File` built from stored demo bytes, so Open can parse without a disk handle.
 * `null` when those bytes were not kept.
 */
export async function fileFromParserCache(
  matchKeyValue: string,
  fileName: string,
): Promise<File | null> {
  let rows: ParserCacheRow[];
  try {
    rows = await rowsForMatch(matchKeyValue);
  } catch {
    return null;
  }
  const row = rows.find((candidate) => copySource(candidate.source)) ?? null;
  const source = row ? copySource(row.source) : null;
  if (!row || !source) return null;
  const name = row.fileName || fileName;
  return new File([source], name, { lastModified: row.lastModified });
}

/** Store a successful parse under this file's identity. Quota drops the bytes, not the replay. */
export async function rememberParsedDemo(file: File, replay: Replay): Promise<void> {
  let source: ArrayBuffer | undefined;
  try {
    source = await file.arrayBuffer();
  } catch {
    source = undefined;
  }
  await saveParserCache({
    key: parserCacheFileKey(file),
    fileName: file.name,
    replay,
    matchKey: matchKeyFor(replay, file.name),
    lastModified: file.lastModified,
    source,
  });
}

/** Worker pool that serves a fresh cache row and stores a successful parse. */
export function withParserCache(pool: ParseWorkerPool): ParseWorkerPool {
  return {
    reset: () => pool.reset(),
    parseFile(file, onProgress) {
      const key = parserCacheFileKey(file);
      return readFreshParserCache(key).then(async (replay) => {
        if (replay) {
          logParserCacheHit(file.name);
          const hit: ParseFileResult = {
            file,
            demo: loadedDemo(replay, file.name, file),
          };
          return hit;
        }
        const result = await pool.parseFile(file, onProgress);
        if (result.demo && !result.cancelled) {
          await rememberParsedDemo(file, result.demo.replay);
        }
        return result;
      });
    },
  };
}
