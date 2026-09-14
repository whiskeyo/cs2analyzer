/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { DEFAULT_LAYERS, DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { UNIT_CALIBRATION, makeReplay } from "@/lib/testing/fixtures";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import { DEFAULT_RADAR_GRAY, RADAR_GRAY_MIN } from "@/lib/shared/constants";
import {
  paintMatchSnapshot,
  matchSnapshotRadarFile,
  snapshotMatchBookmarks,
} from "./matchSnapshot";

const paintRadarFrame = vi.hoisted(() => vi.fn());
const paintPawns = vi.hoisted(() => vi.fn());
const paintMapImage = vi.hoisted(() => vi.fn());
const paintNote = vi.hoisted(() => vi.fn());
const buildRadarFrame = vi.hoisted(() =>
  vi.fn(() => ({
    useLowerFloor: false,
    pawns: [],
    nades: [],
  })),
);
const loadPlaybookSnapshotIcons = vi.hoisted(() => vi.fn());
const loadHtmlImage = vi.hoisted(() => vi.fn());
const encodeCanvasPng = vi.hoisted(() => vi.fn());

vi.mock("@/lib/radar/paintRadarFrame", () => ({
  paintRadarFrame,
  paintPawns,
}));

vi.mock("@/lib/radar/staticMapPaint", () => ({
  paintMapImage,
  paintNote,
}));

vi.mock("@/lib/radar/radarFrame", () => ({
  buildRadarFrame,
}));

vi.mock("./playbookSnapshot", () => ({
  loadPlaybookSnapshotIcons,
  loadHtmlImage,
  encodeCanvasPng,
}));

describe("matchSnapshotRadarFile", () => {
  const withLower = { ...UNIT_CALIBRATION, lower_radar: "lower.png" };

  it("picks the lower PNG only when the frame is on that floor", () => {
    expect(matchSnapshotRadarFile(withLower, true)).toBe("lower.png");
    expect(matchSnapshotRadarFile(withLower, false)).toBe("test.png");
    expect(matchSnapshotRadarFile(UNIT_CALIBRATION, true)).toBe("test.png");
    expect(matchSnapshotRadarFile(undefined, true)).toBeNull();
  });
});

describe("paintMatchSnapshot", () => {
  it("clears the canvas and paints map, frame, notes, and pawns", () => {
    const ctx = createMockCanvas();
    const replay = makeReplay();
    const note = {
      ...emptyNote(),
      drawings: [{ type: "text" as const, color: "#fff", x: 1, y: 2, text: "stairs" }],
    };
    const img = { complete: true, naturalWidth: 1024 } as HTMLImageElement;
    const icons = { c4: img, nades: {} };
    paintMatchSnapshot(ctx, 240, replay, 200, UNIT_CALIBRATION, note, img, icons);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 240, 240);
    expect(ctx.fillRect).not.toHaveBeenCalled();
    expect(paintMapImage).toHaveBeenCalledWith(
      ctx,
      240,
      240,
      { scale: 1, ox: 0, oy: 0 },
      img,
      UNIT_CALIBRATION,
      DEFAULT_RADAR_GRAY,
    );
    expect(paintRadarFrame).toHaveBeenCalled();
    expect(paintNote).toHaveBeenCalledWith(ctx, note, expect.any(Function), { tick: 200 });
    expect(paintPawns).toHaveBeenCalled();
  });
});

describe("snapshotMatchBookmarks", () => {
  it("skips work when there are no bookmarks", async () => {
    await expect(snapshotMatchBookmarks(makeReplay(), [], [], UNIT_CALIBRATION)).resolves.toEqual(
      {},
    );
    expect(loadPlaybookSnapshotIcons).not.toHaveBeenCalled();
  });

  it("keys PNG bytes by bookmark id and forwards radarGray", async () => {
    loadPlaybookSnapshotIcons.mockResolvedValue({ c4: null, nades: {} });
    loadHtmlImage.mockResolvedValue({ src: "/maps/test.png" });
    encodeCanvasPng.mockResolvedValue(new Uint8Array([9, 9]));
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      clearRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    const stills = await snapshotMatchBookmarks(
      makeReplay(),
      [
        {
          id: "1:0",
          title: "Entry",
          roundLabel: "R1",
          clock: "0:02",
          economy: "Pistol",
          scoreLine: "",
          caption: "",
          tick: 200,
          round: 1,
        },
      ],
      [{ round: 1, note: emptyNote() }],
      UNIT_CALIBRATION,
      DEFAULT_LAYERS,
      "auto",
      DEFAULT_SUMMARY_FILTER,
      RADAR_GRAY_MIN,
    );
    expect(stills).toEqual({ "1:0": new Uint8Array([9, 9]) });
    expect(paintMapImage).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      RADAR_GRAY_MIN,
    );
    getContext.mockRestore();
  });
});
