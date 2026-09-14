import { describe, expect, it, vi } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import type { Note } from "@/lib/notes/types";
import { DEFAULT_RADAR_GRAY } from "@/lib/shared/constants";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import {
  paintNadeEffect,
  paintNadeTrailLine,
  paintPawnLegend,
  paintPlaybookBoard,
  paintPlaybookImagePin,
  paintPlaybookImages,
  paintPlaybookPiece,
  paintPlaybookPieces,
  paintRotateGizmo,
  paintYouTubePin,
  paintYouTubePins,
  playbookUsesLower,
} from "./paint";
import { makePiece, PLAYBOOK_ROTATE_RADIUS_PX } from "./pieces";

describe("playbookUsesLower", () => {
  const withLower = { ...UNIT_CALIBRATION, lower_radar: "lower.png" };

  it("follows an explicit floor when the map has one", () => {
    expect(playbookUsesLower(withLower, "lower")).toBe(true);
    expect(playbookUsesLower(withLower, "upper")).toBe(false);
    expect(playbookUsesLower(withLower, "auto")).toBe(false);
    expect(playbookUsesLower(UNIT_CALIBRATION, "lower")).toBe(false);
    expect(playbookUsesLower(undefined, "lower")).toBe(false);
  });
});

describe("paintPlaybookBoard", () => {
  it("paints visible drawings and a live draft, skipping hidden ones", () => {
    const ctx = createMockCanvas();
    const note = emptyNote();
    note.drawings.push({
      type: "arrow",
      color: "#0f0",
      from: { x: 0, y: 0 },
      to: { x: 10, y: 10 },
    });
    note.drawings.push({
      type: "pen",
      color: "#f00",
      points: [{ x: 1, y: 1 }],
      hidden: true,
    });
    const img = { complete: true, naturalWidth: 1024 } as HTMLImageElement;
    paintPlaybookBoard(ctx, 400, 400, { scale: 1, ox: 0, oy: 0 }, img, UNIT_CALIBRATION, note, {
      type: "pen",
      color: "#fff",
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 4 },
      ],
    });
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("desaturates the map PNG and restores the filter before ink", () => {
    const ctx = createMockCanvas();
    const filters: string[] = [];
    ctx.drawImage = vi.fn(() => {
      filters.push(ctx.filter);
    });
    const img = { complete: true, naturalWidth: 1024 } as HTMLImageElement;
    paintPlaybookBoard(
      ctx,
      400,
      400,
      { scale: 1, ox: 0, oy: 0 },
      img,
      UNIT_CALIBRATION,
      emptyNote(),
    );
    expect(filters).toEqual(["saturate(0)"]);
    expect(ctx.filter).toBe("none");
    paintPlaybookBoard(
      ctx,
      400,
      400,
      { scale: 1, ox: 0, oy: 0 },
      img,
      UNIT_CALIBRATION,
      emptyNote(),
      null,
      undefined,
      null,
      null,
      null,
      [],
      null,
      null,
      0,
    );
    expect(filters).toEqual(["saturate(0)", "none"]);
  });

  it("paints pawns, nades, and the bomb on the board", () => {
    const ctx = createMockCanvas();
    const note = emptyNote();
    note.pieces.push(
      makePiece("pawn", 0, 0, { id: "ct", side: "CT", label: "entry" }),
      makePiece("pawn", 4, 0, {
        id: "t",
        side: "T",
        alive: false,
        carriesC4: true,
      }),
      makePiece("pawn", 8, 0, { id: "sel", side: "CT" }),
      makePiece("smoke", 10, 10, { id: "sm" }),
      makePiece("he", 12, 12, { id: "he" }),
      makePiece("bomb", 20, 20, { id: "c4" }),
    );
    const c4 = { complete: true, naturalWidth: 16 } as HTMLImageElement;
    const nade = {
      complete: true,
      naturalWidth: 20,
      naturalHeight: 20,
    } as HTMLImageElement;
    paintPlaybookBoard(
      ctx,
      400,
      400,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      note,
      null,
      { c4, nades: { smoke: nade } },
      "sel",
    );
    expect(ctx.translate).toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("does not paint a side name on an unlabeled pawn", () => {
    const ctx = createMockCanvas();
    paintPlaybookPiece(ctx, makePiece("pawn", 0, 0, { id: "p", side: "CT" }), (x, y) => ({ x, y }));
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("falls back to C4 text and nade dots when icons are missing", () => {
    const ctx = createMockCanvas();
    paintPlaybookPiece(ctx, makePiece("pawn", 0, 0, { id: "p", carriesC4: true }), (x, y) => ({
      x,
      y,
    }));
    paintPlaybookPiece(ctx, makePiece("bomb", 1, 1, { id: "b" }), (x, y) => ({
      x,
      y,
    }));
    paintPlaybookPiece(ctx, makePiece("flash", 2, 2, { id: "f" }), (x, y) => ({
      x,
      y,
    }));
    paintPlaybookPiece(ctx, makePiece("molotov", 3, 3, { id: "m" }), (x, y) => ({ x, y }));
    paintPlaybookPiece(ctx, makePiece("incendiary", 4, 4, { id: "i" }), (x, y) => ({ x, y }));
    paintPlaybookPiece(ctx, makePiece("decoy", 5, 5, { id: "d" }), (x, y) => ({
      x,
      y,
    }));
    paintPlaybookPiece(
      ctx,
      makePiece("smoke", 7, 7, {
        id: "trail",
        nadeStyle: "effect",
        trail: [
          { x: 0, y: 0 },
          { x: 3, y: 3 },
        ],
      }),
      (x, y) => ({ x, y }),
    );
    paintNadeEffect(ctx, { x: 0, y: 0 }, "he");
    paintNadeEffect(ctx, { x: 1, y: 1 }, "smoke");
    const zoomed = createMockCanvas();
    paintNadeEffect(zoomed, { x: 0, y: 0 }, "smoke", 2);
    const base = createMockCanvas();
    paintNadeEffect(base, { x: 0, y: 0 }, "smoke", 1);
    const zoomedRadius = zoomed.arc.mock.calls[0]?.[2] as number;
    const baseRadius = base.arc.mock.calls[0]?.[2] as number;
    expect(zoomedRadius).toBe(baseRadius * 2);
    paintNadeTrailLine(ctx, [{ x: 0, y: 0 }], { x: 4, y: 4 }, "he", (x, y) => ({
      x,
      y,
    }));
    paintNadeTrailLine(ctx, [], { x: 1, y: 1 }, "smoke", (x, y) => ({ x, y }));
    paintPlaybookPieces(ctx, [makePiece("he", 6, 6, { id: "h" })], (x, y) => ({
      x,
      y,
    }));
    paintPlaybookPiece(
      ctx,
      { id: "raw", kind: "pawn", x: 0, y: 0 },
      (x, y) => ({ x, y }),
      undefined,
      true,
    );
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("paints a live nade trail draft", () => {
    const ctx = createMockCanvas();
    paintPlaybookBoard(
      ctx,
      400,
      400,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      emptyNote(),
      null,
      undefined,
      null,
      null,
      {
        kind: "smoke",
        points: [{ x: 0, y: 0 }],
        hover: { x: 8, y: 8 },
      },
    );
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("paints nade flights as a solid line, not a dotted sample path", () => {
    const dense = createMockCanvas();
    const points = Array.from({ length: 12 }, (_, i) => ({ x: i, y: i }));
    paintNadeTrailLine(dense, points, { x: 12, y: 12 }, "he", (x, y) => ({
      x,
      y,
    }));
    expect(dense.setLineDash).toHaveBeenCalledWith([]);
    expect(dense.stroke).toHaveBeenCalled();
    expect(dense.fill).not.toHaveBeenCalled();

    const short = createMockCanvas();
    paintNadeTrailLine(
      short,
      [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
      { x: 2, y: 2 },
      "smoke",
      (x, y) => ({ x, y }),
    );
    expect(short.fill).toHaveBeenCalled();
  });

  it("omits a draft when none is in progress", () => {
    const ctx = createMockCanvas();
    paintPlaybookBoard(ctx, 400, 400, { scale: 1, ox: 0, oy: 0 }, null, undefined, emptyNote());
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("paints snapshot kill lines and the opening duel", () => {
    const ctx = createMockCanvas();
    const note = emptyNote();
    note.radarFx = {
      deaths: [
        {
          x: 10,
          y: 20,
          line: {
            from: { x: 0, y: 0 },
            to: { x: 10, y: 20 },
            color: "#5b9fd6",
            alpha: 0.9,
            lineWidth: 2,
          },
        },
      ],
      opening: { from: { x: 0, y: 0 }, to: { x: 10, y: 20 }, color: "#ffd24a" },
      tracers: [],
      trails: [],
      heatmap: [],
      summary: [],
      cone: null,
      hits: [],
      flashes: [],
    };
    paintPlaybookBoard(ctx, 400, 400, { scale: 1, ox: 0, oy: 0 }, null, UNIT_CALIBRATION, note);
    expect(ctx.setLineDash).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith("FK", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith("FD", expect.any(Number), expect.any(Number));
  });

  it("paints an aim ring for a pawn and skips missing ids", () => {
    const ctx = createMockCanvas();
    const note = emptyNote();
    note.pieces.push(makePiece("pawn", 0, 0, { id: "p", side: "CT", yaw: 0 }));
    note.pieces.push(makePiece("smoke", 4, 4, { id: "s" }));
    paintPlaybookBoard(
      ctx,
      400,
      400,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      note,
      null,
      undefined,
      null,
      "missing",
    );
    expect(ctx.setLineDash).not.toHaveBeenCalled();
    paintPlaybookBoard(
      ctx,
      400,
      400,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      note,
      null,
      undefined,
      null,
      "s",
    );
    expect(ctx.setLineDash).not.toHaveBeenCalled();
    paintPlaybookBoard(
      ctx,
      400,
      400,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      note,
      null,
      undefined,
      null,
      "p",
    );
    expect(ctx.setLineDash).toHaveBeenCalledWith([4, 3]);
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
    paintRotateGizmo(ctx, { x: 10, y: 20 }, 90, "#5b9fd6");
    expect(ctx.arc).toHaveBeenCalledWith(10, 20, PLAYBOOK_ROTATE_RADIUS_PX, 0, Math.PI * 2);
  });
});

function labeledPawnsNote(): Note {
  const note = emptyNote();
  note.pieces.push(
    makePiece("pawn", 0, 0, { id: "a", label: "donk", color: "#ff2d6a" }),
    makePiece("pawn", 4, 0, { id: "b", label: "donk", color: "#ff2d6a" }),
    makePiece("pawn", 8, 0, { id: "c", label: "m0NESY", color: "#00f0ff" }),
    makePiece("pawn", 12, 0, { id: "d", side: "CT" }),
  );
  return note;
}

describe("paintPawnLegend", () => {
  it("leaves the canvas legend off so the live HTML overlay is the only list", () => {
    const ctx = createMockCanvas();
    paintPlaybookBoard(
      ctx,
      400,
      400,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      labeledPawnsNote(),
    );
    const names = ctx.fillText.mock.calls.map((call) => call[0]);
    expect(names).not.toContain("donk");
    expect(names).not.toContain("m0NESY");
    expect(ctx.roundRect).not.toHaveBeenCalled();
  });

  it("paints unique tinted names on the snapshot / PDF path", () => {
    const ctx = createMockCanvas();
    paintPlaybookBoard(
      ctx,
      400,
      400,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      labeledPawnsNote(),
      null,
      undefined,
      null,
      null,
      null,
      [],
      null,
      null,
      DEFAULT_RADAR_GRAY,
      [],
      null,
      null,
      true,
    );
    const names = ctx.fillText.mock.calls.map((call) => call[0]);
    expect(names).toContain("donk");
    expect(names).toContain("m0NESY");
    expect(names.filter((name) => name === "donk")).toHaveLength(1);
    expect(names.filter((name) => name === "m0NESY")).toHaveLength(1);
  });

  it("skips the panel when fewer than two pawns have names", () => {
    const ctx = createMockCanvas();
    paintPawnLegend(ctx, 400, 400, []);
    expect(ctx.fillText).not.toHaveBeenCalled();
    const note = emptyNote();
    note.pieces.push(makePiece("pawn", 0, 0, { id: "p", label: "donk", color: "#ff2d6a" }));
    paintPlaybookBoard(
      ctx,
      400,
      400,
      { scale: 1, ox: 0, oy: 0 },
      null,
      UNIT_CALIBRATION,
      note,
      null,
      undefined,
      null,
      null,
      null,
      [],
      null,
      null,
      DEFAULT_RADAR_GRAY,
      [],
      null,
      null,
      true,
    );
    expect(ctx.fillText).toHaveBeenCalledWith("donk", expect.any(Number), expect.any(Number));
    expect(ctx.roundRect).not.toHaveBeenCalled();
  });
});

describe("paintPlaybookImages", () => {
  it("paints a selected photo pin at world XY", () => {
    const ctx = createMockCanvas();
    paintPlaybookImagePin(ctx, { x: 20, y: 10 }, true);
    expect(ctx.roundRect).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    paintPlaybookImages(
      ctx,
      [
        {
          id: "i1",
          name: "lineup.png",
          mime: "image/png",
          x: 10,
          y: 20,
        },
      ],
      (wx, wy) => ({ x: wx, y: wy }),
      "i1",
      { x: 30, y: 40 },
    );
    expect(ctx.roundRect).toHaveBeenCalled();
    expect(ctx.drawImage).not.toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(0.55);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("paints 1 and 2 when two photos share a floor", () => {
    const ctx = createMockCanvas();
    paintPlaybookImages(
      ctx,
      [
        { id: "a", name: "a.png", mime: "image/png", x: 0, y: 0 },
        { id: "b", name: "b.png", mime: "image/png", x: 8, y: 0 },
      ],
      (wx, wy) => ({ x: wx, y: wy }),
    );
    expect(ctx.fillText).toHaveBeenCalledWith("1", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith("2", expect.any(Number), expect.any(Number));
  });
});

describe("paintYouTubePin", () => {
  it("fills the YouTube mark", () => {
    const ctx = createMockCanvas();
    paintYouTubePin(ctx, { x: 20, y: 10 }, true);
    expect(ctx.roundRect).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

describe("paintYouTubePins", () => {
  const clip = (id: string, x: number) => ({
    id,
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: id,
    x,
    y: 0,
  });

  it("omits the number when a floor has one clip", () => {
    const ctx = createMockCanvas();
    paintYouTubePins(ctx, [clip("a", 10)], (wx, wy) => ({ x: wx, y: wy }), "a", { x: 30, y: 40 });
    expect(ctx.roundRect).toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(0.55);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("paints 1 and 2 when two clips share a floor", () => {
    const ctx = createMockCanvas();
    paintYouTubePins(ctx, [clip("a", 0), clip("b", 8)], (wx, wy) => ({ x: wx, y: wy }));
    expect(ctx.fillText).toHaveBeenCalledWith("1", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith("2", expect.any(Number), expect.any(Number));
  });
});
