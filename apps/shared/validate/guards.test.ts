import { describe, expect, it } from "vitest";
import { isFiniteNumber, isRecord, isString, optionalString } from "./guards.ts";

describe("guards", () => {
  it("detects plain records", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
  });

  it("validates numbers and strings", () => {
    expect(isFiniteNumber(1)).toBe(true);
    expect(isFiniteNumber(Number.NaN)).toBe(false);
    expect(isString("x")).toBe(true);
    expect(optionalString(3)).toBeUndefined();
  });
});
