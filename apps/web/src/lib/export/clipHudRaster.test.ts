import { afterEach, describe, expect, it } from "vitest";
import { CLIP_HUD_PROBE_PX } from "@/lib/export/constants";
import {
  clipHudProbeImageUrl,
  clipHudProbeSvg,
  clipHudRenderer,
  resetClipHudRendererCache,
  selectClipHudRenderer,
  type ClipHudProbe,
} from "@/lib/export/clipHudRaster";

function usable(overrides: Partial<ClipHudProbe> = {}): ClipHudProbe {
  return {
    tainted: false,
    toBlob: true,
    videoFrame: "ok",
    alphaPreserved: true,
    threw: false,
    ...overrides,
  };
}

afterEach(() => {
  resetClipHudRendererCache();
});

describe("clipHudRenderer", () => {
  it("reuses one probe for the page", () => {
    resetClipHudRendererCache();
    const first = clipHudRenderer();
    expect(clipHudRenderer()).toBe(first);
  });
});

describe("selectClipHudRenderer", () => {
  it("uses the page HUD when the canvas stays usable", () => {
    expect(selectClipHudRenderer(usable())).toBe("page");
  });

  it("uses the page HUD when VideoFrame is absent and the canvas still exports", () => {
    expect(selectClipHudRenderer(usable({ videoFrame: "absent" }))).toBe("page");
  });

  it("keeps the painted HUD when the foreignObject taints the canvas", () => {
    expect(
      selectClipHudRenderer(
        usable({
          tainted: true,
          toBlob: false,
          videoFrame: "failed",
          alphaPreserved: false,
        }),
      ),
    ).toBe("painted");
  });

  it("keeps the painted HUD when toBlob fails", () => {
    expect(selectClipHudRenderer(usable({ toBlob: false }))).toBe("painted");
  });

  it("keeps the painted HUD when VideoFrame throws", () => {
    expect(selectClipHudRenderer(usable({ videoFrame: "failed" }))).toBe("painted");
  });

  it("keeps the painted HUD when the probe throws", () => {
    expect(selectClipHudRenderer(usable({ threw: true }))).toBe("painted");
  });

  it("keeps the painted HUD when transparency is flattened", () => {
    expect(selectClipHudRenderer(usable({ alphaPreserved: false }))).toBe("painted");
  });
});

describe("clipHudProbeSvg", () => {
  it("embeds a transparent foreignObject at the probe size", () => {
    const svg = clipHudProbeSvg();
    expect(svg).toContain("<foreignObject");
    expect(svg).toContain(`width="${CLIP_HUD_PROBE_PX}"`);
    expect(svg).toContain("http://www.w3.org/1999/xhtml");
    expect(svg).toContain("background:transparent");
  });

  it("loads the probe through a data URL, not a blob URL", () => {
    const url = clipHudProbeImageUrl();
    expect(url.startsWith("data:image/svg+xml")).toBe(true);
    expect(url).not.toContain("blob:");
  });
});
