import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import { paintPlaybookBoard, playbookUsesLower } from "./paint";

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
    note.loose.push({
      drawing: { type: "arrow", color: "#0f0", from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
    });
    note.loose.push({
      drawing: { type: "pen", color: "#f00", points: [{ x: 1, y: 1 }] },
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

  it("omits a draft when none is in progress", () => {
    const ctx = createMockCanvas();
    paintPlaybookBoard(ctx, 400, 400, { scale: 1, ox: 0, oy: 0 }, null, undefined, emptyNote());
    expect(ctx.fillRect).toHaveBeenCalled();
  });
});
