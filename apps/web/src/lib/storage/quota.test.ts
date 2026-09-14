import { describe, expect, it } from "vitest";
import {
  IDB_QUOTA_MESSAGE,
  isQuotaExceededError,
  reportQuotaError,
  storageWriteError,
  wrapIdbError,
} from "./quota";

describe("isQuotaExceededError", () => {
  it("recognizes QuotaExceededError, legacy codes, and mapped copy", () => {
    const quota = new Error("boom");
    quota.name = "QuotaExceededError";
    expect(isQuotaExceededError(quota)).toBe(true);
    const firefox = new Error("persist");
    firefox.name = "NS_ERROR_DOM_QUOTA_REACHED";
    expect(isQuotaExceededError(firefox)).toBe(true);
    expect(isQuotaExceededError({ code: 22, name: "Error" })).toBe(true);
    expect(isQuotaExceededError(new Error(IDB_QUOTA_MESSAGE))).toBe(true);
    expect(isQuotaExceededError(new Error("indexedDB request failed"))).toBe(false);
    expect(isQuotaExceededError("quota")).toBe(false);
  });
});

describe("wrapIdbError", () => {
  it("rewrites quota failures and keeps other Errors", () => {
    const quota = { name: "QuotaExceededError", message: "full", code: 22 };
    const mapped = wrapIdbError(quota);
    expect(mapped.name).toBe("QuotaExceededError");
    expect(mapped.message).toBe(IDB_QUOTA_MESSAGE);
    const other = new Error("indexedDB request failed");
    expect(wrapIdbError(other)).toBe(other);
    expect(wrapIdbError("nope").message).toBe("nope");
  });
});

describe("reportQuotaError", () => {
  it("sets copy only for quota failures", () => {
    const setError = (message: string) => messages.push(message);
    const messages: string[] = [];
    expect(reportQuotaError(new Error("nope"), setError)).toBe(false);
    expect(messages).toEqual([]);
    const quota = new Error("x");
    quota.name = "QuotaExceededError";
    expect(reportQuotaError(quota, setError)).toBe(true);
    expect(messages).toEqual([IDB_QUOTA_MESSAGE]);
  });
});

describe("storageWriteError", () => {
  it("uses quota copy for quota failures and the fallback otherwise", () => {
    const quota = new Error("x");
    quota.name = "QuotaExceededError";
    expect(storageWriteError(quota, "Could not import playbooks.")).toBe(IDB_QUOTA_MESSAGE);
    expect(storageWriteError(new Error("idb"), "Could not import playbooks.")).toBe(
      "Could not import playbooks.",
    );
  });
});
