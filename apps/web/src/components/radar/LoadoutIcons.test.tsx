import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import type { SampledPlayer } from "@/lib/replay/sample";
import { LoadoutIcons } from "./LoadoutIcons";

describe("LoadoutIcons", () => {
  it("renders primary, secondary, and gear icons", () => {
    const p: SampledPlayer = {
      index: 0,
      x: 0,
      y: 0,
      z: 0,
      yaw: 0,
      health: 100,
      armor: 100,
      present: true,
      alive: true,
      ducked: false,
      scoped: false,
      ct: true,
      money: 4000,
      equip: 5000,
      gear: 0b111,
      primary: 7,
      secondary: 1,
      active: 0,
      clip: 0,
      reserve: 0,
    };
    const { container } = render(<LoadoutIcons p={p} />);
    expect(container.querySelectorAll("img, svg").length).toBeGreaterThan(0);
  });
});
