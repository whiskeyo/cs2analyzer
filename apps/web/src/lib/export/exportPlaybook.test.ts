/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { newPlaybook, setPageBody } from "@/lib/playbook/pages";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { DEFAULT_RADAR_GRAY, RADAR_GRAY_MIN } from "@/lib/shared/constants";
import { PLAYBOOK_PDF_MIME } from "./constants";

const mocks = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  buildPlaybookPdf: vi.fn(),
  loadPlaybookSnapshotImage: vi.fn(),
  loadPlaybookSnapshotIcons: vi.fn(),
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
  loadPlaybookSnapshotIcons: mocks.loadPlaybookSnapshotIcons,
  snapshotPlaybookPagePng: mocks.snapshotPlaybookPagePng,
}));

import { downloadPlaybookPdf, snapshotPlaybookPages } from "./exportPlaybook";

const EXPORTED_AT = Date.UTC(2026, 8, 12);

describe("snapshotPlaybookPages", () => {
  afterEach(() => {
    mocks.loadPlaybookSnapshotImage.mockReset();
    mocks.loadPlaybookSnapshotIcons.mockReset();
    mocks.snapshotPlaybookPagePng.mockReset();
  });

  it("keeps PNG bytes keyed by strat id and skips failed stills", async () => {
    const book = newPlaybook("de_mirage", "A execs");
    const page = book.pages[0]!;
    mocks.loadPlaybookSnapshotImage.mockResolvedValue({
      src: "/maps/test.png",
    });
    mocks.loadPlaybookSnapshotIcons.mockResolvedValue({
      c4: { src: "/weapons/c4.svg" },
      nades: { smoke: { src: "/weapons/smokegrenade.svg" } },
    });
    mocks.snapshotPlaybookPagePng.mockResolvedValue(new Uint8Array([7, 7]));
    await expect(snapshotPlaybookPages(book, UNIT_CALIBRATION)).resolves.toEqual({
      [page.id]: { upper: new Uint8Array([7, 7]) },
    });
    expect(mocks.snapshotPlaybookPagePng).toHaveBeenCalledWith(
      expect.anything(),
      UNIT_CALIBRATION,
      { src: "/maps/test.png" },
      {
        c4: { src: "/weapons/c4.svg" },
        nades: { smoke: { src: "/weapons/smokegrenade.svg" } },
      },
      undefined,
      DEFAULT_RADAR_GRAY,
    );

    mocks.snapshotPlaybookPagePng.mockResolvedValue(null);
    await expect(snapshotPlaybookPages(book, UNIT_CALIBRATION)).resolves.toEqual({});
  });

  it("forwards radarGray into each floor still", async () => {
    const book = newPlaybook("de_mirage", "A execs");
    mocks.loadPlaybookSnapshotImage.mockResolvedValue(null);
    mocks.loadPlaybookSnapshotIcons.mockResolvedValue({ c4: null, nades: {} });
    mocks.snapshotPlaybookPagePng.mockResolvedValue(new Uint8Array([3]));
    await snapshotPlaybookPages(book, UNIT_CALIBRATION, RADAR_GRAY_MIN);
    expect(mocks.snapshotPlaybookPagePng).toHaveBeenCalledWith(
      expect.anything(),
      UNIT_CALIBRATION,
      null,
      { c4: null, nades: {} },
      undefined,
      RADAR_GRAY_MIN,
    );
  });
});

describe("downloadPlaybookPdf", () => {
  afterEach(() => {
    mocks.downloadBlob.mockReset();
    mocks.buildPlaybookPdf.mockReset();
    mocks.loadPlaybookSnapshotImage.mockReset();
    mocks.loadPlaybookSnapshotIcons.mockReset();
    mocks.snapshotPlaybookPagePng.mockReset();
  });

  it("builds the PDF and triggers a local download", async () => {
    let book = newPlaybook("de_mirage", "A execs");
    const page = book.pages[0]!;
    book = setPageBody(book, page.id, "Flash mid");
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    mocks.loadPlaybookSnapshotImage.mockResolvedValue(null);
    mocks.loadPlaybookSnapshotIcons.mockResolvedValue({ c4: null, nades: {} });
    mocks.snapshotPlaybookPagePng.mockResolvedValue(new Uint8Array([1]));
    mocks.buildPlaybookPdf.mockResolvedValue(pdf);

    await downloadPlaybookPdf(book, UNIT_CALIBRATION, EXPORTED_AT);

    expect(mocks.buildPlaybookPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "A execs",
        mapLabel: "Mirage",
        heading: "Mirage: A execs",
        fileStem: "mirage-a-execs",
      }),
      { [page.id]: { upper: new Uint8Array([1]) } },
      "dark",
    );
    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      "mirage-a-execs.pdf",
      PLAYBOOK_PDF_MIME,
      expect.any(ArrayBuffer),
    );
    const downloaded = mocks.downloadBlob.mock.calls[0]?.[2] as ArrayBuffer;
    expect(new Uint8Array(downloaded)).toEqual(pdf);
  });

  it("forwards a light PDF theme", async () => {
    const book = newPlaybook("de_nuke", "default executes");
    mocks.loadPlaybookSnapshotImage.mockResolvedValue(null);
    mocks.loadPlaybookSnapshotIcons.mockResolvedValue({ c4: null, nades: {} });
    mocks.snapshotPlaybookPagePng.mockResolvedValue(null);
    mocks.buildPlaybookPdf.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    await downloadPlaybookPdf(book, UNIT_CALIBRATION, EXPORTED_AT, "light");
    expect(mocks.buildPlaybookPdf).toHaveBeenCalledWith(
      expect.objectContaining({ heading: "Nuke: default executes" }),
      {},
      "light",
    );
  });

  it("forwards radarGray into PDF stills", async () => {
    const book = newPlaybook("de_nuke", "default executes");
    mocks.loadPlaybookSnapshotImage.mockResolvedValue(null);
    mocks.loadPlaybookSnapshotIcons.mockResolvedValue({ c4: null, nades: {} });
    mocks.snapshotPlaybookPagePng.mockResolvedValue(null);
    mocks.buildPlaybookPdf.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    await downloadPlaybookPdf(book, UNIT_CALIBRATION, EXPORTED_AT, "dark", RADAR_GRAY_MIN);
    expect(mocks.snapshotPlaybookPagePng).toHaveBeenCalledWith(
      expect.anything(),
      UNIT_CALIBRATION,
      null,
      { c4: null, nades: {} },
      undefined,
      RADAR_GRAY_MIN,
    );
  });
});

describe("snapshotPlaybookPages floors", () => {
  afterEach(() => {
    mocks.loadPlaybookSnapshotImage.mockReset();
    mocks.loadPlaybookSnapshotIcons.mockReset();
    mocks.snapshotPlaybookPagePng.mockReset();
  });

  it("paints upper and lower stills when the map has a lower radar", async () => {
    const book = newPlaybook("de_nuke", "Nuke execs");
    const page = book.pages[0]!;
    const withLower = { ...UNIT_CALIBRATION, lower_radar: "lower.png" };
    mocks.loadPlaybookSnapshotImage.mockResolvedValue({
      src: "/maps/test.png",
    });
    mocks.loadPlaybookSnapshotIcons.mockResolvedValue({ c4: null, nades: {} });
    mocks.snapshotPlaybookPagePng
      .mockResolvedValueOnce(new Uint8Array([1]))
      .mockResolvedValueOnce(new Uint8Array([2]));
    await expect(snapshotPlaybookPages(book, withLower)).resolves.toEqual({
      [page.id]: { upper: new Uint8Array([1]), lower: new Uint8Array([2]) },
    });
    expect(mocks.snapshotPlaybookPagePng).toHaveBeenCalledTimes(2);
    expect(mocks.snapshotPlaybookPagePng.mock.calls[0]?.[0]).toMatchObject({
      floor: "upper",
    });
    expect(mocks.snapshotPlaybookPagePng.mock.calls[1]?.[0]).toMatchObject({
      floor: "lower",
    });
  });
});
