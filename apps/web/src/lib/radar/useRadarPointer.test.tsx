/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, renderHook } from "@testing-library/react";
import type { MutableRefObject, RefObject } from "react";
import { VIEW_ZOOM_IN, VIEW_ZOOM_OUT } from "@/lib/radar/constants.ts";
import { clampViewScale } from "@/lib/radar/panZoom.ts";
import type { TextEdit, TextEditDrag, TextMove } from "@/components/radar/TextNoteEditor";
import * as draw from "@/lib/radar/draw";
import { worldToScreen } from "@/lib/radar/maps";
import { useRadarPointer, type RadarPanView } from "@/lib/radar/useRadarPointer";
import { NOTE_BOOKMARK_TITLE, NOTE_TEXT_DRAG_PX } from "@/lib/shared/constants";
import { UNIT_CALIBRATION, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import type { DrawTool, Stroke } from "@/lib/notes/types";

const WRAP = 400;

function textStroke(x: number, y: number, text = "note"): Extract<Stroke, { type: "text" }> {
  return { type: "text", round: 1, color: "#fff", x, y, text, box_w: 80, box_h: 40 };
}

type PointerHarness = {
  wrap: HTMLDivElement;
  view: MutableRefObject<RadarPanView>;
  strokesRef: MutableRefObject<Stroke[]>;
  draft: MutableRefObject<Stroke | null>;
  textMoveRef: MutableRefObject<TextMove | null>;
  editDragRef: MutableRefObject<TextEditDrag | null>;
  editingRef: MutableRefObject<TextEdit | null>;
  editWrapRef: RefObject<HTMLDivElement | null>;
  onStrokes: ReturnType<typeof vi.fn<(next: Stroke[]) => void>>;
  onPause: ReturnType<typeof vi.fn>;
  onPan: ReturnType<typeof vi.fn>;
  beginEditing: ReturnType<typeof vi.fn<(next: TextEdit) => void>>;
  commitEditing: ReturnType<typeof vi.fn>;
  setEditing: ReturnType<typeof vi.fn>;
  focusEditor: ReturnType<typeof vi.fn>;
  toolRef: MutableRefObject<DrawTool>;
  pointerDown: (x: number, y: number) => void;
  pointerMove: (x: number, y: number) => void;
  pointerUp: () => void;
  wheel: (deltaY: number) => void;
  dblClick: (x: number, y: number) => void;
  textClick: (st: Extract<Stroke, { type: "text" }>) => { x: number; y: number };
};

function renderPointer(
  opts: {
    tool?: DrawTool;
    strokes?: Stroke[];
    tick?: number;
  } = {},
): PointerHarness {
  const wrap = document.createElement("div");
  Object.defineProperty(wrap, "clientWidth", { value: WRAP, configurable: true });
  Object.defineProperty(wrap, "clientHeight", { value: WRAP, configurable: true });
  wrap.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: WRAP,
      height: WRAP,
      right: WRAP,
      bottom: WRAP,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  const canvas = document.createElement("canvas");
  const mockCtx = createMockCanvas();
  vi.spyOn(canvas, "getContext").mockReturnValue(mockCtx);
  wrap.appendChild(canvas);
  document.body.appendChild(wrap);

  const view: MutableRefObject<RadarPanView> = {
    current: {
      scale: 1,
      ox: 0,
      oy: 0,
      dragging: false,
      dragged: false,
      lx: 0,
      ly: 0,
      drawing: false,
    },
  };
  const calRef = { current: UNIT_CALIBRATION };
  const toolRef: MutableRefObject<DrawTool> = { current: opts.tool ?? "pan" };
  const replay = makeReplay({
    rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
  });
  const tickRef = { current: opts.tick ?? 100 };
  const colorRef = { current: "#ff0000" };
  const momentRef = { current: false };
  const strokesRef: MutableRefObject<Stroke[]> = { current: opts.strokes ?? [] };
  const onStrokes = vi.fn((next: Stroke[]) => {
    strokesRef.current = next;
  });
  const onPause = vi.fn();
  const onPan = vi.fn();
  const draft: MutableRefObject<Stroke | null> = { current: null };
  const penTip: MutableRefObject<{ x: number; y: number } | null> = { current: null };
  const suppressClickRef = { current: false };
  const textMoveRef: MutableRefObject<TextMove | null> = { current: null };
  const editDragRef: MutableRefObject<TextEditDrag | null> = { current: null };
  const editingRef: MutableRefObject<TextEdit | null> = { current: null };
  const editWrapRef: RefObject<HTMLDivElement | null> = { current: null };
  const ignoreBlurRef = { current: false };
  const commitEditing = vi.fn();
  const beginEditing = vi.fn((next: TextEdit) => {
    editingRef.current = next;
  });
  const setEditing = vi.fn();
  const focusEditor = vi.fn();

  renderHook(() =>
    useRadarPointer({
      wrapRef: { current: wrap },
      canvasRef: { current: canvas },
      view,
      calRef,
      toolRef,
      replayRef: { current: replay },
      tickRef,
      colorRef,
      momentRef,
      strokesRef,
      onStrokesRef: { current: onStrokes },
      onPauseRef: { current: onPause },
      onPanRef: { current: onPan },
      draft,
      penTip,
      suppressClickRef,
      textMoveRef,
      editDragRef,
      editingRef,
      editWrapRef,
      ignoreBlurRef,
      commitEditingRef: { current: commitEditing },
      beginEditingRef: { current: beginEditing },
      setEditing,
      focusEditor,
    }),
  );

  const pointerDown = (x: number, y: number) => {
    act(() => {
      fireEvent.mouseDown(wrap, { button: 0, clientX: x, clientY: y });
    });
  };
  const pointerMove = (x: number, y: number) => {
    act(() => {
      fireEvent.mouseMove(window, { clientX: x, clientY: y });
    });
  };
  const pointerUp = () => {
    act(() => {
      fireEvent.mouseUp(window);
    });
  };
  const wheel = (deltaY: number) => {
    act(() => {
      fireEvent.wheel(wrap, { deltaY });
    });
  };
  const dblClick = (x: number, y: number) => {
    act(() => {
      fireEvent.doubleClick(wrap, { clientX: x, clientY: y });
    });
  };
  const textClick = (st: Extract<Stroke, { type: "text" }>) =>
    worldToScreen(UNIT_CALIBRATION, WRAP, WRAP, view.current, st.x, st.y);

  return {
    wrap,
    view,
    strokesRef,
    draft,
    textMoveRef,
    editDragRef,
    editingRef,
    editWrapRef,
    onStrokes,
    onPause,
    onPan,
    beginEditing,
    commitEditing,
    setEditing,
    focusEditor,
    toolRef,
    pointerDown,
    pointerMove,
    pointerUp,
    wheel,
    dblClick,
    textClick,
  };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("useRadarPointer", () => {
  it("zooms in and out on wheel", () => {
    const h = renderPointer();
    h.wheel(-100);
    expect(h.view.current.scale).toBe(clampViewScale(VIEW_ZOOM_IN));
    h.wheel(100);
    expect(h.view.current.scale).toBe(clampViewScale(VIEW_ZOOM_IN * VIEW_ZOOM_OUT));
  });

  it("pans the view after a drag threshold", () => {
    const h = renderPointer({ tool: "pan" });
    h.pointerDown(100, 100);
    h.pointerMove(105, 105);
    expect(h.onPan).toHaveBeenCalledTimes(1);
    expect(h.view.current.ox).toBe(5);
    expect(h.view.current.oy).toBe(5);
    expect(h.view.current.dragged).toBe(true);
    h.pointerUp();
    expect(h.view.current.dragging).toBe(false);
  });

  it("commits a pen stroke after draw", () => {
    const h = renderPointer({ tool: "pen" });
    h.pointerDown(200, 200);
    expect(h.view.current.drawing).toBe(true);
    expect(h.draft.current?.type).toBe("pen");
    h.pointerMove(220, 200);
    h.pointerMove(240, 210);
    h.pointerUp();
    expect(h.onStrokes).toHaveBeenCalledTimes(1);
    const added = h.onStrokes.mock.calls[0][0];
    expect(added).toHaveLength(1);
    expect(added[0].type).toBe("pen");
    expect(added[0].color).toBe("#ff0000");
    if (added[0].type === "pen") {
      expect(added[0].points.length).toBeGreaterThanOrEqual(2);
    }
    expect(h.draft.current).toBeNull();
    expect(h.view.current.drawing).toBe(false);
  });

  it("discards a pen stroke with fewer than two points", () => {
    const h = renderPointer({ tool: "pen" });
    h.pointerDown(200, 200);
    h.pointerUp();
    expect(h.onStrokes).not.toHaveBeenCalled();
    expect(h.draft.current).toBeNull();
  });

  it("commits an arrow stroke on mouse up", () => {
    const h = renderPointer({ tool: "arrow" });
    h.pointerDown(180, 200);
    h.pointerMove(280, 220);
    h.pointerUp();
    expect(h.onStrokes).toHaveBeenCalledTimes(1);
    const st = h.onStrokes.mock.calls[0][0][0];
    expect(st.type).toBe("arrow");
    if (st.type === "arrow") {
      expect(st.from).toEqual(
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      );
      expect(st.to).toEqual(
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      );
    }
  });

  it("places a bookmark and pauses playback", () => {
    const h = renderPointer({ tool: "bookmark" });
    h.pointerDown(200, 200);
    expect(h.onPause).toHaveBeenCalledTimes(1);
    expect(h.onStrokes).toHaveBeenCalledTimes(1);
    const st = h.onStrokes.mock.calls[0][0][0];
    expect(st.type).toBe("bookmark");
    if (st.type === "bookmark") {
      expect(st.text).toBe(NOTE_BOOKMARK_TITLE);
      expect(st.round).toBe(1);
      expect(st.start_tick).toBe(100);
    }
  });

  it("erases pen strokes hit under the cursor", () => {
    vi.spyOn(draw, "hitStroke").mockReturnValue(true);
    const pen: Stroke = {
      type: "pen",
      round: 1,
      color: "#fff",
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    };
    const h = renderPointer({ tool: "eraser", strokes: [pen] });
    h.pointerDown(200, 200);
    expect(h.onStrokes).toHaveBeenCalledWith([]);
  });

  it("erases text strokes when the label is hit", () => {
    vi.spyOn(draw, "hitTextLabel").mockReturnValue(true);
    const note = textStroke(10, 20);
    const h = renderPointer({ tool: "eraser", strokes: [note] });
    h.pointerDown(200, 200);
    expect(h.onStrokes).toHaveBeenCalledWith([]);
  });

  it("starts text placement on empty canvas click", () => {
    const h = renderPointer({ tool: "text" });
    h.pointerDown(200, 200);
    expect(h.onPause).toHaveBeenCalledTimes(1);
    expect(h.commitEditing).toHaveBeenCalledTimes(1);
    expect(h.beginEditing).toHaveBeenCalledTimes(1);
    const edit = h.beginEditing.mock.calls[0][0];
    expect(edit.index).toBeNull();
    expect(edit.text).toBe("");
    expect(edit.color).toBe("#ff0000");
    expect(edit.round).toBe(1);
    expect(edit.sx).toBe(200);
    expect(edit.sy).toBe(200);
  });

  it("moves an existing text stroke after dragging", () => {
    const note = textStroke(10, 20);
    const h = renderPointer({ tool: "text", strokes: [note] });
    const { x, y } = h.textClick(note);
    h.pointerDown(x, y);
    expect(h.textMoveRef.current).not.toBeNull();
    h.pointerMove(x + NOTE_TEXT_DRAG_PX + 2, y + NOTE_TEXT_DRAG_PX + 2);
    h.pointerUp();
    expect(h.onStrokes).toHaveBeenCalledTimes(1);
    const moved = h.onStrokes.mock.calls[0][0][0];
    expect(moved.type).toBe("text");
    if (moved.type === "text") {
      expect(moved.x).not.toBe(10);
      expect(moved.y).not.toBe(20);
    }
    expect(h.beginEditing).not.toHaveBeenCalled();
  });

  it("opens the editor when a text stroke is clicked without dragging", () => {
    const note = textStroke(10, 20, "edit me");
    const h = renderPointer({ tool: "pan", strokes: [note] });
    const { x, y } = h.textClick(note);
    h.pointerDown(x, y);
    h.pointerUp();
    expect(h.onPause).toHaveBeenCalledTimes(1);
    expect(h.beginEditing).toHaveBeenCalledTimes(1);
    const edit = h.beginEditing.mock.calls[0][0];
    expect(edit.index).toBe(0);
    expect(edit.text).toBe("edit me");
  });

  it("opens the editor on double-click over text", () => {
    const note = textStroke(30, 40, "dbl");
    const h = renderPointer({ tool: "pen", strokes: [note] });
    const { x, y } = h.textClick(note);
    h.dblClick(x, y);
    expect(h.onPause).toHaveBeenCalledTimes(1);
    expect(h.beginEditing).toHaveBeenCalledTimes(1);
    expect(h.beginEditing.mock.calls[0][0].text).toBe("dbl");
  });

  it("drags the in-progress text editor box", () => {
    const h = renderPointer({ tool: "text" });
    const editWrap = document.createElement("div");
    editWrap.style.left = "100px";
    editWrap.style.top = "120px";
    h.editWrapRef.current = editWrap;
    h.editingRef.current = {
      index: null,
      x: 10,
      y: 20,
      sx: 100,
      sy: 120,
      text: "draft",
      color: "#fff",
      round: 1,
    };
    h.editDragRef.current = { grabX: 100, grabY: 120, origSx: 100, origSy: 120 };
    h.pointerMove(130, 150);
    expect(h.editingRef.current?.sx).toBe(130);
    expect(h.editingRef.current?.sy).toBe(150);
    expect(editWrap.style.left).toBe("130px");
    expect(editWrap.style.top).toBe("150px");
    h.pointerUp();
    expect(h.setEditing).toHaveBeenCalled();
    expect(h.focusEditor).toHaveBeenCalled();
    expect(h.editDragRef.current).toBeNull();
  });

  it("ignores pointer down inside the text editor wrap", () => {
    const h = renderPointer({ tool: "text" });
    const editor = document.createElement("div");
    editor.className = "radar-text-edit-wrap";
    h.wrap.appendChild(editor);
    act(() => {
      fireEvent.mouseDown(editor, { button: 0, clientX: 50, clientY: 50 });
    });
    expect(h.beginEditing).not.toHaveBeenCalled();
    expect(h.onStrokes).not.toHaveBeenCalled();
  });

  it("skips double-click edit while the eraser is active", () => {
    const note = textStroke(10, 20, "keep");
    const h = renderPointer({ tool: "eraser", strokes: [note] });
    const { x, y } = h.textClick(note);
    h.dblClick(x, y);
    expect(h.beginEditing).not.toHaveBeenCalled();
  });
});
