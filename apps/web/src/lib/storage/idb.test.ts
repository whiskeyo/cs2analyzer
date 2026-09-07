import { describe, expect, it } from "vitest";
import {
  DB_VERSION,
  HANDLE_STORE,
  PLAYBOOK_STORE,
  PROJECT_STORE,
  idbAvailable,
  openCs2Db,
} from "./idb";

describe("idb constants", () => {
  it("bumps the database to v4 with a playbooks store", () => {
    expect(PROJECT_STORE).toBe("projects");
    expect(HANDLE_STORE).toBe("demoHandles");
    expect(PLAYBOOK_STORE).toBe("playbooks");
    expect(DB_VERSION).toBe(4);
  });
});

describe("idbAvailable (node)", () => {
  it("is false without indexedDB", () => {
    expect(idbAvailable()).toBe(false);
  });
});

describe("openCs2Db (node)", () => {
  it("rejects when indexedDB is missing", async () => {
    await expect(openCs2Db()).rejects.toThrow();
  });
});
