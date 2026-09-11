import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { RADAR_MIN_WIDTH } from "./constants";
import { clampPanelWidth, loadPanelWidth, savePanelWidth } from "./sidebarWidth";

export interface PanelResizeOptions {
  storageKey?: string;
  minWidth: number;
  maxWidth: number;
  defaultWidth: number;
  /** Closest ancestor whose width is the radar + panels (e.g. `.stage`). */
  stageSelector: string;
  /** Width of other right-hand panels that must stay on screen with the radar. */
  extraReserved?: number | (() => number);
  label: string;
  /** Persist after a drag/keyboard resize. Sidebar writes IndexedDB here. */
  onPersist?: (width: number) => void;
  /** Keep the panel in sync when the source of truth changes (settings reset). */
  syncWidth?: number;
}

export function usePanelResize(opts: PanelResizeOptions) {
  const {
    storageKey,
    minWidth,
    maxWidth,
    defaultWidth,
    stageSelector,
    extraReserved = 0,
    label,
    onPersist,
    syncWidth,
  } = opts;
  const [width, setWidth] = useState(() =>
    storageKey
      ? loadPanelWidth(storageKey, defaultWidth, minWidth, maxWidth)
      : clampPanelWidth(defaultWidth, Number.POSITIVE_INFINITY, minWidth, maxWidth),
  );
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;
  const extraRef = useRef(extraReserved);
  extraRef.current = extraReserved;
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;
  const syncRef = useRef(syncWidth);
  if (syncWidth != null && syncWidth !== syncRef.current) {
    syncRef.current = syncWidth;
    const next = clampPanelWidth(syncWidth, Number.POSITIVE_INFINITY, minWidth, maxWidth);
    if (next !== width) {
      setWidth(next);
    }
  }
  const reserved = () => {
    const extra = extraRef.current;
    const value = typeof extra === "function" ? extra() : (extra ?? 0);
    return RADAR_MIN_WIDTH + value;
  };
  const persistWidth = (next: number) => {
    if (storageKey) {
      savePanelWidth(storageKey, next, minWidth, maxWidth);
    }
    onPersistRef.current?.(next);
  };

  useEffect(() => {
    const fit = () => {
      const stage = document.querySelector(stageSelector);
      const stageWidth = stage instanceof HTMLElement ? stage.clientWidth : window.innerWidth;
      setWidth((w) => clampPanelWidth(w, stageWidth, minWidth, maxWidth, reserved()));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      document.body.classList.remove("sidebar-resizing");
    };
  }, [stageSelector, minWidth, maxWidth]);

  const stageWidthOf = (el: HTMLElement) => {
    const stage = el.closest(stageSelector);
    return stage instanceof HTMLElement ? stage.clientWidth : window.innerWidth;
  };

  const onResizePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startWidth: widthRef.current,
    };
    document.body.classList.add("sidebar-resizing");
  };

  const onResizePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const next = clampPanelWidth(
      drag.startWidth + (drag.startX - e.clientX),
      stageWidthOf(e.currentTarget),
      minWidth,
      maxWidth,
      reserved(),
    );
    setWidth(next);
  };

  const endResize = (e: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    document.body.classList.remove("sidebar-resizing");
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    persistWidth(widthRef.current);
  };

  const onResizeKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    let raw: number;
    if (e.key === "ArrowLeft") raw = widthRef.current + step;
    else if (e.key === "ArrowRight") raw = widthRef.current - step;
    else if (e.key === "Home") raw = maxWidth;
    else if (e.key === "End") raw = minWidth;
    else return;
    e.preventDefault();
    const next = clampPanelWidth(
      raw,
      stageWidthOf(e.currentTarget),
      minWidth,
      maxWidth,
      reserved(),
    );
    setWidth(next);
    persistWidth(next);
  };

  const snapMin = () => {
    setWidth(minWidth);
    persistWidth(minWidth);
  };

  return {
    width,
    setWidth,
    handleProps: {
      className: "sidebar-resize",
      role: "separator" as const,
      "aria-orientation": "vertical" as const,
      "aria-label": label,
      "aria-valuemin": minWidth,
      "aria-valuemax": maxWidth,
      "aria-valuenow": width,
      tabIndex: 0,
      onPointerDown: onResizePointerDown,
      onPointerMove: onResizePointerMove,
      onPointerUp: endResize,
      onPointerCancel: endResize,
      onDoubleClick: snapMin,
      onKeyDown: onResizeKeyDown,
    },
  };
}
