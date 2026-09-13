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
    x: 10,
    y: 20,
    ...partial,
  };
}

describe("PlaybookVideos", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens a paste dialog on pin drop, lists a thumbnail, and deletes from the player", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ title: "Mirage A smoke" }),
      }),
    );
    const onVideos = vi.fn();
    const onOpen = vi.fn();
    const onCancelPin = vi.fn();
    const { rerender } = render(
      <PlaybookVideos
        videos={[]}
        onVideos={onVideos}
        openId={null}
        onOpen={onOpen}
        pendingPin={{ x: 40, y: 50 }}
        onCancelPin={onCancelPin}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Add YouTube clip" })).toBeInTheDocument();
    expect(screen.getByText(/Paste a youtube.com or youtu.be link/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox", { name: "YouTube link" }), {
      target: { value: `https://youtu.be/${VIDEO}?t=30` },
    });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onVideos).toHaveBeenCalled());
    const added = onVideos.mock.calls[0]?.[0] as PlaybookYouTube[];
    expect(added[0]).toMatchObject({
      videoId: VIDEO,
      title: "Mirage A smoke",
      startSeconds: 30,
      x: 40,
      y: 50,
    });
    expect(onOpen).toHaveBeenCalledWith(added[0]?.id);

    rerender(
      <PlaybookVideos
        videos={added}
        onVideos={onVideos}
        openId={added[0]!.id}
        onOpen={onOpen}
        pendingPin={null}
        onCancelPin={onCancelPin}
      />,
    );
    const row = screen.getByRole("button", { name: /Mirage A smoke · 0:30/ });
    expect(row.querySelector("img")?.getAttribute("src")).toContain(`/vi/${VIDEO}/hqdefault.jpg`);
    expect(screen.getByRole("button", { name: "Remove Mirage A smoke" })).toHaveTextContent("×");
    const dialog = screen.getByRole("dialog", { name: "Mirage A smoke" });
    expect(dialog.querySelector("iframe")?.getAttribute("src")).toContain(
      `youtube-nocookie.com/embed/${VIDEO}`,
    );
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onVideos).toHaveBeenLastCalledWith([]);
    expect(onOpen).toHaveBeenLastCalledWith(null);
  });

  it("deletes from the list row X without opening the player", async () => {
    const onVideos = vi.fn();
    const onOpen = vi.fn();
    render(
      <PlaybookVideos
        videos={[clip()]}
        onVideos={onVideos}
        openId={null}
        onOpen={onOpen}
        pendingPin={null}
        onCancelPin={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Remove Mirage A smoke" }));
    expect(onVideos).toHaveBeenCalledWith([]);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("cancels a pending pin from the paste dialog", async () => {
    const onCancelPin = vi.fn();
    render(
      <PlaybookVideos
        videos={[]}
        onVideos={vi.fn()}
        openId={null}
        onOpen={vi.fn()}
        pendingPin={{ x: 1, y: 2 }}
        onCancelPin={onCancelPin}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancelPin).toHaveBeenCalled();
  });

  it("has no idle YouTube add form", () => {
    render(
      <PlaybookVideos
        videos={[]}
        onVideos={vi.fn()}
        openId={null}
        onOpen={vi.fn()}
        pendingPin={null}
        onCancelPin={vi.fn()}
      />,
    );
    expect(screen.queryByRole("textbox", { name: "YouTube link" })).not.toBeInTheDocument();
    expect(screen.getByText(/Place a YouTube pin/)).toBeInTheDocument();
  });

  it("rejects junk and duplicate links, and falls back when oEmbed fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const onVideos = vi.fn();
    const onOpen = vi.fn();
    const onCancelPin = vi.fn();
    const { rerender } = render(
      <PlaybookVideos
        videos={[clip()]}
        onVideos={onVideos}
        openId={null}
        onOpen={onOpen}
        pendingPin={{ x: 1, y: 2 }}
        onCancelPin={onCancelPin}
      />,
    );
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

    rerender(
      <PlaybookVideos
        videos={[]}
        onVideos={onVideos}
        openId={null}
        onOpen={onOpen}
        pendingPin={{ x: 1, y: 2 }}
        onCancelPin={onCancelPin}
      />,
    );
    fireEvent.change(screen.getByRole("textbox", { name: "YouTube link" }), {
      target: { value: `https://www.youtube.com/shorts/${VIDEO}` },
    });
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() => expect(onVideos).toHaveBeenCalled());
    expect(onVideos.mock.calls.at(-1)?.[0][0]).toMatchObject({
      videoId: VIDEO,
      title: YOUTUBE_UNTITLED,
      x: 1,
      y: 2,
    });
  });
});
