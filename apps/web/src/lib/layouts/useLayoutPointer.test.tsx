import { useRef, useState } from "react";
import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SQUARE, poly } from "@/lib/layouts/testing/callouts";
import type { LayoutCallout, LayoutDraft, LayoutFloor, Point } from "./types";
import { useLayoutPointer, type LayoutTool, type PanView } from "./useLayoutPointer";

const SIZE = 1056;

function Harness({
  tool,
  floor = "default",
  initial = [],
  selectedStart,
}: {
  tool: LayoutTool;
  floor?: LayoutFloor;
  initial?: LayoutCallout[];
  selectedStart?: string | null;
}) {
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
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const floorRef = useRef(floor);
  const calloutsRef = useRef(initial);
  const startId = selectedStart !== undefined ? selectedStart : (initial[0]?.id ?? null);
  const selectedIdRef = useRef<string | null>(startId);
  const draftRef = useRef<LayoutDraft | null>(null);
  const cursorRef = useRef<Point | null>(null);
  const [callouts, setCallouts] = useState(initial);
  const [selected, setSelected] = useState<string | null>(startId);
  calloutsRef.current = callouts;
  selectedIdRef.current = selected;

  const pointer = useLayoutPointer({
    wrapRef,
    view,
    toolRef,
    floorRef,
    calloutsRef,
    selectedIdRef,
    draftRef,
    cursorRef,
    onCallouts: setCallouts,
    onSelect: (id) => setSelected(id),
  });

  return (
    <div>
      <div
        ref={wrapRef}
        data-testid="wrap"
        data-count={callouts.length}
        data-selected={selected ?? ""}
        data-regions={callouts[0]?.regions.length ?? 0}
        data-draft={draftRef.current?.kind ?? ""}
        onMouseDown={pointer.onMouseDown}
        onDoubleClick={pointer.onDoubleClick}
        onWheel={pointer.onWheel}
        onContextMenu={pointer.onContextMenu}
      />
      <button type="button" onClick={() => pointer.closeDraft()}>
        Close
      </button>
      <button type="button" onClick={() => pointer.cancelDraft()}>
        Cancel
      </button>
    </div>
  );
}

function sizeWrap(el: HTMLElement) {
  Object.defineProperty(el, "clientWidth", { value: SIZE, configurable: true });
  Object.defineProperty(el, "clientHeight", { value: SIZE, configurable: true });
  el.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: SIZE,
      height: SIZE,
      right: SIZE,
      bottom: SIZE,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** radar (x,y) → screen with 16px pad and 1024 fit on a 1056 canvas. */
function at(rx: number, ry: number) {
  return { clientX: 16 + rx, clientY: 16 + ry };
}

describe("useLayoutPointer", () => {
  it("commits a three-click polygon as a new callout", () => {
    const { getByTestId, getByText } = render(<Harness tool="polygon" />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, ...at(0, 0) });
    fireEvent.mouseDown(wrap, { button: 0, ...at(40, 0) });
    fireEvent.mouseDown(wrap, { button: 0, ...at(40, 40) });
    fireEvent.click(getByText("Close"));
    expect(wrap.dataset.count).toBe("1");
    expect(wrap.dataset.selected).toMatch(/^callout/);
  });

  it("appends a rect to the selected callout", () => {
    const start = [poly("yard", "Yard")];
    const { getByTestId } = render(<Harness tool="rect" initial={start} />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, ...at(80, 80) });
    fireEvent.mouseMove(window, at(120, 120));
    fireEvent.mouseUp(window);
    expect(wrap.dataset.regions).toBe("2");
  });

  it("commits a dragged circle", () => {
    const { getByTestId } = render(<Harness tool="circle" />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, ...at(50, 50) });
    fireEvent.mouseMove(window, at(80, 50));
    fireEvent.mouseUp(window);
    expect(wrap.dataset.count).toBe("1");
  });

  it("pans with the middle button and zooms on wheel", () => {
    const { getByTestId } = render(<Harness tool="pan" />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 1, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 30, clientY: 40 });
    fireEvent.mouseUp(window);
    fireEvent.wheel(wrap, { deltaY: -100, clientX: 100, clientY: 100 });
    fireEvent.contextMenu(wrap);
    expect(wrap).toBeInTheDocument();
  });

  it("selects and body-drags an existing polygon", () => {
    const yard: LayoutCallout = {
      id: "yard",
      name: "Yard",
      floor: "default",
      regions: [{ kind: "polygon", points: SQUARE }],
    };
    const { getByTestId } = render(<Harness tool="select" initial={[yard]} />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, ...at(5, 5) });
    expect(wrap.dataset.selected).toBe("yard");
    fireEvent.mouseMove(window, at(15, 15));
    fireEvent.mouseUp(window);
  });

  it("splits a polygon edge on double-click", () => {
    const yard: LayoutCallout = {
      id: "yard",
      name: "Yard",
      floor: "default",
      regions: [{ kind: "polygon", points: SQUARE }],
    };
    const { getByTestId } = render(<Harness tool="select" initial={[yard]} />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.doubleClick(wrap, at(5, 0));
    expect(wrap.dataset.selected).toBe("yard");
  });

  it("drags a vertex handle", () => {
    const yard: LayoutCallout = {
      id: "yard",
      name: "Yard",
      floor: "default",
      regions: [{ kind: "polygon", points: SQUARE }],
    };
    const { getByTestId } = render(<Harness tool="select" initial={[yard]} />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, ...at(0, 0) });
    fireEvent.mouseMove(window, at(2, 3));
    fireEvent.mouseUp(window);
    expect(wrap.dataset.selected).toBe("yard");
  });

  it("discards a tiny rect", () => {
    const { getByTestId } = render(<Harness tool="rect" />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, ...at(10, 10) });
    fireEvent.mouseMove(window, at(11, 11));
    fireEvent.mouseUp(window);
    expect(wrap.dataset.count).toBe("0");
  });

  it("closes a polygon by clicking the first vertex", () => {
    const { getByTestId } = render(<Harness tool="polygon" />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, ...at(0, 0) });
    fireEvent.mouseDown(wrap, { button: 0, ...at(40, 0) });
    fireEvent.mouseDown(wrap, { button: 0, ...at(40, 40) });
    fireEvent.mouseDown(wrap, { button: 0, ...at(0, 0) });
    expect(wrap.dataset.count).toBe("1");
  });

  it("drags a circle rim and ignores a double-click on the handle", () => {
    const pit: LayoutCallout = {
      id: "pit",
      name: "Pit",
      floor: "default",
      regions: [{ kind: "circle", x: 50, y: 50, radius: 10 }],
    };
    const { getByTestId } = render(<Harness tool="select" initial={[pit]} />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, ...at(60, 50) });
    fireEvent.mouseMove(window, at(70, 50));
    fireEvent.mouseUp(window);
    fireEvent.doubleClick(wrap, at(50, 50));
    expect(wrap.dataset.selected).toBe("pit");
  });

  it("pans with alt or right-click and ignores a double-click while drafting", () => {
    const { getByTestId } = render(<Harness tool="polygon" />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, altKey: true, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 20, clientY: 25 });
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(wrap, { button: 2, clientX: 10, clientY: 10 });
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(wrap, { button: 0, ...at(0, 0) });
    fireEvent.doubleClick(wrap, at(20, 20));
    fireEvent.mouseDown(wrap, { button: 0, detail: 2, ...at(10, 10) });
  });

  it("cancels a draft and additive-selects", () => {
    const { getByTestId, getByText } = render(
      <Harness tool="polygon" initial={[poly("a"), poly("b")]} />,
    );
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, ...at(0, 0) });
    fireEvent.click(getByText("Cancel"));
    fireEvent.mouseDown(wrap, { button: 0, ctrlKey: true, ...at(200, 200) });
  });

  it("body-drags a large polygon and splits a distant edge", () => {
    const yard: LayoutCallout = {
      id: "yard",
      name: "Yard",
      floor: "default",
      regions: [
        {
          kind: "polygon",
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
        },
      ],
    };
    const { getByTestId } = render(<Harness tool="select" initial={[yard]} />);
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseMove(window, at(10, 10));
    fireEvent.mouseDown(wrap, { button: 0, ...at(50, 50) });
    expect(wrap.dataset.selected).toBe("yard");
    fireEvent.mouseMove(window, at(60, 55));
    fireEvent.mouseUp(window);
    fireEvent.doubleClick(wrap, at(50, 0));
    expect(wrap.dataset.selected).toBe("yard");
  });

  it("additive-selects a hit, pans with the pan tool, and ignores extra buttons", () => {
    const yard: LayoutCallout = {
      id: "yard",
      name: "Yard",
      floor: "default",
      regions: [
        {
          kind: "polygon",
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
          ],
        },
      ],
    };
    const pan = render(<Harness tool="pan" initial={[yard]} />);
    const wrap = pan.getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.mouseMove(window, { clientX: 10, clientY: 10 });
    fireEvent.mouseUp(window);
    fireEvent.mouseDown(wrap, { button: 4, ...at(50, 50) });
    fireEvent.wheel(wrap, { deltaY: 80, clientX: 100, clientY: 100 });
    fireEvent.click(pan.getByText("Close"));
    pan.unmount();

    const select = render(<Harness tool="select" initial={[yard]} />);
    const wrap2 = select.getByTestId("wrap");
    sizeWrap(wrap2);
    fireEvent.mouseDown(wrap2, { button: 0, ctrlKey: true, ...at(50, 50) });
    fireEvent.mouseDown(wrap2, { button: 0, ...at(200, 200) });
    expect(wrap2.dataset.selected).toBe("");
  });

  it("skips handles on the other floor and drops a short polygon draft", () => {
    const pit: LayoutCallout = {
      id: "pit",
      name: "Pit",
      floor: "lower",
      regions: [{ kind: "circle", x: 50, y: 50, radius: 10 }],
    };
    const otherFloor = render(<Harness tool="select" floor="default" initial={[pit]} />);
    const wrap = otherFloor.getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, ...at(50, 50) });
    expect(wrap.dataset.selected).toBe("");
    otherFloor.unmount();

    const drawing = render(<Harness tool="polygon" />);
    const polyWrap = drawing.getByTestId("wrap");
    sizeWrap(polyWrap);
    fireEvent.mouseDown(polyWrap, { button: 0, ...at(0, 0) });
    fireEvent.click(drawing.getByText("Close"));
    expect(polyWrap.dataset.count).toBe("0");
  });

  it("creates a new callout when nothing is selected", () => {
    const { getByTestId } = render(
      <Harness tool="circle" initial={[poly("yard", "Yard")]} selectedStart={null} />,
    );
    const wrap = getByTestId("wrap");
    sizeWrap(wrap);
    fireEvent.mouseDown(wrap, { button: 0, ...at(50, 50) });
    fireEvent.mouseMove(window, at(80, 50));
    fireEvent.mouseUp(window);
    expect(wrap.dataset.count).toBe("2");
  });
});
