import { describe, expect, it, vi } from "vitest";
import { loadCalibrations, radarFile } from "./maps";

const cal = {
  pos_x: 0,
  pos_y: 1024,
  scale: 1,
  radar: "de_mirage.png",
  lower_radar: "de_mirage_lower.png",
};

describe("radarFile", () => {
  it("picks the lower PNG when that floor exists", () => {
    expect(radarFile(cal, "default")).toBe("de_mirage.png");
    expect(radarFile(cal, "lower")).toBe("de_mirage_lower.png");
    expect(radarFile({ ...cal, lower_radar: undefined }, "lower")).toBe("de_mirage.png");
  });
});

describe("loadCalibrations", () => {
  it("returns JSON when the request succeeds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ de_mirage: cal }) })),
    );
    await expect(loadCalibrations()).resolves.toEqual({ de_mirage: cal });
    vi.unstubAllGlobals();
  });

  it("throws when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    await expect(loadCalibrations()).rejects.toThrow("could not load map calibrations");
    vi.unstubAllGlobals();
  });
});
