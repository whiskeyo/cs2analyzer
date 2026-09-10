import { describe, expect, it } from "vitest";
import { radarFile } from "./maps";

const cal = {
  pos_x: 0,
  pos_y: 1024,
  scale: 1,
  radar: "de_mirage.png",
  lower_radar: "de_mirage_lower.png",
};

describe("radarFile", () => {
  it("picks the lower PNG when that floor exists", () => {
    expect(radarFile(cal, "default")).toBe("de_mirage.png");
    expect(radarFile(cal, "lower")).toBe("de_mirage_lower.png");
    expect(radarFile({ ...cal, lower_radar: undefined }, "lower")).toBe("de_mirage.png");
  });
});
