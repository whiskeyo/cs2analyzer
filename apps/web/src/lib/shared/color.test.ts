import { describe, expect, it } from "vitest";
import { darkenHexColor } from "./color";

describe("darkenHexColor", () => {
  it("scales #rrggbb channels and leaves other strings alone", () => {
    expect(darkenHexColor("#ffffff", 0.5)).toBe("#808080");
    expect(darkenHexColor("#000000", 0.5)).toBe("#000000");
    expect(darkenHexColor("red", 0.5)).toBe("red");
    expect(darkenHexColor("#fff", 0.5)).toBe("#fff");
  });
});
