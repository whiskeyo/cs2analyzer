/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_SAVE_DEBOUNCE_MS } from "@/lib/shared/constants";
import { deleteAllPlaybooks, loadPlaybook } from "./playbookStore";
import { UNTITLED_PLAYBOOK } from "./types";
import { usePlaybooks } from "./usePlaybooks";

describe("usePlaybooks", () => {
  beforeEach(async () => {
    await deleteAllPlaybooks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(async () => {
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
});
