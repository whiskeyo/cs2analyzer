/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SIDEBAR_DEFAULT_WIDTH } from "@/lib/shared/constants";
import { UserSettingsProvider, useUserSettings } from "./useUserSettings";
import { clearUserSettingsForTests, saveUserSettings } from "./userSettingsStore";
import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <UserSettingsProvider>{children}</UserSettingsProvider>;
}

describe("useUserSettings", () => {
  beforeEach(async () => {
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
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
      await result.current.update({ locale: "pl" });
    });
    expect(result.current.settings.locale).toBe("pl");

    await act(async () => {
      await result.current.reset();
    });
    expect(result.current.settings.sidebarWidth).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(result.current.settings.locale).toBe("en");
  });

  it("sets document lang from settings.locale", async () => {
    await saveUserSettings({ locale: "pl" });
    const { result } = renderHook(() => useUserSettings(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(document.documentElement.lang).toBe("pl");
  });
});
