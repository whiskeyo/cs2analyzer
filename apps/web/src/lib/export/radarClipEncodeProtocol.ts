/** Messages between the clip panel and the encode worker. */
export type ClipEncodeIn =
  | {
      type: "start";
      width: number;
      height: number;
      fps: number;
      codec: string;
      bitrate: number;
    }
  | { type: "frame"; bitmap: ImageBitmap; timestamp: number; index: number }
  | { type: "finish" }
  | { type: "cancel" };

export type ClipEncodeOut =
  | { type: "ready" }
  | { type: "encoded"; index: number }
  | { type: "done"; buffer: ArrayBuffer }
  | { type: "error"; message: string };

export interface ClipEncodeWorker {
  postMessage(message: ClipEncodeIn, transfer?: Transferable[]): void;
  terminate(): void;
  onmessage: ((event: MessageEvent<ClipEncodeOut>) => void) | null;
  onerror: AbstractWorker["onerror"];
}
