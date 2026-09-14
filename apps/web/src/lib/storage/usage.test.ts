import { describe, expect, it } from "vitest";
import {
  categoryBarPercents,
  categoryForStore,
  emptyCs2DatabaseUsage,
  formatLocalDatabaseUsageLabel,
  formatMegabytes,
  formatUsageMegabytes,
  playbookImageFallbackId,
  readOriginStorageEstimate,
  requestPersistentStorage,
  STORAGE_CATEGORY_IDS,
  valueByteSize,
  type StorageManagerLike,
} from "./usage";
import {
  HANDLE_STORE,
  PLAYBOOK_IMAGE_STORE,
  PLAYBOOK_STORE,
  PROJECT_STORE,
  SETTINGS_STORE,
} from "./idb";

describe("valueByteSize", () => {
  it("counts primitives, blobs, buffers, and nested objects", () => {
    expect(valueByteSize(null)).toBe(0);
    expect(valueByteSize(true)).toBe(1);
    expect(valueByteSize(12)).toBe(8);
    expect(valueByteSize("ab")).toBe(2);
    expect(valueByteSize(new Blob([new Uint8Array(40)]))).toBe(40);
    expect(
      valueByteSize({
        size: 40,
        type: "image/png",
        arrayBuffer: async () => new ArrayBuffer(40),
      }),
    ).toBe(40);
    expect(valueByteSize(new Uint8Array(12))).toBe(12);
    expect(valueByteSize(new ArrayBuffer(8))).toBe(8);
    expect(valueByteSize(new Date("2026-01-01"))).toBe(8);
    expect(valueByteSize({ name: "x", blob: new Blob([new Uint8Array(10)]) })).toBe(
      valueByteSize("name") + valueByteSize("x") + valueByteSize("blob") + 10,
    );
    expect(valueByteSize(["hi", false])).toBe(valueByteSize("hi") + 1);
  });

  it("does not recurse forever on cycles", () => {
    const loop: { self?: unknown; n: number } = { n: 1 };
    loop.self = loop;
    expect(valueByteSize(loop)).toBe(valueByteSize("n") + 8 + valueByteSize("self"));
  });
});

describe("category mapping", () => {
  it("maps known stores and buckets unknown names as other", () => {
    expect(categoryForStore(PROJECT_STORE)).toBe("notes");
    expect(categoryForStore(PLAYBOOK_STORE)).toBe("playbooks");
    expect(categoryForStore(PLAYBOOK_IMAGE_STORE)).toBe("photos");
    expect(categoryForStore(SETTINGS_STORE)).toBe("settings");
    expect(categoryForStore(HANDLE_STORE)).toBe("other");
    expect(categoryForStore("futureStore")).toBe("other");
    expect(emptyCs2DatabaseUsage().categories.map((row) => row.id)).toEqual([
      ...STORAGE_CATEGORY_IDS,
    ]);
  });

  it("falls back when a photo row lost its Blob", () => {
    expect(playbookImageFallbackId({ id: "img-1", blob: {} })).toBe("img-1");
    expect(
      playbookImageFallbackId({ id: "img-1", blob: new Blob([new Uint8Array(4)]) }),
    ).toBeNull();
    expect(
      playbookImageFallbackId({
        id: "img-1",
        blob: { size: 4, type: "image/png" },
      }),
    ).toBeNull();
    expect(playbookImageFallbackId({ id: "", blob: {} })).toBeNull();
    expect(playbookImageFallbackId(null)).toBeNull();
  });

  it("scales bar percents from category bytes", () => {
    expect(
      categoryBarPercents([
        { id: "notes", label: "Analyzer notes", bytes: 25 },
        { id: "playbooks", label: "Playbooks", bytes: 75 },
      ]),
    ).toEqual([25, 75]);
    expect(
      categoryBarPercents([
        { id: "notes", label: "Analyzer notes", bytes: 0 },
        { id: "playbooks", label: "Playbooks", bytes: 0 },
      ]),
    ).toEqual([0, 0]);
  });
});

describe("formatLocalDatabaseUsageLabel", () => {
  const mib = 1024 * 1024;

  it("shows used / quota in MB when the browser reports a cap", () => {
    expect(formatMegabytes(mib)).toBe("1.0");
    expect(formatMegabytes(12 * mib)).toBe("12");
    expect(formatUsageMegabytes(1.2 * mib, 512 * mib)).toBe("1.2 / 512 MB");
    expect(formatLocalDatabaseUsageLabel(1.2 * mib, 512 * mib)).toBe(
      "Local database usage: 1.2 / 512 MB",
    );
  });

  it("omits the cap when estimate() has no quota", () => {
    expect(formatLocalDatabaseUsageLabel(mib, null)).toBe("Local database usage: 1.0 MB");
    expect(formatLocalDatabaseUsageLabel(mib, 0)).toBe("Local database usage: 1.0 MB");
  });
});

describe("readOriginStorageEstimate", () => {
  it("reads usage, quota, and persisted from StorageManager", async () => {
    const storage: StorageManagerLike = {
      estimate: async () => ({ usage: 4096, quota: 8_000_000 }),
      persist: async () => true,
      persisted: async () => false,
    };
    expect(await readOriginStorageEstimate(storage)).toEqual({
      usageBytes: 4096,
      quotaBytes: 8_000_000,
      persisted: false,
      persistSupported: true,
    });
  });

  it("treats missing StorageManager as unsupported", async () => {
    expect(await readOriginStorageEstimate(undefined)).toEqual({
      usageBytes: null,
      quotaBytes: null,
      persisted: null,
      persistSupported: false,
    });
  });

  it("ignores non-finite estimate numbers", async () => {
    const storage: StorageManagerLike = {
      estimate: async () => ({ usage: Number.NaN, quota: -1 }),
    };
    expect(await readOriginStorageEstimate(storage)).toEqual({
      usageBytes: null,
      quotaBytes: null,
      persisted: null,
      persistSupported: false,
    });
  });
});

describe("requestPersistentStorage", () => {
  it("returns null when persist() is missing", async () => {
    expect(await requestPersistentStorage({})).toBeNull();
    expect(await requestPersistentStorage(undefined)).toBeNull();
  });

  it("returns the persist() result", async () => {
    expect(await requestPersistentStorage({ persist: async () => true })).toBe(true);
    expect(await requestPersistentStorage({ persist: async () => false })).toBe(false);
  });

  it("returns false when persist() throws", async () => {
    expect(
      await requestPersistentStorage({
        persist: async () => {
          throw new Error("denied");
        },
      }),
    ).toBe(false);
  });
});
