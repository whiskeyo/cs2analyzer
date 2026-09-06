import { afterEach, describe, expect, it, vi } from "vitest";
import { loadLayoutFile, saveLayoutFile } from "./api";
import { emptyLayout } from "./layout";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadLayoutFile", () => {
  it("returns an empty layout on 404", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ status: 404, ok: false })),
    );
    await expect(loadLayoutFile("de_mirage")).resolves.toEqual(emptyLayout("de_mirage"));
  });

  it("throws on other HTTP errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ status: 500, ok: false })),
    );
    await expect(loadLayoutFile("de_mirage")).rejects.toThrow("could not load de_mirage layout");
  });

  it("parses a valid file and falls back when the body is junk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        ok: true,
        json: async () => ({
          schema: 1,
          map: "de_mirage",
          callouts: [
            {
              id: "palace",
              name: "Palace",
              floor: "default",
              polygon: [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 4 },
              ],
            },
          ],
        }),
      })),
    );
    const ok = await loadLayoutFile("de_mirage");
    expect(ok.callouts[0]?.id).toBe("palace");

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        status: 200,
        ok: true,
        json: async () => ({ schema: 2 }),
      })),
    );
    await expect(loadLayoutFile("de_mirage")).resolves.toEqual(emptyLayout("de_mirage"));
  });
});

describe("saveLayoutFile", () => {
  it("returns the written path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true, path: "apps/web/public/layouts/de_mirage.json" }),
      })),
    );
    await expect(saveLayoutFile(emptyLayout("de_mirage"))).resolves.toBe(
      "apps/web/public/layouts/de_mirage.json",
    );
  });

  it("uses a fallback path and error when the server omits them", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ ok: true }),
      })),
    );
    await expect(saveLayoutFile(emptyLayout("de_nuke"))).resolves.toBe(
      "apps/web/public/layouts/de_nuke.json",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({}),
      })),
    );
    await expect(saveLayoutFile(emptyLayout("de_nuke"))).rejects.toThrow("save failed");
  });
});
