import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadBlob } from "./download";

describe("downloadBlob", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("creates a temporary link, clicks it, and revokes the blob URL", () => {
    const click = vi.fn();
    const anchor = { href: "", download: "", click };
    const createObjectURL = vi.fn(() => "blob:mock");
    const revokeObjectURL = vi.fn();

    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("document", {
      createElement: vi.fn(() => anchor),
    });
    vi.stubGlobal("Blob", vi.fn());

    downloadBlob("notes.json", "application/json", '{"schema":1}');

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(anchor.download).toBe("notes.json");
    expect(anchor.href).toBe("blob:mock");
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });
});
