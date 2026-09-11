/**
 * @vitest-environment jsdom
 */
import "fake-indexeddb/auto";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserSettingsProvider } from "@/lib/settings/useUserSettings";
import { clearUserSettingsForTests, saveUserSettings } from "@/lib/settings/userSettingsStore";
import { en } from "./en";
import { pl } from "./pl";
import { useMessages } from "./useMessages";

function wrapper({ children }: { children: ReactNode }) {
  return <UserSettingsProvider>{children}</UserSettingsProvider>;
}

describe("useMessages", () => {
  beforeEach(async () => {
    await clearUserSettingsForTests();
  });

  afterEach(async () => {
    await clearUserSettingsForTests();
  });

  it("defaults to English and switches catalog when locale is pl", async () => {
    const { result } = renderHook(() => useMessages(), { wrapper });
    await waitFor(() => expect(result.current.locale).toBe("en"));
    expect(result.current.messages).toBe(en);
    expect(result.current.t(result.current.messages.header.exportCsv)).toBe("Export CSV");

    await saveUserSettings({ locale: "pl" });
    const polish = renderHook(() => useMessages(), { wrapper });
    await waitFor(() => expect(polish.result.current.locale).toBe("pl"));
    expect(polish.result.current.messages).toBe(pl);
    expect(polish.result.current.messages.header.exportCsv).toBe("Eksportuj CSV");
  });

  it("falls back to English without a settings provider", () => {
    const { result } = renderHook(() => useMessages());
    expect(result.current.locale).toBe("en");
    expect(result.current.messages.nav.faq).toBe(en.nav.faq);
  });

  it("falls unknown stored locale back to English", async () => {
    await saveUserSettings({ locale: "de" as "en" });
    const { result } = renderHook(() => useMessages(), { wrapper });
    await waitFor(() => expect(result.current.locale).toBe("en"));
    expect(result.current.messages).toBe(en);
  });
});
