import { describe, expect, it } from "vitest";
import { VIEW_SCALE_MAX, VIEW_SCALE_MIN } from "@/lib/radar/constants";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import {
  OVERLAY_CHEVRON_SIZE,
  OVERLAY_HABITS_TRAIL_STROKE,
  applyOverlayStrokeStyle,
  overlayChevronPath,
  overlayMarkerSize,
  overlayStrokeWidth,
} from "./overlayStroke";

describe("overlayStrokeWidth", () => {
  it("stays screen-space at min, fitted, and max app zoom", () => {
    expect(overlayStrokeWidth(OVERLAY_HABITS_TRAIL_STROKE, VIEW_SCALE_MIN)).toBe(
      OVERLAY_HABITS_TRAIL_STROKE,
    );
    expect(overlayStrokeWidth(OVERLAY_HABITS_TRAIL_STROKE, 1)).toBe(OVERLAY_HABITS_TRAIL_STROKE);
    expect(overlayStrokeWidth(OVERLAY_HABITS_TRAIL_STROKE, VIEW_SCALE_MAX)).toBe(
      OVERLAY_HABITS_TRAIL_STROKE,
    );
  });

  it("ignores a non-finite zoom instead of fattening the stroke", () => {
    expect(overlayStrokeWidth(2, Number.NaN)).toBe(2);
    expect(overlayStrokeWidth(2, 0)).toBe(2);
    expect(overlayStrokeWidth(-1, 4)).toBe(0);
  });
});

describe("overlayMarkerSize", () => {
  it("keeps pawn / arrow heads the same CSS size when zoomed", () => {
    expect(overlayMarkerSize(OVERLAY_CHEVRON_SIZE, VIEW_SCALE_MAX)).toBe(OVERLAY_CHEVRON_SIZE);
  });
});

describe("overlayChevronPath", () => {
  it("builds a path head instead of a sprite", () => {
    const ctx = createMockCanvas();
    overlayChevronPath(ctx, OVERLAY_CHEVRON_SIZE);
    expect(ctx.beginPath).toHaveBeenCalledOnce();
    expect(ctx.moveTo).toHaveBeenCalledWith(OVERLAY_CHEVRON_SIZE + 2, 0);
    expect(ctx.lineTo).toHaveBeenCalled();
    expect(ctx.closePath).toHaveBeenCalledOnce();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe("applyOverlayStrokeStyle", () => {
  it("sets a round, screen-space stroke", () => {
    const ctx = createMockCanvas();
    applyOverlayStrokeStyle(ctx, overlayStrokeWidth(2.2, 6));
    expect(ctx.lineWidth).toBe(2.2);
    expect(ctx.lineJoin).toBe("round");
    expect(ctx.lineCap).toBe("round");
  });
});
