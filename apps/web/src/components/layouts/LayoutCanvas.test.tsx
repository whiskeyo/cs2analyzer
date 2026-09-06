import { useRef } from "react";
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LayoutCanvas } from "./LayoutCanvas";
import { createMockCanvas } from "@/lib/layouts/testing/mockCanvas";
import { poly } from "@/lib/layouts/testing/callouts";
import type { LayoutDraft, Point } from "@/lib/layouts/types";
import type { PanView } from "@/lib/layouts/useLayoutPointer";

const cal = {
  pos_x: 0,
  pos_y: 1024,
  scale: 1,
  radar: "de_mirage.png",
  lower_radar: "de_mirage_lower.png",
};

function Harness() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const view = useRef<PanView>({
    scale: 1,
    ox: 0,
    oy: 0,
    panning: false,
    dragged: false,
    lx: 0,
    ly: 0,
  });
  const draftRef = useRef<LayoutDraft | null>(null);
  const cursorRef = useRef<Point | null>(null);
  return (
    <LayoutCanvas
      cal={cal}
      floor="default"
      tool="select"
      callouts={[poly("a")]}
      selectedIds={["a"]}
      wrapRef={wrapRef}
      view={view}
      draftRef={draftRef}
      cursorRef={cursorRef}
      onMouseDown={vi.fn()}
      onDoubleClick={vi.fn()}
      onWheel={vi.fn()}
      onContextMenu={vi.fn()}
    />
  );
}

describe("LayoutCanvas", () => {
  let rafCb: FrameRequestCallback | null = null;

  beforeEach(() => {
    rafCb = null;
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        rafCb = cb;
        return 1;
      }),
    );
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(createMockCanvas());
    class MockImage {
      onload: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal("Image", MockImage);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("paints when the rAF callback runs", () => {
    const { container } = render(<Harness />);
    const wrap = container.querySelector(".canvas-wrap") as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 400, configurable: true });
    act(() => {
      rafCb?.(0);
    });
    expect(container.querySelector("canvas")).toBeInTheDocument();
    Object.defineProperty(window, "devicePixelRatio", { value: 0, configurable: true });
    act(() => {
      rafCb?.(0);
    });
  });

  it("skips the loop when the canvas has no 2d context", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<Harness />);
    expect(rafCb).toBeNull();
  });
});
