/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { DEFAULT_LAYERS } from "@/lib/notes/types";
import { UNIT_CALIBRATION, makeReplay } from "@/lib/testing/fixtures";
import { DEFAULT_RADAR_GRAY } from "@/lib/shared/constants";
import { PLAYBOOK_PDF_MIME } from "./constants";

const mocks = vi.hoisted(() => ({
  downloadBlob: vi.fn(),
  buildMatchPdf: vi.fn(),
  snapshotMatchBookmarks: vi.fn(),
}));

vi.mock("@/lib/shared/download", () => ({
  downloadBlob: mocks.downloadBlob,
}));

vi.mock("./matchPdf", () => ({
  buildMatchPdf: mocks.buildMatchPdf,
}));

vi.mock("./matchSnapshot", () => ({
  snapshotMatchBookmarks: mocks.snapshotMatchBookmarks,
}));

import { downloadMatchPdf } from "./exportMatch";

const EXPORTED_AT = Date.UTC(2026, 8, 14);

describe("downloadMatchPdf", () => {
  afterEach(() => {
    mocks.downloadBlob.mockReset();
    mocks.buildMatchPdf.mockReset();
    mocks.snapshotMatchBookmarks.mockReset();
  });

  it("builds the PDF and triggers a local download", async () => {
    const replay = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NAVI", team_t: "Vitality" },
    });
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    mocks.snapshotMatchBookmarks.mockResolvedValue({});
    mocks.buildMatchPdf.mockResolvedValue(pdf);
    await downloadMatchPdf({
      replay,
      notes: [],
      fileName: "match.dem",
      cal: UNIT_CALIBRATION,
      exportedAt: EXPORTED_AT,
    });
    expect(mocks.snapshotMatchBookmarks).toHaveBeenCalledWith(
      replay,
      [],
      [],
      UNIT_CALIBRATION,
      DEFAULT_LAYERS,
      "auto",
      expect.anything(),
      DEFAULT_RADAR_GRAY,
    );
    expect(mocks.buildMatchPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        heading: "Mirage: NAVI - Vitality",
        fileStem: "mirage-navi-vitality-match",
      }),
      {},
      "dark",
    );
    expect(mocks.downloadBlob).toHaveBeenCalledWith(
      "mirage-navi-vitality-match.pdf",
      PLAYBOOK_PDF_MIME,
      expect.any(ArrayBuffer),
    );
    const downloaded = mocks.downloadBlob.mock.calls[0]?.[2] as ArrayBuffer;
    expect(new Uint8Array(downloaded)).toEqual(pdf);
  });

  it("forwards a light theme and bookmark stills", async () => {
    const replay = makeReplay({ header: { map_name: "de_nuke" } });
    const notes = [
      {
        round: 1,
        note: { ...emptyNote(), bookmarks: [{ color: "#fff", text: "Peek", tick: 100 }] },
      },
    ];
    const stills = { "1:0": new Uint8Array([1, 2]) };
    mocks.snapshotMatchBookmarks.mockResolvedValue(stills);
    mocks.buildMatchPdf.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    await downloadMatchPdf({
      replay,
      notes,
      fileName: "nuke.dem",
      exportedAt: EXPORTED_AT,
      theme: "light",
      radarGray: 0.4,
    });
    expect(mocks.snapshotMatchBookmarks).toHaveBeenCalledWith(
      replay,
      expect.arrayContaining([expect.objectContaining({ title: "Peek" })]),
      notes,
      undefined,
      DEFAULT_LAYERS,
      "auto",
      expect.anything(),
      0.4,
    );
    expect(mocks.buildMatchPdf).toHaveBeenCalledWith(
      expect.objectContaining({ heading: "Nuke: CT - T" }),
      stills,
      "light",
    );
  });
});
