import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { emptyNote } from "@/lib/notes/note";
import { UNIT_CALIBRATION } from "@/lib/testing/fixtures";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import { PlaybookCanvas } from "./PlaybookCanvas";

vi.mock("@/lib/playbook/paint", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/playbook/paint")>();
  return {
    ...actual,
    paintPlaybookBoard: vi.fn(),
  };
});

import { paintPlaybookBoard, playbookUsesLower } from "@/lib/playbook/paint";

const lowerCal = { ...UNIT_CALIBRATION, lower_radar: "lower.png" };

describe("PlaybookCanvas", () => {
  let rafCb: FrameRequestCallback | null = null;

  beforeEach(() => {
    rafCb = null;
    vi.mocked(paintPlaybookBoard).mockClear();
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

  it("paints the board when the rAF callback runs", () => {
    const note = emptyNote();
    note.loose.push({
      drawing: { type: "arrow", color: "#fff", from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
    });
    const { container } = render(
      <PlaybookCanvas cal={UNIT_CALIBRATION} floorMode="auto" note={note} />,
    );
    const wrap = container.querySelector(".radar-wrap") as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 400, configurable: true });
    act(() => {
      rafCb?.(0);
    });
    expect(paintPlaybookBoard).toHaveBeenCalled();
    expect(playbookUsesLower(UNIT_CALIBRATION, "auto")).toBe(false);
    Object.defineProperty(window, "devicePixelRatio", { value: 0, configurable: true });
    act(() => {
      rafCb?.(0);
    });
    expect(paintPlaybookBoard).toHaveBeenCalledTimes(2);
    Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
    act(() => {
      rafCb?.(0);
    });
    expect(paintPlaybookBoard).toHaveBeenCalledTimes(3);
  });

  it("pans on drag and zooms on wheel", () => {
    const { container } = render(
      <PlaybookCanvas cal={lowerCal} floorMode="lower" note={emptyNote()} />,
    );
    const wrap = container.querySelector(".radar-wrap") as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 400, configurable: true });
    wrap.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400 }) as DOMRect;
    act(() => {
      rafCb?.(0);
    });
    expect(paintPlaybookBoard).toHaveBeenCalled();
    fireEvent.mouseDown(wrap, { clientX: 10, clientY: 10, button: 0 });
    fireEvent.mouseMove(window, { clientX: 40, clientY: 25 });
    fireEvent.mouseUp(window);
    fireEvent.wheel(wrap, { deltaY: -80, clientX: 200, clientY: 200 });
    fireEvent.mouseDown(wrap, { clientX: 10, clientY: 10, button: 1 });
    expect(wrap).toBeInTheDocument();
  });

  it("skips the loop when the canvas has no 2d context", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    render(<PlaybookCanvas cal={UNIT_CALIBRATION} floorMode="auto" note={emptyNote()} />);
    expect(rafCb).toBeNull();
  });
});
