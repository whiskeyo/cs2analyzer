/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  blobToDataUrl,
  clearPlaybookImageBlobs,
  copyPlaybookImageBlobs,
  dataUrlToBlob,
  deletePlaybookImageBlobs,
  getPlaybookImageBlob,
  isPlaybookImageDataUrl,
  loadPlaybookImageBlobs,
  parsePlaybookImageDataUrls,
  putPlaybookImageBlob,
} from "./playbookImageStore";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";

describe("playbookImageStore", () => {
  beforeEach(async () => {
    await clearPlaybookImageBlobs();
  });

  afterEach(async () => {
    await clearPlaybookImageBlobs();
  });

  it("puts, loads, copies, and deletes blobs", async () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
    await putPlaybookImageBlob("a", blob);
    const loaded = await getPlaybookImageBlob("a");
    expect(loaded).toBeTruthy();
    expect(await loaded?.arrayBuffer()).toEqual(await blob.arrayBuffer());
    expect(await getPlaybookImageBlob("missing")).toBeNull();

    await copyPlaybookImageBlobs(new Map([["a", "b"]]));
    const copy = await getPlaybookImageBlob("b");
    expect(await copy?.arrayBuffer()).toEqual(await blob.arrayBuffer());

    const many = await loadPlaybookImageBlobs(["a", "b", "missing"]);
    expect([...many.keys()].sort()).toEqual(["a", "b"]);

    await deletePlaybookImageBlobs(["a"]);
    expect(await getPlaybookImageBlob("a")).toBeNull();
    expect(await getPlaybookImageBlob("b")).toBeTruthy();
  });

  it("round-trips a data URL and rejects a remote URL", async () => {
    expect(isPlaybookImageDataUrl(PNG_DATA_URL)).toBe(true);
    expect(isPlaybookImageDataUrl("https://example.com/a.png")).toBe(false);
    const blob = dataUrlToBlob(PNG_DATA_URL);
    expect(blob?.type).toMatch(/image\/png/);
    const encoded = await blobToDataUrl(blob!);
    expect(isPlaybookImageDataUrl(encoded)).toBe(true);
    expect(dataUrlToBlob("https://evil.example/x.png")).toBeNull();
    expect(
      parsePlaybookImageDataUrls({ a: PNG_DATA_URL, b: "https://x", " ": PNG_DATA_URL }),
    ).toEqual({ a: PNG_DATA_URL });
    expect(parsePlaybookImageDataUrls(null)).toEqual({});
  });
});
