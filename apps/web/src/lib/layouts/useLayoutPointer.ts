import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from "react";
import { zoomViewAtCursor, wheelZoomFactor } from "@/lib/radar/panZoom.ts";
import { CLOSE_LOOP_HIT_PX, MIN_POLYGON_VERTICES } from "./constants";
import { draftToRegion, splitPolygonEdge } from "./geometry";
import {
  applyHandleDrag,
  hitCalloutAtRadar,
  hitHandle,
  hitPolygonEdge,
  type LayoutHandle,
} from "./layoutHit";
import { nextCalloutName, slugId, uniqueId } from "./layout";
import { radarToScreen, screenToRadar, type RadarView } from "./maps";
import type { LayoutCallout, LayoutDraft, LayoutFloor, LayoutRegion, Point } from "./types";
import { translateCallout } from "@/lib/layout/regions.ts";

export type LayoutTool = "pan" | "polygon" | "rect" | "circle" | "select";

export type PanView = RadarView & {
  panning: boolean;
  dragged: boolean;
  lx: number;
  ly: number;
};

type Drag =
  | { kind: "handle"; id: string; handle: LayoutHandle }
  | { kind: "body"; id: string; last: Point }
  | { kind: "shape" };

export interface LayoutPointerOpts {
  wrapRef: RefObject<HTMLDivElement | null>;
  view: MutableRefObject<PanView>;
  toolRef: MutableRefObject<LayoutTool>;
  floorRef: MutableRefObject<LayoutFloor>;
  calloutsRef: MutableRefObject<LayoutCallout[]>;
  selectedIdRef: MutableRefObject<string | null>;
  draftRef: MutableRefObject<LayoutDraft | null>;
  cursorRef: MutableRefObject<Point | null>;
  onCallouts: (next: LayoutCallout[]) => void;
  onSelect: (id: string | null, additive?: boolean) => void;
}

function pos(wrap: HTMLDivElement, e: MouseEvent): Point {
  const rect = wrap.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

export function useLayoutPointer(opts: LayoutPointerOpts) {
  const {
    wrapRef,
    view,
    toolRef,
    floorRef,
    calloutsRef,
    selectedIdRef,
    draftRef,
    cursorRef,
    onCallouts,
    onSelect,
  } = opts;
  const dragRef = useRef<Drag | null>(null);
  const onCalloutsRef = useRef(onCallouts);
  onCalloutsRef.current = onCallouts;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const commitRegion = useCallback(
    (region: LayoutRegion) => {
      const callouts = calloutsRef.current;
      const selected = callouts.find((c) => c.id === selectedIdRef.current);
      if (selected && selected.floor === floorRef.current) {
        onCalloutsRef.current(
          callouts.map((c) =>
            c.id === selected.id ? { ...c, regions: [...c.regions, region] } : c,
          ),
        );
        onSelectRef.current(selected.id);
        draftRef.current = null;
        return true;
      }
      const name = nextCalloutName(callouts);
      const id = uniqueId(
        slugId(name),
        callouts.map((c) => c.id),
      );
      onCalloutsRef.current([
        ...callouts,
        { id, name, floor: floorRef.current, regions: [region] },
      ]);
      onSelectRef.current(id);
      draftRef.current = null;
      return true;
    },
    [calloutsRef, draftRef, floorRef, selectedIdRef],
  );

  const closeDraft = useCallback(() => {
    const draft = draftRef.current;
    if (!draft) return false;
    const region = draftToRegion(draft);
    if (!region) {
      if (draft.kind !== "polygon") draftRef.current = null;
      return false;
    }
    return commitRegion(region);
  }, [commitRegion, draftRef]);

  const cancelDraft = useCallback(() => {
    draftRef.current = null;
  }, [draftRef]);

  const onMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const native = e.nativeEvent;
      const { x, y } = pos(wrap, native);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const pan =
        native.button === 1 ||
        native.button === 2 ||
        native.altKey ||
        (native.button === 0 && toolRef.current === "pan");
      if (pan) {
        e.preventDefault();
        view.current.panning = true;
        view.current.dragged = false;
        view.current.lx = native.clientX;
        view.current.ly = native.clientY;
        return;
      }
      if (native.button !== 0) return;
      if (native.detail >= 2) return;

      const radar = screenToRadar(w, h, view.current, x, y);
      cursorRef.current = radar;
      const tool = toolRef.current;
      const floor = floorRef.current;
      const additive = native.ctrlKey || native.metaKey;
      if (additive) {
        const hit = hitCalloutAtRadar(calloutsRef.current, floor, radar.x, radar.y);
        onSelectRef.current(hit?.id ?? null, true);
        return;
      }

      if (tool === "rect" || tool === "circle") {
        draftRef.current = { kind: tool, start: { ...radar }, end: { ...radar } };
        dragRef.current = { kind: "shape" };
        view.current.dragged = false;
        return;
      }

      if (tool === "polygon") {
        const draft = draftRef.current;
        const points = draft?.kind === "polygon" ? draft.points : [];
        if (points.length >= MIN_POLYGON_VERTICES) {
          const first = points[0];
          if (first) {
            const s = radarToScreen(w, h, view.current, first.x, first.y);
            if (Math.hypot(s.x - x, s.y - y) <= CLOSE_LOOP_HIT_PX) {
              closeDraft();
              return;
            }
          }
        }
        draftRef.current = { kind: "polygon", points: [...points, { ...radar }] };
        return;
      }

      const selected = calloutsRef.current.find((c) => c.id === selectedIdRef.current);
      if (selected && selected.floor === floor) {
        const handle = hitHandle(wrap, view.current, selected, x, y);
        if (handle) {
          dragRef.current = { kind: "handle", id: selected.id, handle };
          view.current.dragged = false;
          return;
        }
      }
      const hit = hitCalloutAtRadar(calloutsRef.current, floor, radar.x, radar.y);
      onSelectRef.current(hit?.id ?? null);
      if (hit) {
        dragRef.current = { kind: "body", id: hit.id, last: radar };
        view.current.dragged = false;
      }
    },
    [calloutsRef, closeDraft, cursorRef, draftRef, floorRef, selectedIdRef, toolRef, view, wrapRef],
  );

  const onWheel = useCallback(
    (e: ReactWheelEvent<HTMLDivElement>) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      e.preventDefault();
      const v = view.current;
      const { x, y } = pos(wrap, e.nativeEvent);
      const factor = wheelZoomFactor(e.deltaY);
      zoomViewAtCursor(v, wrap.clientWidth, wrap.clientHeight, x, y, factor);
    },
    [view, wrapRef],
  );

  const onContextMenu = useCallback((e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
  }, []);

  const onDoubleClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const wrap = wrapRef.current;
      if (!wrap || draftRef.current) return;
      e.preventDefault();
      const { x, y } = pos(wrap, e.nativeEvent);
      const floor = floorRef.current;
      const selected = calloutsRef.current.find((c) => c.id === selectedIdRef.current);
      if (selected && selected.floor === floor && hitHandle(wrap, view.current, selected, x, y)) {
        return;
      }
      const edge = hitPolygonEdge(
        wrap,
        view.current,
        calloutsRef.current,
        floor,
        selectedIdRef.current,
        x,
        y,
      );
      if (!edge) return;
      const region = edge.callout.regions[edge.region];
      if (!region || region.kind !== "polygon") return;
      const points = splitPolygonEdge(region.points, edge.index);
      onCalloutsRef.current(
        calloutsRef.current.map((c) =>
          c.id === edge.callout.id
            ? {
                ...c,
                regions: c.regions.map((current, i) =>
                  i === edge.region ? { kind: "polygon", points } : current,
                ),
              }
            : c,
        ),
      );
      onSelectRef.current(edge.callout.id);
    },
    [calloutsRef, draftRef, floorRef, selectedIdRef, view, wrapRef],
  );

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const { x, y } = pos(wrap, e);
      const radar = screenToRadar(wrap.clientWidth, wrap.clientHeight, view.current, x, y);
      cursorRef.current = radar;

      if (view.current.panning) {
        const dx = e.clientX - view.current.lx;
        const dy = e.clientY - view.current.ly;
        if (dx !== 0 || dy !== 0) view.current.dragged = true;
        view.current.ox += dx;
        view.current.oy += dy;
        view.current.lx = e.clientX;
        view.current.ly = e.clientY;
        return;
      }

      const drag = dragRef.current;
      if (!drag) return;
      view.current.dragged = true;
      if (drag.kind === "shape") {
        const draft = draftRef.current;
        if (draft && draft.kind !== "polygon") draft.end = { ...radar };
        return;
      }
      const callouts = calloutsRef.current;
      const target = callouts.find((c) => c.id === drag.id);
      if (!target) return;
      if (drag.kind === "handle") {
        const next = applyHandleDrag(target, drag.handle, radar);
        onCalloutsRef.current(callouts.map((c) => (c.id === target.id ? next : c)));
        return;
      }
      const dx = radar.x - drag.last.x;
      const dy = radar.y - drag.last.y;
      drag.last = radar;
      onCalloutsRef.current(
        callouts.map((c) => (c.id === target.id ? translateCallout(c, dx, dy) : c)),
      );
    };

    const onUp = () => {
      if (dragRef.current?.kind === "shape") {
        closeDraft();
      }
      view.current.panning = false;
      dragRef.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [calloutsRef, closeDraft, cursorRef, draftRef, view, wrapRef]);

  return { closeDraft, cancelDraft, onMouseDown, onDoubleClick, onWheel, onContextMenu };
}
