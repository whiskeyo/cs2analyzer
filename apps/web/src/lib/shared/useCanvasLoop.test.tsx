/**
 * @vitest-environment jsdom
 */
import { useRef } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import { canvasInputsChanged, useCanvasLoop } from "./useCanvasLoop";

const paint = vi.fn();
const shouldPaint = vi.fn(() => true);

function Harness({ dirty }: { dirty?: () => boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  useCanvasLoop(canvasRef, wrapRef, paint, [], dirty);
  return (
    <div ref={wrapRef} data-testid="wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}

describe("canvasInputsChanged", () => {
  it("is dirty on the first sample and clean when every slot is Object.is-equal", () => {
    const last: { current: readonly unknown[] | null } = { current: null };
    expect(canvasInputsChanged(last, [1, "a"])).toBe(true);
    expect(canvasInputsChanged(last, [1, "a"])).toBe(false);
    expect(canvasInputsChanged(last, [2, "a"])).toBe(true);
    expect(canvasInputsChanged(last, [2, "a"])).toBe(false);
  });

  it("treats a shorter or longer list as dirty", () => {
    const last: { current: readonly unknown[] | null } = { current: null };
    expect(canvasInputsChanged(last, [1])).toBe(true);
    expect(canvasInputsChanged(last, [1, 2])).toBe(true);
    expect(canvasInputsChanged(last, [1])).toBe(true);
  });
});

describe("useCanvasLoop", () => {
  let rafCb: FrameRequestCallback | null = null;

  beforeEach(() => {
    rafCb = null;
    paint.mockClear();
    shouldPaint.mockClear();
    shouldPaint.mockReturnValue(true);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        rafCb = cb;
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(createMockCanvas());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function sizeWrap(container: HTMLElement, w = 400, h = 400) {
    const wrap = container.querySelector("[data-testid=wrap]") as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", { value: w, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: h, configurable: true });
    return wrap;
  }

  it("skips paint when shouldPaint is false and the bitmap size is unchanged", () => {
    const { container } = render(<Harness dirty={shouldPaint} />);
    sizeWrap(container);
    shouldPaint.mockReturnValue(true);
    act(() => {
      rafCb?.(0);
    });
    expect(paint).toHaveBeenCalledTimes(1);

    shouldPaint.mockReturnValue(false);
    act(() => {
      rafCb?.(1);
    });
    expect(paint).toHaveBeenCalledTimes(1);
  });

  it("paints on resize even when shouldPaint is false", () => {
    const { container } = render(<Harness dirty={shouldPaint} />);
    sizeWrap(container, 400, 400);
    shouldPaint.mockReturnValue(true);
    act(() => {
      rafCb?.(0);
    });
    shouldPaint.mockReturnValue(false);
    sizeWrap(container, 500, 400);
    act(() => {
      rafCb?.(1);
    });
    expect(paint).toHaveBeenCalledTimes(2);
  });
});
