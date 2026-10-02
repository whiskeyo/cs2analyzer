import {
  CLIP_EXPORT_FPS,
  CLIP_H264_CODECS,
  CLIP_EXPORT_SIZE_DEFAULT,
} from "@/lib/export/constants";
import {
  clipExportBitrate,
  selectClipEncodePath,
  type ClipEncodePath,
} from "@/lib/export/clipPlan";
import { mediaRecorderSupports, preferredClipMime } from "@/lib/export/radarClip";

export interface WebCodecsClipEncoder {
  path: "webcodecs";
  codec: string;
  bitrate: number;
  width: number;
  height: number;
  fps: number;
}

export interface MediaRecorderClipEncoder {
  path: "media-recorder";
  mime: string;
}

export type ClipEncoderChoice = WebCodecsClipEncoder | MediaRecorderClipEncoder;

/** Configs tried, in order, against `VideoEncoder.isConfigSupported`. */
export function h264EncoderCandidates(
  width: number,
  height: number,
  fps: number,
  bitrate: number,
): VideoEncoderConfig[] {
  return CLIP_H264_CODECS.map((codec) => ({
    codec,
    width,
    height,
    bitrate,
    framerate: fps,
    latencyMode: "quality",
    avc: { format: "avc" },
  }));
}

export async function firstSupportedH264Config(
  candidates: readonly VideoEncoderConfig[],
  isConfigSupported: (config: VideoEncoderConfig) => Promise<boolean>,
): Promise<VideoEncoderConfig | null> {
  for (const config of candidates) {
    try {
      if (await isConfigSupported(config)) return config;
    } catch {
      // A thrown probe should not hide a later profile.
    }
  }
  return null;
}

export interface ClipEncoderProbeDeps {
  hasVideoEncoder?: boolean;
  isConfigSupported?: (config: VideoEncoderConfig) => Promise<boolean>;
  mediaRecorderMime?: string | null;
}

/**
 * Runtime choice for this size and frame rate. H.264 must pass
 * `isConfigSupported` for the offline path; otherwise MediaRecorder.
 */
export async function probeClipEncoder(
  size = CLIP_EXPORT_SIZE_DEFAULT,
  deps: ClipEncoderProbeDeps = {},
): Promise<ClipEncoderChoice | null> {
  const hasVideoEncoder =
    deps.hasVideoEncoder ??
    (typeof VideoEncoder !== "undefined" && typeof VideoEncoder.isConfigSupported === "function");
  const bitrate = clipExportBitrate(size);
  const fps = CLIP_EXPORT_FPS;
  let h264 = false;
  let codec: string | null = null;
  if (hasVideoEncoder) {
    const supported = await firstSupportedH264Config(
      h264EncoderCandidates(size, size, fps, bitrate),
      deps.isConfigSupported ??
        (async (config) => {
          const result = await VideoEncoder.isConfigSupported(config);
          return result.supported === true;
        }),
    );
    h264 = supported != null;
    codec = supported?.codec ?? null;
  }
  const mime =
    deps.mediaRecorderMime !== undefined
      ? deps.mediaRecorderMime
      : preferredClipMime(mediaRecorderSupports);
  const path: ClipEncodePath | null = selectClipEncodePath({
    videoEncoder: hasVideoEncoder,
    h264,
    mediaRecorderMime: mime,
  });
  if (path === "webcodecs" && codec) {
    return { path, codec, bitrate, width: size, height: size, fps };
  }
  if (path === "media-recorder" && mime) return { path, mime };
  return null;
}
