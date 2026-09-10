/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlaybookYouTube } from "@/lib/playbook/types";
import { YOUTUBE_UNTITLED } from "@/lib/playbook/youtube";
import { PlaybookVideos } from "./PlaybookVideos";

const VIDEO = "dQw4w9WgXcQ";

function clip(partial: Partial<PlaybookYouTube> = {}): PlaybookYouTube {
  return {
    id: "c1",
    videoId: VIDEO,
    url: `https://www.youtube.com/watch?v=${VIDEO}`,
    title: "Mirage A smoke",
    ...partial,
  };
}

describe("PlaybookVideos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds a valid link, opens the embed, and removes it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ title: "Mirage A smoke" }),
      }),
    );
    const onVideos = vi.fn();
    const { rerender } = render(<PlaybookVideos videos={[]} onVideos={onVideos} />);
    expect(screen.getByText(/Lineup or tutorial clips/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "YouTube link" }), {
      target: { value: `https://youtu.be/${VIDEO}?t=30` },
    });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onVideos).toHaveBeenCalled());
    const added = onVideos.mock.calls[0]?.[0] as PlaybookYouTube[];
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({
      videoId: VIDEO,
      title: "Mirage A smoke",
      startSeconds: 30,
    });

    rerender(<PlaybookVideos videos={added} onVideos={onVideos} />);
    expect(screen.getByRole("button", { name: /Mirage A smoke · 0:30/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Mirage A smoke · 0:30/ }));
    const dialog = screen.getByRole("dialog", { name: "Mirage A smoke" });
    const frame = dialog.querySelector("iframe");
    expect(frame?.getAttribute("src")).toContain(`youtube-nocookie.com/embed/${VIDEO}`);
    expect(frame?.getAttribute("src")).toContain("start=30");
    expect(frame?.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove Mirage A smoke" }));
    expect(onVideos).toHaveBeenLastCalledWith([]);
  });

  it("rejects junk and duplicate links, and falls back when oEmbed fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const onVideos = vi.fn();
    const { rerender } = render(<PlaybookVideos videos={[clip()]} onVideos={onVideos} />);
    fireEvent.change(screen.getByRole("textbox", { name: "YouTube link" }), {
      target: { value: "https://example.com/watch?v=dQw4w9WgXcQ" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText(/Paste a YouTube link/)).toBeInTheDocument();
    expect(onVideos).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox", { name: "YouTube link" }), {
      target: { value: `https://www.youtube.com/watch?v=${VIDEO}` },
    });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(screen.getByText(/already on this strat/)).toBeInTheDocument();

    rerender(<PlaybookVideos videos={[]} onVideos={onVideos} />);
    fireEvent.change(screen.getByRole("textbox", { name: "YouTube link" }), {
      target: { value: `https://www.youtube.com/shorts/${VIDEO}` },
    });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onVideos).toHaveBeenCalled());
    expect(onVideos.mock.calls.at(-1)?.[0][0]).toMatchObject({
      videoId: VIDEO,
      title: YOUTUBE_UNTITLED,
    });
  });
});
