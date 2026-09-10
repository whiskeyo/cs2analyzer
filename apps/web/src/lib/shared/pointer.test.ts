import { describe, expect, it } from "vitest";
import { wrapLocalPoint } from "./pointer";

describe("wrapLocalPoint", () => {
  it("subtracts the wrap origin from client coords", () => {
    const wrap = {
      getBoundingClientRect: () => ({ left: 10, top: 20 }),
    } as HTMLElement;
    expect(wrapLocalPoint(wrap, { clientX: 15, clientY: 30 })).toEqual({ x: 5, y: 10 });
  });
});
