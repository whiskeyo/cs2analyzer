import { describe, expect, it } from "vitest";
import { seriesDemoColor, seriesDemoColors } from "./seriesDemoColor";

describe("seriesDemoColor", () => {
  it("assigns stable colors by demo order", () => {
    const colors = seriesDemoColors(["a", "b", "c"]);
    expect(colors.get("a")).toBe(seriesDemoColor(0));
    expect(colors.get("b")).toBe(seriesDemoColor(1));
    expect(colors.get("c")).toBe(seriesDemoColor(2));
    expect(colors.get("a")).not.toBe(colors.get("b"));
  });
});
