import { describe, expect, it } from "vitest";
import { formatMs, formatParseTimings } from "./timings";

describe("formatParseTimings", () => {
  it("uses seconds when the total is at least one second", () => {
    expect(
      formatParseTimings({
        initMs: 12,
        parseMs: 14200,
        jsonMs: 80,
        buffersMs: 40,
        totalMs: 14340,
      }),
    ).toBe("Parsed in 14.34s (WASM 14.20s, JSON 80ms, buffers 40ms)");
  });

  it("keeps sub-second values in milliseconds", () => {
    expect(formatMs(0.4)).toBe("0ms");
    expect(formatMs(999)).toBe("999ms");
    expect(formatMs(1000)).toBe("1.00s");
  });
});
