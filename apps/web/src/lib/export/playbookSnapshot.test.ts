/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { NADE_WEAPON } from "@/lib/match/roundEvents";
import { emptyNote } from "@/lib/notes/note";
import { newPage, playbookPageOnFloor } from "@/lib/playbook/pages";
import type { GrenadeKind } from "@/lib/replay/replayTypes";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import { DEFAULT_RADAR_GRAY, DEFAULT_RADAR_PAPER, RADAR_GRAY_MIN } from "@/lib/shared/constants";
import { PLAYBOOK_PDF_RADAR_SIZE } from "./constants";
import {
  encodeCanvasPng,
  loadHtmlImage,
  loadPlaybookSnapshotIcons,
  loadPlaybookSnapshotImage,
  paintPlaybookSnapshot,
  playbookSnapshotRadarFile,
  playbookSnapshotRadarUrl,
  snapshotPlaybookPagePng,
} from "./playbookSnapshot";

const paintPlaybookBoard = vi.hoisted(() => vi.fn());

vi.mock("@/lib/playbook/paint", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/playbook/paint")>();
  return {
    ...actual,
    paintPlaybookBoard,
  };
});

describe("playbookSnapshotRadarFile", () => {
  const withLower = { ...UNIT_CALIBRATION, lower_radar: "lower.png" };

  it("picks the lower PNG when the strat is on that floor", () => {
    expect(playbookSnapshotRadarFile({ floor: "lower" }, withLower)).toBe("lower.png");
    expect(playbookSnapshotRadarFile({ floor: "upper" }, withLower)).toBe("test.png");
    expect(playbookSnapshotRadarFile({ floor: "auto" }, withLower)).toBe("test.png");
    expect(playbookSnapshotRadarFile({ floor: "lower" }, UNIT_CALIBRATION)).toBe("test.png");
    expect(playbookSnapshotRadarFile({ floor: "lower" }, undefined)).toBeNull();
  });

  it("builds a same-origin maps URL", () => {
    expect(playbookSnapshotRadarUrl({ floor: "auto" }, UNIT_CALIBRATION)).toBe("/maps/test.png");
  });
});

describe("paintPlaybookSnapshot", () => {
  it("paints the strat note and videos without a radar panel fill", () => {
    const ctx = createMockCanvas();
    const page = newPage("A exec", "upper");
    page.note = {
      ...emptyNote(),
      drawings: [{ type: "text", color: "#fff", x: 1, y: 2, text: "stairs" }],
    };
    page.videos = [
      {
        id: "v1",
        videoId: "abcdefghijk",
        url: "https://www.youtube.com/watch?v=abcdefghijk",
        title: "Lineup",
        x: 10,
        y: 20,
      },
    ];
    const img = { complete: true, naturalWidth: 1024 } as HTMLImageElement;
    paintPlaybookSnapshot(ctx, 240, page, UNIT_CALIBRATION, img);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 240, 240);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(paintPlaybookBoard).toHaveBeenCalledWith(
      ctx,
      240,
      240,
      { scale: 1, ox: 0, oy: 0 },
      img,
      UNIT_CALIBRATION,
      page.note,
      null,
      undefined,
      null,
      null,
      null,
      page.videos,
      null,
      null,
      DEFAULT_RADAR_GRAY,
      DEFAULT_RADAR_PAPER,
      page.images,
      null,
      null,
      true,
    );
  });

  it("paints the lower-floor note when that layer is selected", () => {
    const ctx = createMockCanvas();
    const page = newPage("A rush", "lower");
    page.note = {
      ...emptyNote(),
      drawings: [{ type: "text", color: "#fff", x: 1, y: 2, text: "heaven" }],
    };
    page.lowerNote = {
      ...emptyNote(),
      drawings: [{ type: "text", color: "#fff", x: 3, y: 4, text: "tuck" }],
    };
    const view = playbookPageOnFloor(page, "lower");
    paintPlaybookSnapshot(ctx, 240, view, UNIT_CALIBRATION, null);
    expect(paintPlaybookBoard).toHaveBeenCalledWith(
      ctx,
      240,
      240,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      page.lowerNote,
      null,
      undefined,
      null,
      null,
      null,
      page.lowerVideos,
      null,
      null,
      DEFAULT_RADAR_GRAY,
      DEFAULT_RADAR_PAPER,
      page.images,
      null,
      null,
      true,
    );
  });

  it("forwards loaded nade and C4 icons into the board paint", () => {
    const ctx = createMockCanvas();
    const page = newPage("A exec", "upper");
    const icons = {
      c4: { src: "/weapons/c4.svg" } as HTMLImageElement,
      nades: { smoke: { src: "/weapons/smokegrenade.svg" } as HTMLImageElement },
    };
    paintPlaybookSnapshot(ctx, 240, page, UNIT_CALIBRATION, null, icons);
    expect(paintPlaybookBoard).toHaveBeenCalledWith(
      ctx,
      240,
      240,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      page.note,
      null,
      icons,
      null,
      null,
      null,
      page.videos,
      null,
      null,
      DEFAULT_RADAR_GRAY,
      DEFAULT_RADAR_PAPER,
      page.images,
      null,
      null,
      true,
    );
  });

  it("forwards radarGray into the board paint", () => {
    const ctx = createMockCanvas();
    const page = newPage("A exec", "upper");
    paintPlaybookSnapshot(ctx, 240, page, UNIT_CALIBRATION, null, undefined, RADAR_GRAY_MIN);
    expect(paintPlaybookBoard).toHaveBeenCalledWith(
      ctx,
      240,
      240,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      page.note,
      null,
      undefined,
      null,
      null,
      null,
      page.videos,
      null,
      null,
      RADAR_GRAY_MIN,
      DEFAULT_RADAR_PAPER,
      page.images,
      null,
      null,
      true,
    );
  });

  it("forwards radarPaper into the board paint", () => {
    const ctx = createMockCanvas();
    const page = newPage("A exec", "upper");
    paintPlaybookSnapshot(ctx, 240, page, UNIT_CALIBRATION, null, undefined, RADAR_GRAY_MIN, true);
    expect(paintPlaybookBoard).toHaveBeenCalledWith(
      ctx,
      240,
      240,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      page.note,
      null,
      undefined,
      null,
      null,
      null,
      page.videos,
      null,
      null,
      RADAR_GRAY_MIN,
      true,
      page.images,
      null,
      null,
      true,
    );
  });

  it("forwards floor image pins into the board paint", () => {
    const ctx = createMockCanvas();
    const page = newPage("A exec", "upper");
    page.images = [
      {
        id: "i1",
        name: "lineup.png",
        mime: "image/png",
        x: 8,
        y: 9,
      },
    ];
    paintPlaybookSnapshot(ctx, 240, page, UNIT_CALIBRATION, null);
    expect(paintPlaybookBoard).toHaveBeenCalledWith(
      ctx,
      240,
      240,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      page.note,
      null,
      undefined,
      null,
      null,
      null,
      page.videos,
      null,
      null,
      DEFAULT_RADAR_GRAY,
      DEFAULT_RADAR_PAPER,
      page.images,
      null,
      null,
      true,
    );
  });
});

describe("encodeCanvasPng", () => {
  it("reads PNG bytes from toBlob", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const canvas = {
      toBlob: (cb: BlobCallback) => {
        cb(new Blob([bytes], { type: "image/png" }));
      },
    };
    await expect(encodeCanvasPng(canvas)).resolves.toEqual(bytes);
  });

  it("rejects when the canvas cannot encode", async () => {
    const canvas = { toBlob: (cb: BlobCallback) => cb(null) };
    await expect(encodeCanvasPng(canvas)).rejects.toThrow("Could not encode radar snapshot.");
  });
});

describe("loadHtmlImage", () => {
  it("resolves when the image loads and rejects on error", async () => {
    const created: {
      onload: (() => void) | null;
      onerror: (() => void) | null;
      src: string;
    }[] = [];
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = "";
        constructor() {
          created.push(this);
        }
      },
    );
    const pending = loadHtmlImage("/maps/test.png");
    expect(created[0]?.src).toBe("/maps/test.png");
    created[0]?.onload?.();
    await expect(pending).resolves.toBe(created[0]);

    const failed = loadHtmlImage("/maps/missing.png");
    created[1]?.onerror?.();
    await expect(failed).rejects.toThrow("Could not load /maps/missing.png");
    vi.unstubAllGlobals();
  });
});

describe("loadPlaybookSnapshotIcons", () => {
  it("loads every board nade kind plus C4 as images", async () => {
    const created: { src: string; onload: (() => void) | null }[] = [];
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = "";
        constructor() {
          created.push(this);
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    const icons = await loadPlaybookSnapshotIcons();
    const kinds = Object.keys(NADE_WEAPON) as GrenadeKind[];
    expect(kinds).toEqual(["smoke", "flash", "he", "molotov", "incendiary", "decoy"]);
    for (const kind of kinds) {
      expect(icons.nades[kind]).toBeTruthy();
    }
    expect(icons.c4).toBeTruthy();
    expect(created.map((row) => row.src)).toEqual(
      expect.arrayContaining([
        "/weapons/smokegrenade.svg",
        "/weapons/flashbang.svg",
        "/weapons/hegrenade.svg",
        "/weapons/molotov.svg",
        "/weapons/incgrenade.svg",
        "/weapons/decoy.svg",
        "/weapons/c4.svg",
      ]),
    );
    vi.unstubAllGlobals();
  });
});

describe("loadPlaybookSnapshotImage", () => {
  it("returns null without a calibration or when the image fails", async () => {
    expect(await loadPlaybookSnapshotImage({ floor: "auto" }, undefined)).toBeNull();
    vi.stubGlobal(
      "Image",
      class {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        src = "";
        constructor() {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
    expect(await loadPlaybookSnapshotImage({ floor: "auto" }, UNIT_CALIBRATION)).toBeNull();
    vi.unstubAllGlobals();
  });
});

describe("snapshotPlaybookPagePng", () => {
  it("returns null when the canvas has no 2d context", async () => {
    const page = newPage();
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "canvas") {
        return {
          width: 0,
          height: 0,
          getContext: () => null,
        } as unknown as HTMLCanvasElement;
      }
      return original(tag);
    });
    expect(await snapshotPlaybookPagePng(page, UNIT_CALIBRATION, null)).toBeNull();
    vi.restoreAllMocks();
  });

  it("paints at the named radar size and encodes PNG bytes", async () => {
    const page = newPage();
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => createMockCanvas()),
      toBlob: (cb: BlobCallback) => cb(new Blob([new Uint8Array([9, 8])], { type: "image/png" })),
    };
    const original = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag === "canvas") return canvas as unknown as HTMLCanvasElement;
      return original(tag);
    });
    const bytes = await snapshotPlaybookPagePng(page, UNIT_CALIBRATION, null);
    expect(canvas.width).toBe(PLAYBOOK_PDF_RADAR_SIZE);
    expect(canvas.height).toBe(PLAYBOOK_PDF_RADAR_SIZE);
    expect(bytes).toEqual(new Uint8Array([9, 8]));
    vi.restoreAllMocks();
  });
});
