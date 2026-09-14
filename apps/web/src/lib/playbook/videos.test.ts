import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaybookYouTube } from "./types";
import {
  hitTestVideo,
  moveVideo,
  nextVideoPin,
  openPlaybookVideoWatch,
  playbookVideoPinIndex,
  playbookVideoWatchUrl,
  removeVideo,
  renameVideo,
  reorderVideos,
  YOUTUBE_PIN_STACK,
} from "./videos";

function clip(partial: Partial<PlaybookYouTube> = {}): PlaybookYouTube {
  return {
    id: "v1",
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "A smoke",
    x: 0,
    y: 0,
    ...partial,
  };
}

const identity = (x: number, y: number) => ({ x, y });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("video pins", () => {
  it("hits the topmost pin and moves / removes by id", () => {
    const pins = [clip({ id: "a", x: 0, y: 0 }), clip({ id: "b", x: 0, y: 0 })];
    expect(hitTestVideo(pins, { x: 0, y: 0 }, identity)?.id).toBe("b");
    expect(hitTestVideo(pins, { x: 100, y: 100 }, identity)).toBeNull();
    expect(moveVideo(pins, "a", 8, 9)[0]).toMatchObject({
      id: "a",
      x: 8,
      y: 9,
    });
    expect(removeVideo(pins, "b").map((row) => row.id)).toEqual(["a"]);
    expect(removeVideo(pins, "missing")).toEqual(pins);
  });

  it("numbers pins only when a floor has more than one clip", () => {
    const one = [clip({ id: "a" })];
    expect(playbookVideoPinIndex(one, "a")).toBeNull();
    const two = [clip({ id: "a" }), clip({ id: "b", x: 8 })];
    expect(playbookVideoPinIndex(two, "a")).toBe(1);
    expect(playbookVideoPinIndex(two, "b")).toBe(2);
    expect(playbookVideoPinIndex(two, "missing")).toBeNull();
  });

  it("prefers the stored watch URL and rebuilds from video id", () => {
    expect(
      playbookVideoWatchUrl(clip({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30" })),
    ).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30");
    expect(playbookVideoWatchUrl(clip({ url: "  ", videoId: "", startSeconds: 12 }))).toBeNull();
    expect(playbookVideoWatchUrl(clip({ url: "", startSeconds: 30 }))).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30",
    );
  });

  it("opens the watch URL in a new tab", () => {
    const open = vi.fn();
    vi.stubGlobal("open", open);
    openPlaybookVideoWatch(clip({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12" }));
    expect(open).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=12",
      "_blank",
      "noopener,noreferrer",
    );
    openPlaybookVideoWatch(clip({ url: "  ", videoId: "" }));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it("stacks a new pin after the last one", () => {
    expect(nextVideoPin([])).toEqual({ x: 0, y: 0 });
    expect(nextVideoPin([], { x: 10, y: 20 })).toEqual({ x: 10, y: 20 });
    expect(nextVideoPin([clip({ x: 5, y: 7 })])).toEqual({
      x: 5 + YOUTUBE_PIN_STACK,
      y: 7,
    });
  });

  it("renames a clip and ignores a blank title", () => {
    const pins = [clip({ id: "a", title: "A smoke" }), clip({ id: "b", title: "B flash" })];
    expect(renameVideo(pins, "a", "  Mid smoke  ")[0]?.title).toBe("Mid smoke");
    expect(renameVideo(pins, "a", "   ")).toBe(pins);
    expect(renameVideo(pins, "missing", "X")).toBe(pins);
  });

  it("reorders clips like strat pages", () => {
    const pins = [clip({ id: "a" }), clip({ id: "b" }), clip({ id: "c" })];
    expect(reorderVideos(pins, 2, 0).map((row) => row.id)).toEqual(["c", "a", "b"]);
    expect(reorderVideos(pins, 0, 0)).toBe(pins);
    expect(reorderVideos(pins, -1, 0)).toBe(pins);
    expect(reorderVideos(pins, 0, 9)).toBe(pins);
  });
});
