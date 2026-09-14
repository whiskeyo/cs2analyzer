import type { PDFPage } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { PLAYBOOK_PDF_PIN_HIT_MIN } from "./constants";
import { playbookPdfVideoPinHits } from "./playbookPdfClips";
import type { PlaybookReportClip } from "./playbookReport";

const page = {} as PDFPage;

function clip(partial: Partial<PlaybookReportClip> = {}): PlaybookReportClip {
  return {
    title: "Window lineup",
    url: "https://www.youtube.com/watch?v=abcdefghijk",
    x: 0,
    y: 0,
    floor: "upper",
    index: 1,
    ...partial,
  };
}

describe("playbookPdfVideoPinHits", () => {
  const still = { floor: "upper" as const, page, x: 48, y: 200, width: 360, height: 360 };

  it("maps floor clips onto the still and skips the other floor", () => {
    expect(playbookPdfVideoPinHits([still], [clip()], undefined)).toEqual([]);
    const hits = playbookPdfVideoPinHits(
      [still],
      [clip(), clip({ floor: "lower", url: "https://www.youtube.com/watch?v=bbbbbbbbbbb" })],
      UNIT_CALIBRATION,
    );
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      page,
    });
    expect(hits[0]!.width).toBeGreaterThanOrEqual(PLAYBOOK_PDF_PIN_HIT_MIN);
    expect(hits[0]!.height).toBeGreaterThanOrEqual(PLAYBOOK_PDF_PIN_HIT_MIN);
  });
});
