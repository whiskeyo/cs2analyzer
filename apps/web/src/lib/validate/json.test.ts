import { describe, expect, it } from "vitest";
import { errorMessage, parseJson } from "./json.ts";

describe("parseJson", () => {
  it("returns parsed objects as unknown", () => {
    const value = parseJson('{"a":1}');
    expect(value).toEqual({ a: 1 });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseJson("{")).toThrow(SyntaxError);
  });
});

describe("errorMessage", () => {
  it("reads Error.message", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error values", () => {
    expect(errorMessage("plain")).toBe("plain");
    expect(errorMessage(404)).toBe("404");
  });
});
