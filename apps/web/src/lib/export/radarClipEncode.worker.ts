import { CLIP_EXPORT_FAILED } from "@/lib/export/constants";
import type { ClipEncodeIn, ClipEncodeOut } from "@/lib/export/radarClipEncodeProtocol";
import { openClipEncodeSession, type ClipEncodeSession } from "@/lib/export/radarClipEncodeSession";

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ClipEncodeIn>) => void) | null;
  postMessage(message: ClipEncodeOut, transfer?: Transferable[]): void;
};

let session: ClipEncodeSession | null = null;
let stopped = false;

function fail(message: string): void {
  session?.close();
  session = null;
  if (stopped) return;
  stopped = true;
  scope.postMessage({ type: "error", message });
}

scope.onmessage = (event: MessageEvent<ClipEncodeIn>) => {
  const message = event.data;
  if (message.type === "cancel") {
    stopped = true;
    session?.close();
    session = null;
    return;
  }
  if (stopped) {
    if (message.type === "frame") message.bitmap.close();
    return;
  }
  if (message.type === "start") {
    try {
      session = openClipEncodeSession({
        width: message.width,
        height: message.height,
        fps: message.fps,
        codec: message.codec,
        bitrate: message.bitrate,
        onError: fail,
      });
      scope.postMessage({ type: "ready" });
    } catch (error) {
      fail(error instanceof Error && error.message ? error.message : CLIP_EXPORT_FAILED);
    }
    return;
  }
  if (message.type === "frame") {
    const current = session;
    if (!current) {
      message.bitmap.close();
      fail(CLIP_EXPORT_FAILED);
      return;
    }
    try {
      current.encode(message.bitmap, message.timestamp, message.index, () => {
        if (!stopped) scope.postMessage({ type: "encoded", index: message.index });
      });
    } catch (error) {
      fail(error instanceof Error && error.message ? error.message : CLIP_EXPORT_FAILED);
    }
    return;
  }
  const current = session;
  if (!current) {
    fail(CLIP_EXPORT_FAILED);
    return;
  }
  void current.finish().then(
    (buffer) => {
      if (stopped) return;
      stopped = true;
      session = null;
      scope.postMessage({ type: "done", buffer }, [buffer]);
    },
    (error: unknown) => {
      fail(error instanceof Error && error.message ? error.message : CLIP_EXPORT_FAILED);
    },
  );
};
