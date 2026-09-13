import { afterEach, describe, expect, it, vi } from "vitest";
import { PLAYBOOK_IMAGE_TYPE_ERROR } from "./images";
import { ingestPlaybookImages } from "./addPlaybookImages";
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
});
