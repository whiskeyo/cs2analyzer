import { useLayoutEffect, useState, type RefObject } from "react";
import { useDevicePixelRatio } from "./useDevicePixelRatio";

export interface TimelinePlotBox {
  width: number;
  height: number;
  left: number;
  top: number;
  dpr: number;
}

const EMPTY_BOX: TimelinePlotBox = { width: 0, height: 0, left: 0, top: 0, dpr: 1 };

/** True when two boxes would snap strokes onto the same device pixels. */
function sameBox(
  prev: TimelinePlotBox,
  rect: Pick<DOMRect, "width" | "height" | "left" | "top">,
  dpr: number,
): boolean {
  if (prev.dpr !== dpr) return false;
  const ratio = dpr > 0 ? dpr : 1;
  const close = (a: number, b: number) => Math.abs(a - b) * ratio < 0.01;
  return (
    close(prev.width, rect.width) &&
    close(prev.height, rect.height) &&
    close(prev.left, rect.left) &&
    close(prev.top, rect.top)
  );
}

/**
 * Plot size in CSS pixels, plus the overlay's screen origin.
 * Prefers `getBoundingClientRect` over `ResizeObserver` `contentRect`: those
 * two disagree by a fraction after a live sidebar drag, and the stroke snap
 * has to use the box the rasterizer actually paints.
 */
export function useTimelinePlotBox(
  hostRef: RefObject<HTMLDivElement | null>,
  overlayRef: RefObject<SVGSVGElement | null>,
  plotFraction: number,
): { plotWidthPx: number; box: TimelinePlotBox } {
  const dpr = useDevicePixelRatio();
  const [plotWidthPx, setPlotWidthPx] = useState(0);
  const [box, setBox] = useState(EMPTY_BOX);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const apply = (rect: Pick<DOMRect, "width" | "height" | "left" | "top">) => {
      setPlotWidthPx(rect.width > 0 ? rect.width * plotFraction : 0);
      setBox((prev) =>
        sameBox(prev, rect, dpr)
          ? prev
          : { width: rect.width, height: rect.height, left: rect.left, top: rect.top, dpr },
      );
    };
    const read = (content?: DOMRectReadOnly) => {
      const overlay = overlayRef.current?.getBoundingClientRect();
      if (overlay && overlay.width > 0 && overlay.height > 0) {
        apply(overlay);
        return;
      }
      const border = host.getBoundingClientRect();
      if (border.width > 0 && border.height > 0) {
        apply(border);
        return;
      }
      if (content && content.width > 0 && content.height > 0) {
        apply(new DOMRect(0, 0, content.width, content.height));
      }
    };
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      read(entries[0]?.contentRect);
    });
    observer.observe(host);
    return () => observer.disconnect();
    // `dpr` remeasures the snap on zoom. Width and height remeasure after the overlay mounts.
  }, [hostRef, overlayRef, plotFraction, box.width, box.height, dpr]);
  return { plotWidthPx, box: { ...box, dpr } };
}
