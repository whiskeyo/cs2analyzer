/** Worker URL lives here so the clip panel can lazy-load the muxer. */
export function createRadarClipEncodeWorker(): Worker {
  return new Worker(new URL("./radarClipEncode.worker.ts", import.meta.url), {
    type: "module",
  });
}
