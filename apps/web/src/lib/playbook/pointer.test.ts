import { describe, expect, it } from "vitest";
import {
  applyPlaybookWheel,
  beginPlaybookPan,
  createPlaybookView,
  endPlaybookPan,
  movePlaybookPan,
} from "./pointer";

describe("playbook pan and zoom", () => {
  it("starts at identity and pans while dragging", () => {
    const view = createPlaybookView();
    expect(view).toMatchObject({ scale: 1, ox: 0, oy: 0, dragging: false });
    movePlaybookPan(view, 20, 10);
    expect(view.ox).toBe(0);
    beginPlaybookPan(view, 10, 10);
    expect(view.dragging).toBe(true);
    movePlaybookPan(view, 25, 18);
    expect(view.ox).toBe(15);
    expect(view.oy).toBe(8);
    endPlaybookPan(view);
    expect(view.dragging).toBe(false);
    movePlaybookPan(view, 40, 40);
    expect(view.ox).toBe(15);
  });

  it("zooms toward the cursor", () => {
    const view = createPlaybookView();
    const before = view.scale;
    applyPlaybookWheel(view, 400, 400, 200, 200, -100);
    expect(view.scale).toBeGreaterThan(before);
    const zoomed = view.scale;
    applyPlaybookWheel(view, 400, 400, 200, 200, 100);
    expect(view.scale).toBeLessThan(zoomed);
  });
});
