/**
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { DEFAULT_LAYERS, DEFAULT_SUMMARY_FILTER } from "@/lib/notes/types";
import {
  makeFreezeTicks,
  makePlayer,
  makeReplay,
  makeRound,
  UNIT_CALIBRATION,
} from "@/lib/testing/fixtures";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import { RadarCanvas } from "./RadarCanvas";

vi.mock("@/lib/radar/paintRadarFrame", () => ({
  paintPawns: vi.fn(),
  paintRadarFrame: vi.fn(),
  paintViewCone: vi.fn(),
  paintHabitsOverlay: vi.fn(),
}));

vi.mock("@/lib/radar/staticMapPaint", () => ({
  paintMapImage: vi.fn(),
  paintNote: vi.fn(),
}));

vi.mock("@/lib/parse/seriesOverlay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/parse/seriesOverlay")>();
  return {
    ...actual,
    habitsArrowAtScreen: vi.fn(() => ({ demoId: "d1", tick: 100, side: "CT" as const })),
    habitsArrowJumpTick: vi.fn(() => 200),
  };
});

import * as paintRadarFrame from "@/lib/radar/paintRadarFrame";
import * as staticMapPaint from "@/lib/radar/staticMapPaint";
import { habitsArrowAtScreen } from "@/lib/parse/seriesOverlay";

function canvasProps(overrides: Partial<Parameters<typeof RadarCanvas>[0]> = {}) {
  const replay = makeReplay({
    players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
    rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
    ticks: makeFreezeTicks(2, 1, 64),
  });
  return {
    replay,
    tick: 100,
    cal: UNIT_CALIBRATION,
    selected: null,
    onSelect: vi.fn(),
    follow: false,
    trails: true,
    tool: "pan" as const,
    color: "#ff0000",
    note: { groups: [], drawings: [], pieces: [], bookmarks: [] },
    onNote: vi.fn(),
    onPan: vi.fn(),
    onPause: vi.fn(),
    moment: false,
    layers: { ...DEFAULT_LAYERS },
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    viewEpoch: 0,
    floorMode: "auto" as const,
    ...overrides,
  };
}

describe("RadarCanvas", () => {
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

    const mockCtx = createMockCanvas();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockCtx);

    class MockImage {
      onload: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    vi.stubGlobal("Image", MockImage);
    vi.mocked(paintRadarFrame.paintRadarFrame).mockClear();
    vi.mocked(paintRadarFrame.paintPawns).mockClear();
    vi.mocked(paintRadarFrame.paintViewCone).mockClear();
    vi.mocked(paintRadarFrame.paintHabitsOverlay).mockClear();
    vi.mocked(staticMapPaint.paintMapImage).mockClear();
    vi.mocked(staticMapPaint.paintNote).mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("runs the paint loop and wires a canvas", () => {
    const mockCtx = createMockCanvas();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(mockCtx);

    const { container } = render(<RadarCanvas {...canvasProps()} />);
    const wrap = container.querySelector(".radar-wrap");
    const canvas = container.querySelector("canvas");
    expect(wrap).toBeInTheDocument();
    expect(canvas).toBeInTheDocument();

    Object.defineProperty(wrap, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 400, configurable: true });

    act(() => {
      rafCb?.(0);
    });

    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalled();
    expect(staticMapPaint.paintMapImage).toHaveBeenCalled();
    expect(staticMapPaint.paintNote).toHaveBeenCalled();
  });

  it("selects a nearby player on click in pan mode", () => {
    const onSelect = vi.fn();
    const { container } = render(<RadarCanvas {...canvasProps({ onSelect, selected: null })} />);
    const wrap = container.querySelector(".radar-wrap") as HTMLElement;
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;

    Object.defineProperty(wrap, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 400, configurable: true });
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 400,
        height: 400,
        right: 400,
        bottom: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.click(canvas, { clientX: 200, clientY: 200 });
    expect(onSelect).toHaveBeenCalled();
  });

  it("uses crosshair cursor for drawing tools", () => {
    const { container } = render(<RadarCanvas {...canvasProps({ tool: "pen" })} />);
    expect(container.querySelector(".radar-wrap")).toHaveStyle({ cursor: "crosshair" });
  });

  it("does not select players when not in pan mode", () => {
    const onSelect = vi.fn();
    const { container } = render(<RadarCanvas {...canvasProps({ onSelect, tool: "eraser" })} />);
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;
    const wrap = container.querySelector(".radar-wrap") as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 400, configurable: true });
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 400,
        height: 400,
        right: 400,
        bottom: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    fireEvent.click(canvas, { clientX: 200, clientY: 200 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("jumps habits arrows on double click", () => {
    const onHabitsJump = vi.fn();
    const habitsOverlay = { demos: [], focalTeam: "A" } as never;
    const { container } = render(
      <RadarCanvas
        {...canvasProps({
          habitsOverlay,
          habitsShowArrows: true,
          onHabitsJump,
          habitsPlaySecRef: { current: 0 },
        })}
      />,
    );
    const wrap = container.querySelector(".radar-wrap") as HTMLElement;
    const canvas = container.querySelector("canvas") as HTMLCanvasElement;

    Object.defineProperty(wrap, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 400, configurable: true });
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 400,
        height: 400,
        right: 400,
        bottom: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    vi.mocked(habitsArrowAtScreen).mockReturnValue({
      demoId: "d1",
      tick: 100,
      side: "CT",
    } as never);

    fireEvent.doubleClick(canvas, { clientX: 120, clientY: 120 });
    expect(onHabitsJump).toHaveBeenCalledWith({ demoId: "d1", jumpTick: 200 });
  });

  it("skips rebuild and paint when the tick, view, and layers are unchanged", () => {
    const { container } = render(<RadarCanvas {...canvasProps()} />);
    const wrap = container.querySelector(".radar-wrap") as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 400, configurable: true });

    act(() => {
      rafCb?.(0);
    });
    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalledTimes(1);
    expect(staticMapPaint.paintMapImage).toHaveBeenCalledTimes(1);

    act(() => {
      rafCb?.(1);
    });
    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalledTimes(1);
    expect(staticMapPaint.paintMapImage).toHaveBeenCalledTimes(1);
  });

  it("rebuilds when tick, layers, note strokes, or habits playSec change", () => {
    const playSecRef = { current: 0 };
    const base = canvasProps({
      habitsOverlay: { demos: [], focalTeam: "A" } as never,
      habitsPlaySecRef: playSecRef,
    });
    const { container, rerender } = render(<RadarCanvas {...base} />);
    const wrap = container.querySelector(".radar-wrap") as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 400, configurable: true });

    act(() => {
      rafCb?.(0);
    });
    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalledTimes(1);

    rerender(<RadarCanvas {...base} tick={140} />);
    act(() => {
      rafCb?.(1);
    });
    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalledTimes(2);

    rerender(<RadarCanvas {...base} tick={140} layers={{ ...DEFAULT_LAYERS, names: false }} />);
    act(() => {
      rafCb?.(2);
    });
    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalledTimes(3);

    rerender(
      <RadarCanvas
        {...base}
        tick={140}
        layers={{ ...DEFAULT_LAYERS, names: false }}
        note={{
          groups: [],
          drawings: [{ type: "pen", color: "#fff", points: [{ x: 1, y: 1 }] }],
          pieces: [],
          bookmarks: [],
        }}
      />,
    );
    act(() => {
      rafCb?.(3);
    });
    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalledTimes(4);

    playSecRef.current = 2.5;
    act(() => {
      rafCb?.(4);
    });
    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalledTimes(5);
    expect(paintRadarFrame.paintHabitsOverlay).toHaveBeenCalled();
  });

  it("rebuilds after pan or zoom", () => {
    const { container } = render(<RadarCanvas {...canvasProps()} />);
    const wrap = container.querySelector(".radar-wrap") as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 400, configurable: true });
    wrap.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 400,
        height: 400,
        right: 400,
        bottom: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;

    act(() => {
      rafCb?.(0);
    });
    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalledTimes(1);

    fireEvent.wheel(wrap, { deltaY: -80, clientX: 200, clientY: 200 });
    act(() => {
      rafCb?.(1);
    });
    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalledTimes(2);
  });

  it("skips paint on a paused follow-cam once the view has snapped", () => {
    const { container } = render(<RadarCanvas {...canvasProps({ follow: true, selected: 0 })} />);
    const wrap = container.querySelector(".radar-wrap") as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", { value: 400, configurable: true });
    Object.defineProperty(wrap, "clientHeight", { value: 400, configurable: true });

    act(() => {
      rafCb?.(0);
    });
    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalledTimes(1);

    act(() => {
      rafCb?.(1);
    });
    expect(paintRadarFrame.paintRadarFrame).toHaveBeenCalledTimes(1);
  });
});
