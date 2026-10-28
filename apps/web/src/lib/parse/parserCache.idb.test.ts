/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeReplay } from "@/lib/testing/fixtures";
import { DB_NAME, PARSED_DEMO_STORE, openCs2Db, requestOf } from "@/lib/storage/idb";
import type { ParseTimings, Replay } from "@/lib/replay/replayTypes";
import { loadedDemo } from "./session";
import {
  PARSER_CACHE_SCHEMA,
  fileFromParserCache,
  hasStaleParserCache,
  loadParserCache,
  parserCacheFileKey,
  readFreshParserCache,
  refreshStaleParserCache,
  saveParserCache,
  withParserCache,
  type StoredParse,
} from "./parserCache";

const TIMINGS: ParseTimings = {
  initMs: 1,
  parseMs: 2,
  jsonMs: 3,
  buffersMs: 4,
  totalMs: 10,
};

const DEMO_BYTES = Uint8Array.of(1, 2, 3, 4).buffer;

function deleteCs2Db(): Promise<void> {
  const closing = indexedDB.deleteDatabase(DB_NAME);
  return new Promise((resolve, reject) => {
    closing.onsuccess = () => resolve();
    closing.onerror = () => reject(closing.error ?? new Error("deleteDatabase failed"));
    closing.onblocked = () => resolve();
  });
}

async function putRaw(row: Record<string, unknown>): Promise<void> {
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PARSED_DEMO_STORE, "readwrite");
    await requestOf(tx.objectStore(PARSED_DEMO_STORE).put(row));
  } finally {
    db.close();
  }
}

async function readRaw(key: string): Promise<Record<string, unknown> | undefined> {
  const db = await openCs2Db();
  try {
    const tx = db.transaction(PARSED_DEMO_STORE, "readonly");
    return (await requestOf(tx.objectStore(PARSED_DEMO_STORE).get(key))) as
      Record<string, unknown> | undefined;
  } finally {
    db.close();
  }
}

function replayNamed(team: string): Replay {
  return makeReplay({ header: { team_ct: team } });
}

describe("parser cache", () => {
  beforeEach(async () => {
    await deleteCs2Db();
  });

  it("uses a row whose schema matches and does not parse", async () => {
    const replay = replayNamed("Cached");
    await saveParserCache({
      key: "demo",
      fileName: "match.dem",
      replay,
      matchKey: "de_anubis|1|1,2|match.dem",
      lastModified: 10,
      source: DEMO_BYTES,
    });
    const parse = vi.fn(async (): Promise<StoredParse> => ({
      replay: replayNamed("Fresh"),
    }));

    const loaded = await loadParserCache("demo", parse);

    expect(parse).not.toHaveBeenCalled();
    expect(loaded.status).toBe("cached");
    if (loaded.status === "cached") expect(loaded.replay.header.team_ct).toBe("Cached");
    expect((await readRaw("demo"))?.schema).toBe(PARSER_CACHE_SCHEMA);
  });

  it("re-parses and overwrites when the schema differs", async () => {
    const key = "demo";
    await putRaw({
      key,
      schema: 0,
      fileName: "match.dem",
      savedAt: 1,
      replay: replayNamed("Stale"),
      source: DEMO_BYTES,
      fileKey: key,
      matchKey: "notes-key",
      lastModified: 10,
    });
    const parse = vi.fn(async (bytes: ArrayBuffer): Promise<StoredParse> => {
      expect(new Uint8Array(bytes)).toEqual(new Uint8Array(DEMO_BYTES));
      return { replay: replayNamed("Fresh"), timings: TIMINGS };
    });

    expect(await hasStaleParserCache()).toBe(true);
    const loaded = await loadParserCache(key, parse);

    expect(parse).toHaveBeenCalledTimes(1);
    expect(await hasStaleParserCache()).toBe(false);
    expect(loaded).toMatchObject({ status: "reparsed", timings: TIMINGS });
    if (loaded.status === "reparsed") expect(loaded.replay.header.team_ct).toBe("Fresh");
    const row = await readRaw(key);
    expect(row?.schema).toBe(PARSER_CACHE_SCHEMA);
    expect((row?.replay as Replay).header.team_ct).toBe("Fresh");
    expect(row?.matchKey).toBe("notes-key");
    expect(new Uint8Array(row?.source as ArrayBuffer)).toEqual(new Uint8Array(DEMO_BYTES));
    expect((await readFreshParserCache(key))?.header.team_ct).toBe("Fresh");
  });

  it("re-parses and overwrites when the schema field is missing", async () => {
    await putRaw({
      key: "legacy",
      fileName: "match.dem",
      savedAt: 1,
      replay: replayNamed("Legacy"),
      source: DEMO_BYTES,
      fileKey: "legacy",
      matchKey: "notes-key",
      lastModified: 4,
    });
    const parse = vi.fn(async (): Promise<StoredParse> => ({
      replay: replayNamed("Fresh"),
    }));

    const loaded = await loadParserCache("legacy", parse);

    expect(parse).toHaveBeenCalledTimes(1);
    expect(loaded.status).toBe("reparsed");
    expect((await readRaw("legacy"))?.schema).toBe(PARSER_CACHE_SCHEMA);
  });

  it("leaves a stale row unused when the demo bytes are missing", async () => {
    await putRaw({
      key: "no-bytes",
      schema: 0,
      fileName: "match.dem",
      savedAt: 1,
      replay: replayNamed("Stale"),
      fileKey: "no-bytes",
      matchKey: "notes-key",
      lastModified: 4,
    });
    await putRaw({
      key: "empty",
      schema: 0,
      fileName: "empty.dem",
      savedAt: 1,
      replay: replayNamed("Empty"),
      source: new ArrayBuffer(0),
      fileKey: "empty",
      matchKey: "empty-key",
      lastModified: 4,
    });
    const parse = vi.fn();

    await expect(loadParserCache("no-bytes", parse)).resolves.toEqual({
      status: "unavailable",
    });
    await expect(loadParserCache("empty", parse)).resolves.toEqual({
      status: "unavailable",
    });
    await expect(loadParserCache("absent", parse)).resolves.toEqual({
      status: "unavailable",
    });

    expect(parse).not.toHaveBeenCalled();
    expect(await hasStaleParserCache()).toBe(false);
    expect((await readRaw("no-bytes"))?.schema).toBe(0);
    expect(((await readRaw("no-bytes"))?.replay as Replay).header.team_ct).toBe("Stale");
    expect(await readFreshParserCache("no-bytes")).toBeNull();
    expect(await fileFromParserCache("notes-key", "match.dem")).toBeNull();
  });

  it("keeps the stale row when re-parse throws", async () => {
    await putRaw({
      key: "demo",
      schema: 0,
      fileName: "match.dem",
      savedAt: 1,
      replay: replayNamed("Stale"),
      source: DEMO_BYTES,
      fileKey: "demo",
      matchKey: "notes-key",
      lastModified: 4,
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const parse = vi.fn(async () => {
      throw new Error("wasm");
    });

    await expect(loadParserCache("demo", parse)).resolves.toEqual({
      status: "unavailable",
    });
    expect(((await readRaw("demo"))?.replay as Replay).header.team_ct).toBe("Stale");
  });

  it("rebuilds a file from stored bytes and refreshes only stale rows that have them", async () => {
    const source = DEMO_BYTES.slice(0);
    const lastModified = 42;
    const fileName = "match.dem";
    const key = parserCacheFileKey({
      name: fileName,
      size: source.byteLength,
      lastModified,
    });
    const matchKey = "de_anubis|1|1,2|match.dem";
    await saveParserCache({
      key: "fresh",
      fileName: "fresh.dem",
      replay: replayNamed("Keep"),
      matchKey: "fresh-key",
      lastModified: 1,
      source,
    });
    await putRaw({
      key,
      schema: 0,
      fileName,
      savedAt: 1,
      replay: replayNamed("Stale"),
      source,
      fileKey: key,
      matchKey,
      lastModified,
    });
    await putRaw({
      key: "bare",
      schema: 0,
      fileName: "bare.dem",
      savedAt: 1,
      replay: replayNamed("Bare"),
      fileKey: "bare",
      matchKey: "bare-key",
      lastModified: 1,
    });
    const parsedKeys: string[] = [];
    const parse = vi.fn(async (): Promise<StoredParse> => {
      parsedKeys.push("called");
      return { replay: replayNamed("Fresh"), timings: TIMINGS };
    });

    const file = await fileFromParserCache(matchKey, fileName);
    expect(file).not.toBeNull();
    expect(parserCacheFileKey(file!)).toBe(key);

    await refreshStaleParserCache(parse);

    expect(parse).toHaveBeenCalledTimes(1);
    expect((await readFreshParserCache("fresh"))?.header.team_ct).toBe("Keep");
    expect((await readFreshParserCache(key))?.header.team_ct).toBe("Fresh");
    expect((await readRaw("bare"))?.schema).toBe(0);
    expect(parsedKeys).toEqual(["called"]);
  });

  it("serves a fresh row from the pool and stores a miss", async () => {
    const file = new File([DEMO_BYTES], "match.dem", { lastModified: 7 });
    const key = parserCacheFileKey(file);
    const cached = replayNamed("Cached");
    await saveParserCache({
      key,
      fileName: file.name,
      replay: cached,
      matchKey: "cached-key",
      lastModified: file.lastModified,
      source: DEMO_BYTES,
    });
    const parseFile = vi.fn();
    const pool = withParserCache({ reset: vi.fn(), parseFile });

    const hit = await pool.parseFile(file, () => undefined);

    expect(parseFile).not.toHaveBeenCalled();
    expect(hit.demo?.replay.header.team_ct).toBe("Cached");

    const parsed = replayNamed("Parsed");
    parseFile.mockResolvedValue({
      file,
      demo: loadedDemo(parsed, file.name, file),
      timings: TIMINGS,
    });
    const other = new File([DEMO_BYTES], "other.dem", { lastModified: 8 });
    const miss = await pool.parseFile(other, () => undefined);
    expect(miss.demo?.replay.header.team_ct).toBe("Parsed");
    expect((await readFreshParserCache(parserCacheFileKey(other)))?.header.team_ct).toBe("Parsed");
  });
});
