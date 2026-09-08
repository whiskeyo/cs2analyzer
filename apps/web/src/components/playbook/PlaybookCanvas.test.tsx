/* eslint-disable max-lines -- pointer cases share one rAF / canvas mock setup */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
import { emptyNote } from "@/lib/notes/note";
import { placeText } from "@/lib/playbook/drawings";
import { makePiece, rotateHandleOffset } from "@/lib/playbook/pieces";
import { worldToScreen } from "@/lib/radar/maps";
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
const identityView = { scale: 1, ox: 0, oy: 0 };

function sizedWrap(container: HTMLElement) {
  const wrap = container.querySelector(".radar-wrap") as HTMLElement;
  Object.defineProperty(wrap, "clientWidth", {
    value: 400,
    configurable: true,
  });
  Object.defineProperty(wrap, "clientHeight", {
    value: 400,
    configurable: true,
  });
  wrap.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 400,
      height: 400,
      right: 400,
      bottom: 400,
    }) as DOMRect;
  return wrap;
}

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
    note.drawings.push({
      type: "arrow",
      color: "#fff",
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
    });
    const { container } = render(
      <PlaybookCanvas cal={UNIT_CALIBRATION} floorMode="auto" note={note} />,
    );
    const wrap = container.querySelector(".radar-wrap") as HTMLElement;
    Object.defineProperty(wrap, "clientWidth", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(wrap, "clientHeight", {
      value: 400,
      configurable: true,
    });
    act(() => {
      rafCb?.(0);
    });
    expect(paintPlaybookBoard).toHaveBeenCalled();
    expect(playbookUsesLower(UNIT_CALIBRATION, "auto")).toBe(false);
    Object.defineProperty(window, "devicePixelRatio", {
      value: 0,
      configurable: true,
    });
    act(() => {
      rafCb?.(0);
    });
    expect(paintPlaybookBoard).toHaveBeenCalledTimes(2);
    Object.defineProperty(window, "devicePixelRatio", {
      value: 2,
      configurable: true,
    });
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
    Object.defineProperty(wrap, "clientWidth", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(wrap, "clientHeight", {
      value: 400,
      configurable: true,
    });
    wrap.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        width: 400,
        height: 400,
        right: 400,
        bottom: 400,
      }) as DOMRect;
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

  it("places a token, drags it, and rotates a pawn with shift", () => {
    const onNote = vi.fn();
    const onSelect = vi.fn();
    const { container, rerender } = render(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={emptyNote()}
        tool="pawn-ct"
        onNote={onNote}
        onSelect={onSelect}
      />,
    );
    const wrap = sizedWrap(container);
    expect(wrap).toHaveStyle({ cursor: "copy" });
    fireEvent.mouseDown(wrap, { clientX: 200, clientY: 200, button: 0 });
    expect(onNote).toHaveBeenCalled();
    const placed = onNote.mock.calls[0]?.[0];
    expect(placed.pieces[0]).toMatchObject({ kind: "pawn", side: "CT" });
    expect(onSelect).toHaveBeenCalledWith(placed.pieces[0].id);

    const pawn = makePiece("pawn", 0, 0, { id: "p", side: "T", yaw: 0 });
    const note = emptyNote();
    note.pieces.push(pawn);
    rerender(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={note}
        tool="pan"
        onNote={onNote}
        onSelect={onSelect}
      />,
    );
    const at = worldToScreen(UNIT_CALIBRATION, 400, 400, identityView, 0, 0);
    onNote.mockClear();
    fireEvent.mouseDown(wrap, { clientX: at.x, clientY: at.y, button: 0 });
    fireEvent.mouseMove(window, { clientX: at.x + 24, clientY: at.y });
    expect(onNote.mock.calls.at(-1)?.[0].pieces[0].x).not.toBe(0);

    rerender(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={emptyNote()}
        tool="pan"
        onNote={onNote}
        onSelect={onSelect}
      />,
    );
    fireEvent.mouseMove(window, { clientX: at.x + 30, clientY: at.y });
    fireEvent.mouseUp(window);

    rerender(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={note}
        tool="pan"
        onNote={onNote}
        onSelect={onSelect}
      />,
    );
    onNote.mockClear();
    fireEvent.mouseDown(wrap, {
      clientX: at.x,
      clientY: at.y,
      button: 0,
      shiftKey: true,
    });
    fireEvent.mouseMove(window, { clientX: at.x + 40, clientY: at.y });
    expect(onNote.mock.calls.at(-1)?.[0].pieces[0].yaw).not.toBe(0);
    fireEvent.mouseUp(window);

    fireEvent.mouseDown(wrap, { clientX: 12, clientY: 12, button: 0 });
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("opens an aim ring on double-click and rotates from the handle", () => {
    const onNote = vi.fn();
    const onSelect = vi.fn();
    const pawn = makePiece("pawn", 0, 0, { id: "p", side: "T", yaw: 0 });
    const note = emptyNote();
    note.pieces.push(pawn);
    const { container, rerender } = render(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={note}
        tool="pan"
        onNote={onNote}
        onSelect={onSelect}
      />,
    );
    const wrap = sizedWrap(container);
    const at = worldToScreen(UNIT_CALIBRATION, 400, 400, identityView, 0, 0);
    fireEvent.dblClick(wrap, { clientX: at.x, clientY: at.y, button: 0 });
    act(() => {
      rafCb?.(0);
    });
    expect(vi.mocked(paintPlaybookBoard).mock.calls.at(-1)?.[10]).toBe("p");
    expect(onSelect).toHaveBeenCalledWith("p");

    const handle = rotateHandleOffset(0);
    onNote.mockClear();
    fireEvent.mouseDown(wrap, {
      clientX: at.x + handle.x,
      clientY: at.y + handle.y,
      button: 0,
    });
    fireEvent.mouseMove(window, { clientX: at.x + 40, clientY: at.y });
    expect(onNote.mock.calls.at(-1)?.[0].pieces[0].yaw).not.toBe(0);
    fireEvent.mouseUp(window);

    fireEvent.mouseDown(wrap, { clientX: 12, clientY: 12, button: 0 });
    act(() => {
      rafCb?.(0);
    });
    expect(vi.mocked(paintPlaybookBoard).mock.calls.at(-1)?.[10]).toBeNull();

    rerender(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={note}
        tool="pawn-ct"
        onNote={onNote}
        onSelect={onSelect}
      />,
    );
    fireEvent.dblClick(wrap, { clientX: at.x, clientY: at.y, button: 0 });
    act(() => {
      rafCb?.(0);
    });
    expect(vi.mocked(paintPlaybookBoard).mock.calls.at(-1)?.[10]).toBeNull();
  });

  it("does not place without a calibration or an onNote handler", () => {
    const onNote = vi.fn();
    const { container, rerender } = render(
      <PlaybookCanvas
        cal={undefined}
        floorMode="auto"
        note={emptyNote()}
        tool="bomb"
        onNote={onNote}
      />,
    );
    const wrap = sizedWrap(container);
    fireEvent.mouseDown(wrap, { clientX: 200, clientY: 200, button: 0 });
    expect(onNote).not.toHaveBeenCalled();
    rerender(
      <PlaybookCanvas cal={UNIT_CALIBRATION} floorMode="auto" note={emptyNote()} tool="flash" />,
    );
    fireEvent.mouseDown(wrap, { clientX: 200, clientY: 200, button: 0 });
    expect(onNote).not.toHaveBeenCalled();
  });

  it("draws a pen, places a nade, trails a nade, and erases a token", () => {
    const onNote = vi.fn();
    const { container, rerender } = render(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={emptyNote()}
        tool="pen"
        onNote={onNote}
      />,
    );
    const wrap = sizedWrap(container);
    expect(wrap).toHaveStyle({ cursor: "crosshair" });
    fireEvent.mouseDown(wrap, { clientX: 80, clientY: 80, button: 0 });
    fireEvent.mouseMove(window, { clientX: 160, clientY: 160 });
    fireEvent.mouseUp(window);
    expect(onNote.mock.calls.at(-1)?.[0].drawings[0]?.type).toBe("pen");

    rerender(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={emptyNote()}
        tool="smoke"
        nadeStyle="effect"
        onNote={onNote}
      />,
    );
    onNote.mockClear();
    fireEvent.mouseDown(wrap, { clientX: 120, clientY: 120, button: 0 });
    expect(onNote.mock.calls[0]?.[0].pieces[0]).toMatchObject({
      kind: "smoke",
      nadeStyle: "effect",
    });

    rerender(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={emptyNote()}
        tool="flash"
        nadeTrail
        onNote={onNote}
      />,
    );
    onNote.mockClear();
    fireEvent.mouseDown(wrap, { clientX: 50, clientY: 50, button: 0 });
    expect(onNote).not.toHaveBeenCalled();
    fireEvent.mouseDown(wrap, { clientX: 80, clientY: 60, button: 2 });
    fireEvent.contextMenu(wrap);
    fireEvent.mouseMove(window, { clientX: 90, clientY: 70 });
    fireEvent.mouseDown(wrap, { clientX: 110, clientY: 90, button: 0 });
    expect(onNote.mock.calls[0]?.[0].pieces[0]).toMatchObject({
      kind: "flash",
      nadeStyle: "icon",
    });
    expect(onNote.mock.calls[0]?.[0].pieces[0]?.trail).toHaveLength(2);

    const note = emptyNote();
    note.pieces.push(makePiece("bomb", 0, 0, { id: "c4" }));
    rerender(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={note}
        tool="eraser"
        onNote={onNote}
      />,
    );
    onNote.mockClear();
    const at = worldToScreen(UNIT_CALIBRATION, 400, 400, identityView, 0, 0);
    fireEvent.mouseDown(wrap, { clientX: at.x, clientY: at.y, button: 0 });
    expect(onNote.mock.calls[0]?.[0].pieces).toEqual([]);

    rerender(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={emptyNote()}
        tool="arrow"
        onNote={onNote}
      />,
    );
    onNote.mockClear();
    fireEvent.mouseDown(wrap, { clientX: 40, clientY: 40, button: 0 });
    fireEvent.mouseMove(window, { clientX: 90, clientY: 70 });
    fireEvent.mouseUp(window);
    expect(onNote.mock.calls.at(-1)?.[0].drawings[0]?.type).toBe("arrow");
  });

  it("drags a pen with Pan and leaves text in place", () => {
    const onNote = vi.fn();
    const note = emptyNote();
    note.drawings.push({
      type: "pen",
      color: "#fff",
      points: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
      ],
    });
    note.drawings.push(placeText("#fff", { x: 400, y: 400 }, "hold"));
    const { container } = render(
      <PlaybookCanvas
        cal={UNIT_CALIBRATION}
        floorMode="auto"
        note={note}
        tool="pan"
        onNote={onNote}
      />,
    );
    const wrap = sizedWrap(container);
    const at = worldToScreen(UNIT_CALIBRATION, 400, 400, identityView, 0, 0);
    fireEvent.mouseDown(wrap, { clientX: at.x, clientY: at.y, button: 0 });
    fireEvent.mouseMove(window, { clientX: at.x + 30, clientY: at.y + 10 });
    expect(onNote.mock.calls.at(-1)?.[0].drawings[0]?.points[0]?.x).not.toBe(0);
    expect(onNote.mock.calls.at(-1)?.[0].drawings[1]).toMatchObject({
      x: 400,
      y: 400,
      text: "hold",
    });
    fireEvent.mouseUp(window);
  });
});
