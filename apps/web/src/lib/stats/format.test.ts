import { describe, expect, it } from "vitest";
import { formatAdr, formatKast } from "./format";

describe("formatAdr / formatKast", () => {
  it("formats ADR and KAST for display", () => {
    expect(formatAdr(77.123)).toBe("77.12");
    expect(formatKast(77.12)).toBe("77.1%");
  });
});
