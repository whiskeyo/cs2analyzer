import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchYouTubeTitle,
  formatVideoStart,
  isYouTubeVideoId,
  parseYouTubeUrl,
  sameYouTubeVideo,
  youtubeEmbedUrl,
  youtubeThumbUrl,
  youtubeWatchUrl,
  YOUTUBE_UNTITLED,
} from "./youtube";

const VIDEO = "dQw4w9WgXcQ";

describe("parseYouTubeUrl", () => {
  it("accepts watch, short, embed, live, and youtu.be links", () => {
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO}`)).toEqual({ videoId: VIDEO });
    expect(parseYouTubeUrl(`https://youtube.com/watch?v=${VIDEO}&si=abc`)).toEqual({
      videoId: VIDEO,
    });
    expect(parseYouTubeUrl(`https://m.youtube.com/watch?v=${VIDEO}`)).toEqual({ videoId: VIDEO });
    expect(parseYouTubeUrl(`https://music.youtube.com/watch?v=${VIDEO}`)).toEqual({
      videoId: VIDEO,
    });
    expect(parseYouTubeUrl(`https://youtu.be/${VIDEO}`)).toEqual({ videoId: VIDEO });
    expect(parseYouTubeUrl(`www.youtu.be/${VIDEO}`)).toEqual({ videoId: VIDEO });
    expect(parseYouTubeUrl(`https://www.youtube.com/embed/${VIDEO}`)).toEqual({ videoId: VIDEO });
    expect(parseYouTubeUrl(`https://www.youtube-nocookie.com/embed/${VIDEO}`)).toEqual({
      videoId: VIDEO,
    });
    expect(parseYouTubeUrl(`https://www.youtube.com/shorts/${VIDEO}`)).toEqual({ videoId: VIDEO });
    expect(parseYouTubeUrl(`https://youtube.com/live/${VIDEO}`)).toEqual({ videoId: VIDEO });
    expect(parseYouTubeUrl(`https://youtube.com/v/${VIDEO}`)).toEqual({ videoId: VIDEO });
    expect(parseYouTubeUrl(`youtube.com/watch?v=${VIDEO}`)).toEqual({ videoId: VIDEO });
  });

  it("reads start time from t, start, and hash", () => {
    expect(parseYouTubeUrl(`https://youtu.be/${VIDEO}?t=90`)).toEqual({
      videoId: VIDEO,
      startSeconds: 90,
    });
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO}&t=1m30s`)).toEqual({
      videoId: VIDEO,
      startSeconds: 90,
    });
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO}&start=15`)).toEqual({
      videoId: VIDEO,
      startSeconds: 15,
    });
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO}#t=1h2m3s`)).toEqual({
      videoId: VIDEO,
      startSeconds: 3723,
    });
    expect(parseYouTubeUrl(`https://www.youtube.com/watch?v=${VIDEO}&t=0`)).toEqual({
      videoId: VIDEO,
    });
  });

  it("rejects non-YouTube hosts and junk ids", () => {
    expect(parseYouTubeUrl("")).toBeNull();
    expect(parseYouTubeUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeUrl("https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYouTubeUrl("https://www.youtube.com/playlist?list=PLxxxx")).toBeNull();
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(parseYouTubeUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("youtube urls", () => {
  it("builds watch, embed, and thumb urls", () => {
    expect(youtubeWatchUrl(VIDEO)).toBe(`https://www.youtube.com/watch?v=${VIDEO}`);
    expect(youtubeWatchUrl(VIDEO, 90)).toBe(`https://www.youtube.com/watch?v=${VIDEO}&t=90`);
    expect(youtubeEmbedUrl(VIDEO)).toBe(`https://www.youtube-nocookie.com/embed/${VIDEO}?rel=0`);
    expect(youtubeEmbedUrl(VIDEO, 12)).toBe(
      `https://www.youtube-nocookie.com/embed/${VIDEO}?rel=0&start=12`,
    );
    expect(youtubeThumbUrl(VIDEO)).toBe(`https://i.ytimg.com/vi/${VIDEO}/hqdefault.jpg`);
    expect(isYouTubeVideoId(VIDEO)).toBe(true);
    expect(isYouTubeVideoId("nope")).toBe(false);
    expect(sameYouTubeVideo({ videoId: VIDEO }, { videoId: VIDEO, startSeconds: 0 })).toBe(true);
    expect(sameYouTubeVideo({ videoId: VIDEO, startSeconds: 10 }, { videoId: VIDEO })).toBe(false);
    expect(formatVideoStart(5)).toBe("0:05");
    expect(formatVideoStart(90)).toBe("1:30");
    expect(formatVideoStart(3723)).toBe("1:02:03");
  });
});

describe("fetchYouTubeTitle", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a trimmed oEmbed title", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ title: "  Mirage A smoke  " }),
      }),
    );
    expect(await fetchYouTubeTitle(VIDEO)).toBe("Mirage A smoke");
  });

  it("returns null when oEmbed fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchYouTubeTitle(VIDEO)).toBeNull();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }));
    expect(await fetchYouTubeTitle(VIDEO)).toBeNull();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ title: "   " }) }),
    );
    expect(await fetchYouTubeTitle(VIDEO)).toBeNull();
    expect(YOUTUBE_UNTITLED).toBe("YouTube video");
  });
});
