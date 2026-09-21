/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_SAVE_DEBOUNCE_MS } from "@/lib/shared/constants";
import { addPiece, makePiece } from "./pieces";
import { deleteAllPlaybooks, loadPlaybook } from "./playbookStore";
import * as playbookStore from "./playbookStore";
import { emptyTutorialPlaybook } from "@/lib/tutorial/playbook/live";
import { COPY_SUFFIX, UNTITLED_PLAYBOOK } from "./types";
import { usePlaybooks } from "./usePlaybooks";
import { IDB_QUOTA_MESSAGE } from "@/lib/storage/quota";

describe("usePlaybooks", () => {
  beforeEach(async () => {
    await deleteAllPlaybooks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    await deleteAllPlaybooks();
  });

  it("creates, selects, and renames a book on a map", async () => {
    const { result, rerender } = renderHook(
      ({ map }: { map: string | null }) => usePlaybooks(map),
      {
        initialProps: { map: "de_mirage" as string | null },
      },
    );

    await act(async () => {
      await result.current.create("  ");
    });
    expect(result.current.book?.title).toBe(UNTITLED_PLAYBOOK);
    expect(result.current.books).toHaveLength(1);

    await act(async () => {
      result.current.rename("A execs");
    });
    act(() => {
      vi.advanceTimersByTime(PROJECT_SAVE_DEBOUNCE_MS);
    });
    await waitFor(async () => {
      const saved = await loadPlaybook(result.current.book?.key ?? "");
      expect(saved?.title).toBe("A execs");
    });

    const key = result.current.activeKey;
    await act(async () => {
      result.current.select(null);
    });
    expect(result.current.book).toBeNull();
    await act(async () => {
      result.current.select(key);
    });
    await waitFor(() => expect(result.current.book?.title).toBe("A execs"));

    rerender({ map: "de_inferno" });
    await waitFor(() => expect(result.current.books).toEqual([]));
    expect(result.current.book).toBeNull();

    rerender({ map: null });
    await waitFor(() => expect(result.current.books).toEqual([]));
    await act(async () => {
      await result.current.create("nope");
    });
    expect(result.current.book).toBeNull();
  });

  it("adds, switches, duplicates, and deletes named strats", async () => {
    const { result } = renderHook(() => usePlaybooks("de_mirage"));
    await act(async () => {
      await result.current.create("Defaults");
    });
    const firstId = result.current.book?.pages[0]?.id ?? "";
    await act(async () => {
      result.current.addStrat();
    });
    expect(result.current.book?.pages).toHaveLength(2);
    const secondId = result.current.book?.activePageId ?? "";
    expect(secondId).not.toBe(firstId);

    await act(async () => {
      result.current.renameStrat(secondId, "A exec");
      result.current.selectStrat(firstId);
    });
    expect(result.current.book?.activePageId).toBe(firstId);
    expect(result.current.book?.pages[1]?.title).toBe("A exec");

    await act(async () => {
      result.current.duplicateStrat(secondId);
    });
    expect(result.current.book?.pages).toHaveLength(3);
    expect(result.current.book?.pages[2]?.title).toBe(`A exec${COPY_SUFFIX}`);

    await act(async () => {
      result.current.removeStrat(result.current.book?.activePageId ?? "");
    });
    expect(result.current.book?.pages).toHaveLength(2);

    const only = result.current.book?.pages[0]?.id ?? "";
    await act(async () => {
      result.current.removeStrat(result.current.book?.pages[1]?.id ?? "");
    });
    await act(async () => {
      result.current.removeStrat(only);
    });
    expect(result.current.book?.pages).toHaveLength(1);
  });

  it("writes YouTube clips onto the active strat", async () => {
    const { result } = renderHook(() => usePlaybooks("de_mirage"));
    await act(async () => {
      await result.current.create("Defaults");
    });
    const pageId = result.current.book?.pages[0]?.id ?? "";
    const videos = [
      {
        id: "v1",
        videoId: "dQw4w9WgXcQ",
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        title: "A smoke",
        x: 1,
        y: 2,
      },
    ];
    await act(async () => {
      result.current.setVideos(pageId, videos);
    });
    expect(result.current.book?.pages[0]?.videos).toEqual(videos);
    act(() => {
      vi.advanceTimersByTime(PROJECT_SAVE_DEBOUNCE_MS);
    });
    await waitFor(async () => {
      const saved = await loadPlaybook(result.current.book?.key ?? "");
      expect(saved?.pages[0]?.videos).toEqual(videos);
    });
  });

  it("writes local images onto the active strat", async () => {
    const { result } = renderHook(() => usePlaybooks("de_mirage"));
    await act(async () => {
      await result.current.create("Defaults");
    });
    const pageId = result.current.book?.pages[0]?.id ?? "";
    const images = [
      {
        id: "i1",
        name: "lineup.png",
        mime: "image/png" as const,
        x: 1,
        y: 2,
      },
    ];
    await act(async () => {
      result.current.setImages(pageId, images);
    });
    expect(result.current.book?.pages[0]?.images).toEqual(images);
    act(() => {
      vi.advanceTimersByTime(PROJECT_SAVE_DEBOUNCE_MS);
    });
    await waitFor(async () => {
      const saved = await loadPlaybook(result.current.book?.key ?? "");
      expect(saved?.pages[0]?.images).toEqual(images);
    });
  });

  it("writes the active strat floor", async () => {
    const { result } = renderHook(() => usePlaybooks("de_nuke"));
    await act(async () => {
      await result.current.create("Defaults");
    });
    const pageId = result.current.book?.pages[0]?.id ?? "";
    expect(result.current.book?.pages[0]?.floor).toBe("auto");
    await act(async () => {
      result.current.setFloor(pageId, "lower");
    });
    expect(result.current.book?.pages[0]?.floor).toBe("lower");
  });

  it("writes tokens onto the active strat note", async () => {
    const { result } = renderHook(() => usePlaybooks("de_mirage"));
    await act(async () => {
      await result.current.create("Defaults");
    });
    const note = result.current.book?.pages[0]?.note;
    expect(note).toBeDefined();
    await act(async () => {
      result.current.setNote(addPiece(note!, makePiece("bomb", 1, 2, { id: "c4" })));
    });
    expect(result.current.book?.pages[0]?.note.pieces).toEqual([
      expect.objectContaining({ id: "c4", kind: "bomb", x: 1, y: 2 }),
    ]);
  });

  it("reloads the open book from storage", async () => {
    const { result } = renderHook(() => usePlaybooks("de_mirage"));
    await act(async () => {
      await result.current.create("Defaults");
    });
    const key = result.current.book?.key ?? "";
    await act(async () => {
      result.current.rename("Stale");
    });
    const saved = await loadPlaybook(key);
    expect(saved).toBeDefined();
    await act(async () => {
      await result.current.reload();
    });
    await waitFor(() => expect(result.current.books.some((row) => row.key === key)).toBe(true));
  });

  it("keeps a sandbox book in memory without touching IndexedDB", async () => {
    const real = await playbookStore.createPlaybook("de_mirage", "My real book");
    const sample = emptyTutorialPlaybook("de_dust2");
    const saveSpy = vi.spyOn(playbookStore, "savePlaybook");
    const loadAllSpy = vi.spyOn(playbookStore, "loadAllPlaybooks");
    const { result } = renderHook(() =>
      usePlaybooks("de_dust2", { mode: "sandbox", books: [sample] }),
    );
    await waitFor(() => expect(result.current.book?.title).toBe("Tutorial"));
    expect(result.current.books).toHaveLength(1);
    expect(result.current.books[0]?.key).toBe(sample.key);

    await act(async () => {
      result.current.rename("Tour notes");
      await result.current.create("Should not persist");
      await result.current.duplicateBook(sample.key);
    });
    act(() => {
      vi.advanceTimersByTime(PROJECT_SAVE_DEBOUNCE_MS);
    });
    expect(result.current.book?.title).toBe("Tour notes");
    expect(saveSpy).not.toHaveBeenCalled();
    expect(loadAllSpy).not.toHaveBeenCalled();
    expect(await loadPlaybook(real.key)).toMatchObject({
      title: "My real book",
    });
    expect(await loadPlaybook(sample.key)).toBeNull();
  });

  it("surfaces quota when a draft cannot persist", async () => {
    const { result } = renderHook(() => usePlaybooks("de_mirage"));
    await act(async () => {
      await result.current.create("Defaults");
    });
    const quota = new Error("full");
    quota.name = "QuotaExceededError";
    vi.spyOn(playbookStore, "savePlaybook").mockRejectedValue(quota);
    await act(async () => {
      result.current.rename("A execs");
    });
    await act(async () => {
      vi.advanceTimersByTime(PROJECT_SAVE_DEBOUNCE_MS);
    });
    await waitFor(() => expect(result.current.saveError).toBe(IDB_QUOTA_MESSAGE));
  });
});
