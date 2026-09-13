import { afterEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOK_IMAGE_TYPE_ERROR, PLAYBOOK_IMAGE_URL_ERROR } from "./images";
import { ingestPlaybookImageUrl, ingestPlaybookImages } from "./addPlaybookImages";
import { putPlaybookImageBlob } from "./playbookImageStore";

vi.mock("./playbookImageStore", () => ({
  putPlaybookImageBlob: vi.fn(async () => undefined),
}));

vi.mock("./playbookImageBitmaps", () => ({
  rememberPlaybookImage: vi.fn(),
}));

describe("ingestPlaybookImages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds a valid file at the drop point and skips a rejected type", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 400, height: 200, close: vi.fn() })),
    );
    const png = new File([new Uint8Array(8)], "lineup.png", { type: "image/png" });
    const gif = new File([new Uint8Array(8)], "nope.gif", { type: "image/gif" });
    const result = await ingestPlaybookImages([gif, png], [], { x: 12, y: 34 });
    expect(result.error).toBe(PLAYBOOK_IMAGE_TYPE_ERROR);
    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toMatchObject({
      name: "lineup.png",
      mime: "image/png",
      x: 12,
      y: 34,
    });
    expect(result.images[0]).not.toHaveProperty("width");
    expect(putPlaybookImageBlob).toHaveBeenCalled();
  });

  it("fetches a remote URL, caches bytes, and keeps the list on a failed fetch", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 400, height: 200, close: vi.fn() })),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => null },
        blob: async () => new Blob([new Uint8Array(12)], { type: "image/png" }),
      })),
    );
    const added = await ingestPlaybookImageUrl("https://i.imgur.com/lineup.png", [], {
      x: 8,
      y: 9,
    });
    expect(added.error).toBeNull();
    expect(added.images[0]).toMatchObject({
      name: "lineup.png",
      mime: "image/png",
      x: 8,
      y: 9,
    });
    expect(putPlaybookImageBlob).toHaveBeenCalled();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, headers: { get: () => null } })),
    );
    const failed = await ingestPlaybookImageUrl("https://example.com/gone.png", added.images);
    expect(failed.error).toBe(PLAYBOOK_IMAGE_URL_ERROR);
    expect(failed.images).toEqual(added.images);
  });
});
