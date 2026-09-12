/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { newPlaybook, setPageBody } from "@/lib/playbook/pages";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { PLAYBOOK_PDF_MIME } from "./constants";

const mocks = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  buildPlaybookPdf: vi.fn(),
  loadPlaybookSnapshotImage: vi.fn(),
  snapshotPlaybookPagePng: vi.fn(),
}));

vi.mock("@/lib/shared/download", () => ({
  downloadBlob: mocks.downloadBlob,
}));

vi.mock("./pdfDocument", () => ({
  buildPlaybookPdf: mocks.buildPlaybookPdf,
}));

vi.mock("./playbookSnapshot", () => ({
  loadPlaybookSnapshotImage: mocks.loadPlaybookSnapshotImage,
  snapshotPlaybookPagePng: mocks.snapshotPlaybookPagePng,
}));

import { downloadPlaybookPdf, snapshotPlaybookPages } from "./exportPlaybook";

const EXPORTED_AT = Date.UTC(2026, 8, 12);

describe("snapshotPlaybookPages", () => {
  afterEach(() => {
    mocks.loadPlaybookSnapshotImage.mockReset();
    mocks.snapshotPlaybookPagePng.mockReset();
  });

  it("keeps PNG bytes keyed by strat id and skips failed stills", async () => {
    const book = newPlaybook("de_mirage", "A execs");
    const page = book.pages[0]!;
    mocks.loadPlaybookSnapshotImage.mockResolvedValue({ src: "/maps/test.png" });
    mocks.snapshotPlaybookPagePng.mockResolvedValue(new Uint8Array([7, 7]));
    await expect(snapshotPlaybookPages(book, UNIT_CALIBRATION)).resolves.toEqual({
      [page.id]: new Uint8Array([7, 7]),
    });

    mocks.snapshotPlaybookPagePng.mockResolvedValue(null);
    await expect(snapshotPlaybookPages(book, UNIT_CALIBRATION)).resolves.toEqual({});
  });
});

describe("downloadPlaybookPdf", () => {
  afterEach(() => {
    mocks.downloadBlob.mockReset();
    mocks.buildPlaybookPdf.mockReset();
    mocks.loadPlaybookSnapshotImage.mockReset();
    mocks.snapshotPlaybookPagePng.mockReset();
  });

  it("builds the PDF and triggers a local download", async () => {
    let book = newPlaybook("de_mirage", "A execs");
    const page = book.pages[0]!;
    book = setPageBody(book, page.id, "Flash mid");
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    mocks.loadPlaybookSnapshotImage.mockResolvedValue(null);
    mocks.snapshotPlaybookPagePng.mockResolvedValue(new Uint8Array([1]));
    mocks.buildPlaybookPdf.mockResolvedValue(pdf);

    await downloadPlaybookPdf(book, UNIT_CALIBRATION, EXPORTED_AT);

    expect(mocks.buildPlaybookPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "A execs",
        mapLabel: "Mirage",
        fileStem: "mirage-a-execs",
      }),
      { [page.id]: new Uint8Array([1]) },
    );
    expect(mocks.downloadBlob).toHaveBeenCalledWith("mirage-a-execs.pdf", PLAYBOOK_PDF_MIME, pdf);
  });
});
