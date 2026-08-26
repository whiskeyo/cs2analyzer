import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from "react";
import {
  CLOSE_LOOP_HIT_PX,
  EDGE_HIT_PX,
  MIN_POLYGON_VERTICES,
  VERTEX_HIT_PX,
  VIEW_SCALE_MAX,
  VIEW_SCALE_MIN,
  VIEW_ZOOM_IN,
  VIEW_ZOOM_OUT,
} from "./constants";
import {
  circlePolygon,
  nearestPolygonEdge,
  pointInPolygon,
  polygonArea,
  rectPolygon,
  shapeIsLargeEnough,
  splitPolygonEdge,
  translatePolygon,
} from "./geometry";
import { nextCalloutName, slugId, uniqueId } from "./layout";
import { radarToScreen, screenToRadar, type RadarView } from "./maps";
import type { LayoutCallout, LayoutDraft, LayoutFloor, Point } from "./types";

export type LayoutTool = "pan" | "polygon" | "rect" | "circle" | "select";

export type PanView = RadarView & {
  panning: boolean;
  dragged: boolean;
  lx: number;
  ly: number;
};

type Drag =
  | { kind: "vertex"; id: string; index: number }
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
  onSelect: (id: string | null) => void;
}

function pos(wrap: HTMLDivElement, e: MouseEvent): Point {
  const rect = wrap.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

function visible(callouts: LayoutCallout[], floor: LayoutFloor): LayoutCallout[] {
  return callouts.filter((c) => c.floor === floor);
}

function hitVertex(
  wrap: HTMLDivElement,
  view: RadarView,
  polygon: Point[],
  sx: number,
  sy: number,
): number {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    if (!p) continue;
    const s = radarToScreen(w, h, view, p.x, p.y);
    if (Math.hypot(s.x - sx, s.y - sy) <= VERTEX_HIT_PX) return i;
  }
  return -1;
}

function hitCallout(
  wrap: HTMLDivElement,
  view: RadarView,
  callouts: LayoutCallout[],
  floor: LayoutFloor,
  sx: number,
  sy: number,
): LayoutCallout | null {
  const radar = screenToRadar(wrap.clientWidth, wrap.clientHeight, view, sx, sy);
  const hits = visible(callouts, floor).filter((c) => pointInPolygon(radar.x, radar.y, c.polygon));
  if (hits.length === 0) return null;
  hits.sort((a, b) => polygonArea(a.polygon) - polygonArea(b.polygon));
  return hits[0] ?? null;
}

function hitEdge(
  wrap: HTMLDivElement,
  view: RadarView,
  callouts: LayoutCallout[],
  floor: LayoutFloor,
  preferredId: string | null,
  sx: number,
  sy: number,
): { callout: LayoutCallout; index: number } | null {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  const toScreen = (p: Point) => radarToScreen(w, h, view, p.x, p.y);
  const layer = visible(callouts, floor);
  const preferred = preferredId ? layer.find((c) => c.id === preferredId) : undefined;
  const ordered = preferred ? [preferred, ...layer.filter((c) => c.id !== preferred.id)] : layer;
  let best: { callout: LayoutCallout; index: number; dist: number } | null = null;
  for (const callout of ordered) {
    const hit = nearestPolygonEdge(callout.polygon, toScreen, sx, sy);
    if (!hit || hit.dist > EDGE_HIT_PX) continue;
    if (!best || hit.dist < best.dist) best = { callout, index: hit.index, dist: hit.dist };
    if (preferred && callout.id === preferred.id) break;
  }
  return best ? { callout: best.callout, index: best.index } : null;
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

  const commitPolygon = useCallback(
    (polygon: Point[]) => {
      if (polygon.length < MIN_POLYGON_VERTICES) return false;
      const callouts = calloutsRef.current;
      const name = nextCalloutName(callouts);
      const id = uniqueId(
        slugId(name),
        callouts.map((c) => c.id),
      );
      onCalloutsRef.current([...callouts, { id, name, floor: floorRef.current, polygon }]);
      onSelectRef.current(id);
      draftRef.current = null;
      return true;
    },
    [calloutsRef, draftRef, floorRef],
  );

  const closeDraft = useCallback(() => {
    const draft = draftRef.current;
    if (!draft) return false;
    if (draft.kind === "polygon") {
      return commitPolygon(draft.points.map((p) => ({ ...p })));
    }
    if (!shapeIsLargeEnough(draft)) {
      draftRef.current = null;
      return false;
    }
    const polygon =
      draft.kind === "rect"
        ? rectPolygon(draft.start, draft.end)
        : circlePolygon(draft.start, draft.end);
    return commitPolygon(polygon);
  }, [commitPolygon, draftRef]);

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
        const vertex = hitVertex(wrap, view.current, selected.polygon, x, y);
        if (vertex >= 0) {
          dragRef.current = { kind: "vertex", id: selected.id, index: vertex };
          view.current.dragged = false;
          return;
        }
      }
      const hit = hitCallout(wrap, view.current, calloutsRef.current, floor, x, y);
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
      const before = screenToRadar(wrap.clientWidth, wrap.clientHeight, v, x, y);
      const factor = e.deltaY < 0 ? VIEW_ZOOM_IN : VIEW_ZOOM_OUT;
      v.scale = Math.min(VIEW_SCALE_MAX, Math.max(VIEW_SCALE_MIN, v.scale * factor));
      const after = radarToScreen(wrap.clientWidth, wrap.clientHeight, v, before.x, before.y);
      v.ox += x - after.x;
      v.oy += y - after.y;
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
      if (selected && selected.floor === floor) {
        const vertex = hitVertex(wrap, view.current, selected.polygon, x, y);
        if (vertex >= 0) return;
      }
      const edge = hitEdge(
        wrap,
        view.current,
        calloutsRef.current,
        floor,
        selectedIdRef.current,
        x,
        y,
      );
      if (!edge) return;
      const polygon = splitPolygonEdge(edge.callout.polygon, edge.index);
      onCalloutsRef.current(
        calloutsRef.current.map((c) => (c.id === edge.callout.id ? { ...c, polygon } : c)),
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
      if (drag.kind === "vertex") {
        const polygon = target.polygon.map((p, i) => (i === drag.index ? { ...radar } : p));
        onCalloutsRef.current(callouts.map((c) => (c.id === target.id ? { ...c, polygon } : c)));
        return;
      }
      const dx = radar.x - drag.last.x;
      const dy = radar.y - drag.last.y;
      drag.last = radar;
      onCalloutsRef.current(
        callouts.map((c) =>
          c.id === target.id ? { ...c, polygon: translatePolygon(c.polygon, dx, dy) } : c,
        ),
      );
    };

    const onUp = () => {
      if (dragRef.current?.kind === "shape") {
        const draft = draftRef.current;
        if (draft && draft.kind !== "polygon" && shapeIsLargeEnough(draft)) {
          const polygon =
            draft.kind === "rect"
              ? rectPolygon(draft.start, draft.end)
              : circlePolygon(draft.start, draft.end);
          commitPolygon(polygon);
        } else if (draft && draft.kind !== "polygon") {
          draftRef.current = null;
        }
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
  }, [calloutsRef, commitPolygon, cursorRef, draftRef, view, wrapRef]);

  return { closeDraft, cancelDraft, onMouseDown, onDoubleClick, onWheel, onContextMenu };
}
