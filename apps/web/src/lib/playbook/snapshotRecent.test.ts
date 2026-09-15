/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from "vitest";
import { SNAPSHOT_RECENT_MAX } from "@/lib/shared/constants";
import { SNAPSHOT_RECENT_BOOKS_KEY } from "@/lib/shared/storageKeys";
import { newPlaybook } from "./pages";
import {
  defaultSnapshotBookKey,
  loadRecentPlaybookKeys,
  partitionRecentPlaybooks,
  rememberRecentPlaybook,
  sortPlaybooksByRecent,
} from "./snapshotRecent";

function book(title: string, key: string, sort: number) {
  return { ...newPlaybook("de_anubis", title, sort), key };
}

afterEach(() => {
  localStorage.removeItem(SNAPSHOT_RECENT_BOOKS_KEY);
});

describe("recent snapshot playbooks", () => {
  it("remembers newest first and caps the list", () => {
    for (let i = 0; i < SNAPSHOT_RECENT_MAX + 2; i++) {
      rememberRecentPlaybook(`book-${i}`);
    }
    const keys = loadRecentPlaybookKeys();
    expect(keys).toHaveLength(SNAPSHOT_RECENT_MAX);
    expect(keys[0]).toBe(`book-${SNAPSHOT_RECENT_MAX + 1}`);
    expect(keys).not.toContain("book-0");
  });

  it("moves a reused book to the front", () => {
    rememberRecentPlaybook("older");
    rememberRecentPlaybook("newer");
    rememberRecentPlaybook("older");
    expect(loadRecentPlaybookKeys()).toEqual(["older", "newer"]);
  });

  it("ignores junk stored under the recent-books key", () => {
    localStorage.setItem(SNAPSHOT_RECENT_BOOKS_KEY, "{");
    expect(loadRecentPlaybookKeys()).toEqual([]);
    localStorage.setItem(SNAPSHOT_RECENT_BOOKS_KEY, JSON.stringify([1, "", "ok"]));
    expect(loadRecentPlaybookKeys()).toEqual(["ok"]);
  });

  it("sorts matching recent keys first and defaults to the newest existing book", () => {
    const older = book("Older", "k-old", 0);
    const newer = book("Newer", "k-new", 1);
    const extra = book("Extra", "k-extra", 2);
    const recent = ["missing", "k-new", "k-old"];
    expect(sortPlaybooksByRecent([older, newer, extra], recent).map((row) => row.key)).toEqual([
      "k-new",
      "k-old",
      "k-extra",
    ]);
    expect(defaultSnapshotBookKey([older, newer], recent)).toBe("k-new");
    expect(defaultSnapshotBookKey([older, newer], [])).toBe("k-old");
    expect(defaultSnapshotBookKey([], recent)).toBeNull();
    expect(partitionRecentPlaybooks([older, newer, extra], recent)).toEqual({
      recent: [newer, older],
      rest: [extra],
    });
  });
});
