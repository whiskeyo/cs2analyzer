/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_CATEGORY_IDS, STORAGE_CATEGORY_LABELS } from "@/lib/storage/usage";

const mocks = vi.hoisted(() => ({
  readOriginStorageEstimate: vi.fn(),
  measureCs2DatabaseUsage: vi.fn(),
  requestPersistentStorage: vi.fn(),
}));

vi.mock("@/lib/storage/usage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage/usage")>();
  return {
    ...actual,
    readOriginStorageEstimate: mocks.readOriginStorageEstimate,
    measureCs2DatabaseUsage: mocks.measureCs2DatabaseUsage,
    requestPersistentStorage: mocks.requestPersistentStorage,
  };
});

import { UserSettingsStorageSection } from "./StorageUsageSection";

const MIB = 1024 * 1024;

function dbUsage(bytes: Partial<Record<(typeof STORAGE_CATEGORY_IDS)[number], number>> = {}) {
  const values = {
    notes: 0.2 * MIB,
    playbooks: 0.5 * MIB,
    photos: 0.3 * MIB,
    settings: 0,
    other: 0,
    ...bytes,
  };
  return {
    totalBytes: STORAGE_CATEGORY_IDS.reduce((sum, id) => sum + values[id], 0),
    categories: STORAGE_CATEGORY_IDS.map((id) => ({
      id,
      label: STORAGE_CATEGORY_LABELS[id],
      bytes: values[id],
    })),
  };
}

describe("UserSettingsStorageSection", () => {
  beforeEach(() => {
    mocks.readOriginStorageEstimate.mockReset();
    mocks.measureCs2DatabaseUsage.mockReset();
    mocks.requestPersistentStorage.mockReset();
    mocks.readOriginStorageEstimate.mockResolvedValue({
      usageBytes: MIB,
      quotaBytes: 512 * MIB,
      persisted: false,
      persistSupported: true,
    });
    mocks.measureCs2DatabaseUsage.mockResolvedValue(dbUsage());
    mocks.requestPersistentStorage.mockResolvedValue(true);
  });

  it("shows used / quota, a per-store bar, and no max-size slider", async () => {
    render(<UserSettingsStorageSection />);
    expect(await screen.findByText("Local database usage: 1.0 / 512 MB")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Local database" })).toBeInTheDocument();
    expect(screen.getByText(/pages cannot raise it/)).toBeInTheDocument();
    expect(
      screen.getByText(/Export notes and playbooks from the Settings menu/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Analyzer notes: 0.2 MB/)).toBeInTheDocument();
    expect(screen.getByText(/Playbooks: 0.5 MB/)).toBeInTheDocument();
    expect(screen.getByText(/Photos: 0.3 MB/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Analyzer notes 0.2 MB/ })).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep data in this browser" })).toBeInTheDocument();
  });

  it("asks the browser to persist data and hides the control after a grant", async () => {
    render(<UserSettingsStorageSection />);
    const keep = await screen.findByRole("button", { name: "Keep data in this browser" });
    await userEvent.click(keep);
    await waitFor(() =>
      expect(
        screen.getByText("This browser marked this site’s saved data as persistent."),
      ).toBeInTheDocument(),
    );
    expect(mocks.requestPersistentStorage).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole("button", { name: "Keep data in this browser" }),
    ).not.toBeInTheDocument();
  });

  it("uses the IndexedDB walk when estimate() has no usage", async () => {
    mocks.readOriginStorageEstimate.mockResolvedValue({
      usageBytes: null,
      quotaBytes: null,
      persisted: null,
      persistSupported: false,
    });
    render(<UserSettingsStorageSection />);
    expect(await screen.findByText("Local database usage: 1.0 MB")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Keep data in this browser" }),
    ).not.toBeInTheDocument();
  });

  it("says the browser declined persist without faking a quota slider", async () => {
    mocks.requestPersistentStorage.mockResolvedValue(false);
    render(<UserSettingsStorageSection />);
    await userEvent.click(await screen.findByRole("button", { name: "Keep data in this browser" }));
    expect(
      await screen.findByText("The browser declined. Quota is still managed by the browser."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep data in this browser" })).toBeInTheDocument();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });
});
