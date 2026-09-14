/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIDEBAR_DEFAULT_WIDTH } from "@/lib/shared/constants";
import { IDB_QUOTA_MESSAGE } from "@/lib/storage/quota";
import { UserSettingsProvider, useUserSettings } from "./useUserSettings";
import { clearUserSettingsForTests, saveUserSettings } from "./userSettingsStore";
import * as store from "./userSettingsStore";
import { defaultUserSettings, parseUserSettings } from "./userSettings";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <UserSettingsProvider>{children}</UserSettingsProvider>;
}

describe("useUserSettings", () => {
  beforeEach(async () => {
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearUserSettingsForTests();
  });

  it("hydrates persisted settings after load", async () => {
    await saveUserSettings({ sidebarWidth: 520, eventLeadInSec: 3 });
    const { result } = renderHook(() => useUserSettings(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.settings.sidebarWidth).toBe(520);
    expect(result.current.settings.eventLeadInSec).toBe(3);
  });

  it("update patches and reset restores shipped defaults", async () => {
    const { result } = renderHook(() => useUserSettings(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.update({ sidebarWidth: 560 });
    });
    expect(result.current.settings.sidebarWidth).toBe(560);

    await act(async () => {
      await result.current.reset();
    });
    expect(result.current.settings.sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it("keeps the patch and sets saveError when IndexedDB is full", async () => {
    const quota = new Error("full");
    quota.name = "QuotaExceededError";
    vi.spyOn(store, "saveUserSettings").mockRejectedValue(quota);
    vi.spyOn(store, "loadUserSettings").mockResolvedValue(
      parseUserSettings({ ...defaultUserSettings(), sidebarWidth: 560 }),
    );
    const { result } = renderHook(() => useUserSettings(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));

    await act(async () => {
      await result.current.update({ sidebarWidth: 560 });
    });
    expect(result.current.saveError).toBe(IDB_QUOTA_MESSAGE);
    expect(result.current.settings.sidebarWidth).toBe(560);
  });
});
