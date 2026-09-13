import { describe, expect, it } from "vitest";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { PLAYBOOK_PDF_PIN_HIT_MIN, PLAYBOOK_PDF_RADAR_SIZE } from "./constants";
import { playbookPdfPinHit } from "./playbookPdfPins";

describe("playbookPdfPinHit", () => {
  it("maps a world pin onto the drawn still, never smaller than the hit floor", () => {
    const still = { x: 48, y: 200, width: 360, height: 360 };
    const hit = playbookPdfPinHit({ x: 0, y: 0 }, UNIT_CALIBRATION, still);
    expect(hit.width).toBeGreaterThanOrEqual(PLAYBOOK_PDF_PIN_HIT_MIN);
    expect(hit.height).toBeGreaterThanOrEqual(PLAYBOOK_PDF_PIN_HIT_MIN);
    const cx = hit.x + hit.width / 2;
    const cy = hit.y + hit.height / 2;
    expect(cx).toBeGreaterThan(still.x);
    expect(cx).toBeLessThan(still.x + still.width);
    expect(cy).toBeGreaterThan(still.y);
    expect(cy).toBeLessThan(still.y + still.height);
    expect(PLAYBOOK_PDF_RADAR_SIZE).toBe(720);
  });
});
