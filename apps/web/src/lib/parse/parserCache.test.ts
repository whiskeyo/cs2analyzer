import { describe, expect, it, vi } from "vitest";
import {
  fileFromParserCache,
  hasStaleParserCache,
  loadParserCache,
  parserCacheFileKey,
} from "./parserCache";

describe("parser cache without indexedDB", () => {
  it("does not parse when the database is missing", async () => {
    const parse = vi.fn();
    await expect(loadParserCache("missing", parse)).resolves.toEqual({
      status: "unavailable",
    });
    expect(parse).not.toHaveBeenCalled();
    await expect(fileFromParserCache("match", "a.dem")).resolves.toBeNull();
    await expect(hasStaleParserCache()).resolves.toBe(false);
  });

  it("keys a file by name, size, and lastModified", () => {
    expect(parserCacheFileKey({ name: "a.dem", size: 10, lastModified: 20 })).toBe("a.dem|10|20");
  });
});
