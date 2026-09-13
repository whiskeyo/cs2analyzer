import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PLAYBOOK_IMAGE_DECODE_ERROR,
  PLAYBOOK_IMAGE_DEFAULT_WIDTH,
  PLAYBOOK_IMAGE_MAX_BYTES,
  PLAYBOOK_IMAGE_MIN_WIDTH,
  PLAYBOOK_IMAGE_SIZE_ERROR,
  PLAYBOOK_IMAGE_STACK,
  PLAYBOOK_IMAGE_TYPE_ERROR,
  hitTestImage,
  hitTestImageHandle,
  imageFileName,
  imageScreenRect,
  makePlaybookImage,
  moveImage,
  nextImageOrigin,
  normalizePlaybookImageMime,
  playbookImageFilesFromList,
  readPlaybookImageFile,
  removeImage,
  resizeImage,
  resizeImageFromHandle,
  scaleImageSize,
} from "./images";
import type { PlaybookImage } from "./types";

function still(partial: Partial<PlaybookImage> = {}): PlaybookImage {
  return {
    id: "i1",
    name: "lineup.png",
    mime: "image/png",
    x: 0,
    y: 0,
    width: 200,
    height: 100,
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

describe("image geometry", () => {
  it("hits the topmost still and moves / removes by id", () => {
    const images = [
      still({ id: "a", x: 0, y: 0 }),
      still({ id: "b", x: 0, y: 0, width: 80, height: 40 }),
    ];
    expect(hitTestImage(images, { x: 0, y: 0 }, identity)?.id).toBe("b");
    expect(hitTestImage(images, { x: 400, y: 400 }, identity)).toBeNull();
    expect(moveImage(images, "a", 8, 9)[0]).toMatchObject({ id: "a", x: 8, y: 9 });
    expect(removeImage(images, "b").map((row) => row.id)).toEqual(["a"]);
    expect(removeImage(images, "missing")).toEqual(images);
  });

  it("maps world size through a flipped radar projection", () => {
    const image = still({ x: 10, y: 20, width: 40, height: 20 });
    const toScreen = (wx: number, wy: number) => ({ x: wx, y: 100 - wy });
    expect(imageScreenRect(image, toScreen)).toEqual({ x: -10, y: 70, w: 40, h: 20 });
  });

  it("hits a corner handle of the selected still", () => {
    const image = still({ width: 100, height: 50 });
    expect(hitTestImageHandle(image, { x: 50, y: 25 }, identity)).toBe("se");
    expect(hitTestImageHandle(image, { x: -50, y: -25 }, identity)).toBe("nw");
    expect(hitTestImageHandle(image, { x: 0, y: 0 }, identity)).toBeNull();
  });

  it("resizes from a corner and keeps aspect", () => {
    const image = still({ x: 0, y: 0, width: 200, height: 100 });
    const grown = resizeImageFromHandle(image, "se", { x: 200, y: 100 });
    expect(grown.width / grown.height).toBeCloseTo(2);
    expect(grown.width).toBeGreaterThan(200);
    const floor = resizeImageFromHandle(image, "se", { x: 1, y: 1 });
    expect(floor.width).toBe(PLAYBOOK_IMAGE_MIN_WIDTH);
    expect(floor.height).toBe(PLAYBOOK_IMAGE_MIN_WIDTH / 2);
    const list = resizeImage([image], image.id, "nw", { x: -200, y: 100 });
    expect(list[0]?.width / (list[0]?.height ?? 1)).toBeCloseTo(2);
  });

  it("stacks a new still after the last one", () => {
    expect(nextImageOrigin([])).toEqual({ x: 0, y: 0 });
    expect(nextImageOrigin([], { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
    expect(nextImageOrigin([still({ x: 5, y: 7 })])).toEqual({
      x: 5 + PLAYBOOK_IMAGE_STACK,
      y: 7,
    });
  });

  it("scales world size from the source aspect", () => {
    expect(scaleImageSize(800, 400)).toEqual({
      width: PLAYBOOK_IMAGE_DEFAULT_WIDTH,
      height: PLAYBOOK_IMAGE_DEFAULT_WIDTH / 2,
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

  it("reads a png and builds a still at the drop point", async () => {
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
      width: PLAYBOOK_IMAGE_DEFAULT_WIDTH,
      height: PLAYBOOK_IMAGE_DEFAULT_WIDTH / 2,
    });
    const stills = [makePlaybookImage(decoded, { x: 12, y: 34 }, "img-1")];
    expect(stills[0]).toMatchObject({
      id: "img-1",
      name: "lineup.png",
      x: 12,
      y: 34,
      width: PLAYBOOK_IMAGE_DEFAULT_WIDTH,
      height: PLAYBOOK_IMAGE_DEFAULT_WIDTH / 2,
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
