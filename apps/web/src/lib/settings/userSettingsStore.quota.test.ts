/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IDB_QUOTA_MESSAGE } from "@/lib/storage/quota";

const mocks = vi.hoisted(() => ({
  idbAvailable: vi.fn(() => true),
  hasStore: vi.fn(() => true),
  requestOf: vi.fn(),
  openCs2Db: vi.fn(),
}));

vi.mock("@/lib/storage/idb", () => ({
  SETTINGS_STORE: "settings",
  idbAvailable: () => mocks.idbAvailable(),
  hasStore: () => mocks.hasStore(),
  requestOf: (...args: unknown[]) => mocks.requestOf(...args),
  openCs2Db: () => mocks.openCs2Db(),
}));

import { clearUserSettingsForTests, loadUserSettings, saveUserSettings } from "./userSettingsStore";

function quotaError() {
  const err = new Error("full");
  err.name = "QuotaExceededError";
  return err;
}

function fakeDb() {
  return {
    close: () => undefined,
    transaction: () => ({
      objectStore: () => ({
        get: () => ({}),
        put: () => ({}),
        delete: () => ({}),
      }),
    }),
  };
}

describe("userSettingsStore quota", () => {
  beforeEach(() => {
    mocks.idbAvailable.mockReturnValue(true);
    mocks.hasStore.mockReturnValue(true);
    mocks.openCs2Db.mockResolvedValue(fakeDb());
    mocks.requestOf.mockReset();
    mocks.requestOf.mockResolvedValue(undefined);
  });

  afterEach(async () => {
    mocks.requestOf.mockResolvedValue(undefined);
    await clearUserSettingsForTests();
  });

  it("rethrows quota copy and keeps the patch in memory", async () => {
    mocks.requestOf.mockResolvedValueOnce(undefined).mockRejectedValueOnce(quotaError());
    await expect(saveUserSettings({ sidebarWidth: 520 })).rejects.toThrow(IDB_QUOTA_MESSAGE);
    expect((await loadUserSettings()).sidebarWidth).toBe(520);
  });
});
