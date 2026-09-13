import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PLAYBOOK_IMAGE_CLICK_PX,
  PLAYBOOK_IMAGE_DECODE_ERROR,
  PLAYBOOK_IMAGE_MAX_BYTES,
  PLAYBOOK_IMAGE_PIN_STACK,
  playbookImagePinIndex,
  PLAYBOOK_IMAGE_SIZE_ERROR,
  PLAYBOOK_IMAGE_TYPE_ERROR,
  hitTestImage,
  imageFileName,
  makePlaybookImage,
  moveImage,
  nextImagePin,
  normalizePlaybookImageMime,
  playbookImageFilesFromList,
  readPlaybookImageFile,
  removeImage,
} from "./images";
import type { PlaybookImage } from "./types";

function still(partial: Partial<PlaybookImage> = {}): PlaybookImage {
  return {
    id: "i1",
    name: "lineup.png",
    mime: "image/png",
    x: 0,
    y: 0,
    ...partial,
  };
}

const identity = (x: number, y: number) => ({ x, y });

describe("normalizePlaybookImageMime", () => {
  it("accepts png, jpeg, jpg, and webp", () => {
    expect(normalizePlaybookImageMime("image/png")).toBe("image/png");
    expect(normalizePlaybookImageMime("image/jpeg")).toBe("image/jpeg");
    expect(normalizePlaybookImageMime("image/jpg")).toBe("image/jpeg");
    expect(normalizePlaybookImageMime("image/webp")).toBe("image/webp");
    expect(normalizePlaybookImageMime("image/gif")).toBeNull();
    expect(normalizePlaybookImageMime("application/pdf")).toBeNull();
  });
});

describe("image pin geometry", () => {
  it("hits the topmost pin and moves / removes by id", () => {
    const images = [still({ id: "a", x: 0, y: 0 }), still({ id: "b", x: 0, y: 0 })];
    expect(hitTestImage(images, { x: 0, y: 0 }, identity)?.id).toBe("b");
    expect(hitTestImage(images, { x: 400, y: 400 }, identity)).toBeNull();
    expect(moveImage(images, "a", 8, 9)[0]).toMatchObject({ id: "a", x: 8, y: 9 });
    expect(removeImage(images, "b").map((row) => row.id)).toEqual(["a"]);
    expect(removeImage(images, "missing")).toEqual(images);
  });

  it("uses a YouTube-sized click slop constant", () => {
    expect(PLAYBOOK_IMAGE_CLICK_PX).toBe(4);
  });

  it("numbers pins only when a floor has more than one photo", () => {
    const one = [still({ id: "a" })];
    expect(playbookImagePinIndex(one, "a")).toBeNull();
    const two = [still({ id: "a" }), still({ id: "b", x: 8 })];
    expect(playbookImagePinIndex(two, "a")).toBe(1);
    expect(playbookImagePinIndex(two, "b")).toBe(2);
    expect(playbookImagePinIndex(two, "missing")).toBeNull();
  });

  it("stacks a new pin after the last one", () => {
    expect(nextImagePin([])).toEqual({ x: 0, y: 0 });
    expect(nextImagePin([], { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
    expect(nextImagePin([still({ x: 5, y: 7 })])).toEqual({
      x: 5 + PLAYBOOK_IMAGE_PIN_STACK,
      y: 7,
    });
    expect(imageFileName({ name: "  A smoke.png  " })).toBe("A smoke.png");
    expect(imageFileName({ name: "   " })).toBe("image");
  });
});

describe("readPlaybookImageFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("rejects a non-image type and an oversized file", async () => {
    const gif = new File([new Uint8Array(8)], "x.gif", { type: "image/gif" });
    expect(await readPlaybookImageFile(gif)).toEqual({
      ok: false,
      message: PLAYBOOK_IMAGE_TYPE_ERROR,
    });
    const huge = new File([new Uint8Array(PLAYBOOK_IMAGE_MAX_BYTES + 1)], "x.png", {
      type: "image/png",
    });
    expect(await readPlaybookImageFile(huge)).toEqual({
      ok: false,
      message: PLAYBOOK_IMAGE_SIZE_ERROR,
    });
  });

  it("reads a png and builds a pin at the drop point", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 800, height: 400, close: vi.fn() })),
    );
    const file = new File([new Uint8Array(16)], "lineup.png", { type: "image/png" });
    const decoded = await readPlaybookImageFile(file);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw new Error("expected decode");
    expect(decoded).toMatchObject({
      name: "lineup.png",
      mime: "image/png",
    });
    expect(decoded).not.toHaveProperty("width");
    const pin = makePlaybookImage(decoded, { x: 12, y: 34 }, "img-1");
    expect(pin).toEqual({
      id: "img-1",
      name: "lineup.png",
      mime: "image/png",
      x: 12,
      y: 34,
    });
  });

  it("reports a decode failure", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new Error("bad");
      }),
    );
    const file = new File([new Uint8Array(16)], "x.png", { type: "image/png" });
    expect(await readPlaybookImageFile(file)).toEqual({
      ok: false,
      message: PLAYBOOK_IMAGE_DECODE_ERROR,
    });
  });

  it("collects files from a FileList-shaped drop", () => {
    const file = new File([new Uint8Array(1)], "a.png", { type: "image/png" });
    expect(playbookImageFilesFromList([file])).toEqual([file]);
    expect(playbookImageFilesFromList(null)).toEqual([]);
  });
});
