import { describe, expect, it } from "vitest";
import { CLIP_H264_CODECS } from "@/lib/export/constants";
import {
  firstSupportedH264Config,
  h264EncoderCandidates,
  probeClipEncoder,
} from "@/lib/export/clipEncodeSupport";

describe("H.264 config probe", () => {
  it("asks for AVC output at the export size and keeps the first supported profile", async () => {
    const candidates = h264EncoderCandidates(1080, 1080, 30, 12_000_000);
    expect(candidates.map((config) => config.codec)).toEqual([...CLIP_H264_CODECS]);
    expect(candidates[0]).toMatchObject({
      width: 1080,
      height: 1080,
      framerate: 30,
      avc: { format: "avc" },
      latencyMode: "quality",
    });

    const seen: string[] = [];
    const picked = await firstSupportedH264Config(candidates, async (config) => {
      seen.push(config.codec);
      if (config.codec === "avc1.640028") throw new Error("probe failed");
      return config.codec === "avc1.4d0028";
    });
    expect(picked?.codec).toBe("avc1.4d0028");
    expect(seen).toContain("avc1.640028");
    expect(await firstSupportedH264Config(candidates, async () => false)).toBeNull();
  });

  it("falls back when VideoEncoder or the H.264 config is missing", async () => {
    const offline = await probeClipEncoder(1440, {
      hasVideoEncoder: true,
      isConfigSupported: async (config) => config.codec === "avc1.640033",
      mediaRecorderMime: "video/webm",
    });
    expect(offline).toMatchObject({
      path: "webcodecs",
      codec: "avc1.640033",
      width: 1440,
      height: 1440,
      fps: 30,
    });

    const realtime = await probeClipEncoder(1080, {
      hasVideoEncoder: true,
      isConfigSupported: async () => false,
      mediaRecorderMime: "video/webm;codecs=vp9",
    });
    expect(realtime).toEqual({
      path: "media-recorder",
      mime: "video/webm;codecs=vp9",
    });

    const noEncoder = await probeClipEncoder(1080, {
      hasVideoEncoder: false,
      mediaRecorderMime: "video/mp4",
    });
    expect(noEncoder?.path).toBe("media-recorder");

    expect(
      await probeClipEncoder(1080, {
        hasVideoEncoder: false,
        mediaRecorderMime: null,
      }),
    ).toBeNull();
  });
});
