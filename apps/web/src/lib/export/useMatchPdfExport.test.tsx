/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { makeReplay } from "@/lib/testing/fixtures";
import { DEFAULT_LAYERS, DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import { MATCH_PDF_EXPORT_ERROR } from "./constants";

const downloadMatchPdf = vi.hoisted(() => vi.fn());

vi.mock("@/lib/state/appState", () => ({
  useApp: vi.fn(),
}));

vi.mock("./exportMatch", () => ({
  downloadMatchPdf,
}));

import { useApp } from "@/lib/state/appState";
import { useMatchPdfExport } from "./useMatchPdfExport";

function appState(overrides: Record<string, unknown> = {}) {
  const replay = makeReplay({ header: { map_name: "de_mirage" } });
  return {
    session: { replay, fileName: "match.dem", series: null },
    review: { notes: [], floorMode: "auto", summaryFilter: DEFAULT_SUMMARY_FILTER },
    cal: undefined,
    habits: { aggregated: false },
    ...overrides,
  };
}

describe("useMatchPdfExport", () => {
  beforeEach(() => {
    downloadMatchPdf.mockReset();
    downloadMatchPdf.mockResolvedValue(undefined);
    vi.mocked(useApp).mockReturnValue(appState() as unknown as ReturnType<typeof useApp>);
  });

  it("exports the loaded match and reports a failure", async () => {
    const { result } = renderHook(() => useMatchPdfExport());
    expect(result.current.canExport).toBe(true);
    await act(async () => {
      await result.current.exportPdf();
    });
    expect(downloadMatchPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "match.dem",
        layers: DEFAULT_LAYERS,
        theme: "dark",
      }),
    );

    downloadMatchPdf.mockRejectedValueOnce(new Error("encode failed"));
    const failed = renderHook(() => useMatchPdfExport());
    await act(async () => {
      await failed.result.current.exportPdf();
    });
    await waitFor(() => expect(failed.result.current.error).toBe(MATCH_PDF_EXPORT_ERROR));
  });

  it("is disabled without a replay", () => {
    vi.mocked(useApp).mockReturnValue(
      appState({ session: { replay: null, fileName: "", series: null } }) as unknown as ReturnType<
        typeof useApp
      >,
    );
    const { result } = renderHook(() => useMatchPdfExport());
    expect(result.current.canExport).toBe(false);
  });
});
