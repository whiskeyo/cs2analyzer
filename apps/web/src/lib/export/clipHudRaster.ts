import { CLIP_HUD_PROBE_PX } from "@/lib/export/constants";

/** `VideoFrame` is missing on the MediaRecorder path. A throw means the canvas is unusable. */
export type ClipHudVideoFrameProbe = "ok" | "absent" | "failed";

export interface ClipHudProbe {
  tainted: boolean;
  /** `canvas.toBlob` returned a non-empty PNG. */
  toBlob: boolean;
  videoFrame: ClipHudVideoFrameProbe;
  /** A transparent foreignObject pixel stayed transparent after `drawImage`. */
  alphaPreserved: boolean;
  threw: boolean;
}

/** Page components, or the hand-painted `clipHud.ts` fallback. */
export type ClipHudRenderer = "page" | "painted";

const PROBE_MARK = "#e0c15a";

/**
 * Pick the clip HUD. WebKit taints a canvas after drawing an SVG
 * `foreignObject`, and then `toBlob` / `VideoFrame` fail. Any failed check
 * keeps the painted HUD so export still finishes.
 */
export function selectClipHudRenderer(probe: ClipHudProbe): ClipHudRenderer {
  if (probe.threw || probe.tainted || !probe.toBlob || !probe.alphaPreserved) {
    return "painted";
  }
  if (probe.videoFrame === "failed") {
    return "painted";
  }
  return "page";
}

/** SVG the probe draws. The top-left is opaque; the opposite corner is transparent. */
export function clipHudProbeSvg(size = CLIP_HUD_PROBE_PX): string {
  const mark = Math.floor(size / 2);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
<foreignObject x="0" y="0" width="${size}" height="${size}">
<div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;width:${size}px;height:${size}px;background:transparent;">
<div style="width:${mark}px;height:${mark}px;background:${PROBE_MARK};"></div>
</div>
</foreignObject>
</svg>`;
}

function failedProbe(): ClipHudProbe {
  return {
    tainted: false,
    toBlob: false,
    videoFrame: "absent",
    alphaPreserved: false,
    threw: true,
  };
}

/**
 * Same-origin data URL. A blob URL taints the canvas in current Chromium and
 * WebKit, so `toBlob` and `VideoFrame` then fail. A data URL of the same SVG
 * does not.
 */
export function clipHudProbeImageUrl(size = CLIP_HUD_PROBE_PX): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(clipHudProbeSvg(size))}`;
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("foreignObject image failed"));
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

async function canvasExportedPng(canvas: HTMLCanvasElement): Promise<boolean> {
  if (typeof canvas.toBlob !== "function") return false;
  const blob = await new Promise<Blob | null>((resolve) => {
    try {
      canvas.toBlob((next) => resolve(next), "image/png");
    } catch {
      resolve(null);
    }
  });
  return blob != null && blob.size > 0;
}

function videoFrameFrom(canvas: HTMLCanvasElement): ClipHudVideoFrameProbe {
  if (typeof VideoFrame === "undefined") return "absent";
  try {
    const frame = new VideoFrame(canvas, { timestamp: 0 });
    frame.close();
    return "ok";
  } catch {
    return "failed";
  }
}

/**
 * Draw a foreignObject image and see whether the canvas can still be encoded.
 * Never throws: a broken probe selects the painted HUD.
 */
export async function probeClipHudForeignObject(): Promise<ClipHudProbe> {
  if (typeof document === "undefined") return failedProbe();
  try {
    const size = CLIP_HUD_PROBE_PX;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return failedProbe();
    const image = await loadSvgImage(clipHudProbeSvg(size));
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(image, 0, 0, size, size);

    let tainted = false;
    let alphaPreserved = false;
    try {
      const corner = ctx.getImageData(size - 1, size - 1, 1, 1).data;
      const mark = ctx.getImageData(1, 1, 1, 1).data;
      alphaPreserved = corner[3] === 0 && mark[3] > 0;
    } catch {
      tainted = true;
    }

    let toBlob = false;
    try {
      toBlob = await canvasExportedPng(canvas);
    } catch {
      toBlob = false;
      tainted = true;
    }

    const videoFrame = videoFrameFrom(canvas);
    return { tainted, toBlob, videoFrame, alphaPreserved, threw: false };
  } catch {
    return failedProbe();
  }
}

let rendererPromise: Promise<ClipHudRenderer> | null = null;

/** One probe per page. A throw inside the probe still resolves to the painted HUD. */
export function clipHudRenderer(): Promise<ClipHudRenderer> {
  if (!rendererPromise) {
    rendererPromise = probeClipHudForeignObject()
      .then(selectClipHudRenderer)
      .catch(() => "painted" as const);
  }
  return rendererPromise;
}

export function resetClipHudRendererCache(): void {
  rendererPromise = null;
}
