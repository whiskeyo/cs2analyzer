import { useLayoutEffect, useState, type RefObject } from "react";
import {
  pixelOriginShift,
  readDevicePixelRatio,
  watchDevicePixelRatio,
} from "@/lib/stats/timelineChart";

export interface TimelinePlotBox {
  width: number;
  height: number;
  shiftX: number;
  shiftY: number;
  dpr: number;
}

const EMPTY_BOX: TimelinePlotBox = { width: 0, height: 0, shiftX: 0, shiftY: 0, dpr: 1 };

/** Plot size in CSS pixels, resnapped when the element or the device pixel ratio changes. */
export function useTimelinePlotBox(
  hostRef: RefObject<HTMLDivElement | null>,
  plotFraction: number,
): { plotWidthPx: number; box: TimelinePlotBox } {
  const [plotWidthPx, setPlotWidthPx] = useState(0);
  const [box, setBox] = useState(EMPTY_BOX);
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const apply = (width: number, height: number, left: number, top: number, dpr: number) => {
      const shiftX = pixelOriginShift(left, dpr);
      const shiftY = pixelOriginShift(top, dpr);
      const nextWidth = width > shiftX ? width - shiftX : 0;
      const nextHeight = height > shiftY ? height - shiftY : 0;
      setPlotWidthPx(width > 0 ? width * plotFraction : 0);
      setBox((prev) =>
        prev.width === nextWidth &&
        prev.height === nextHeight &&
        prev.shiftX === shiftX &&
        prev.shiftY === shiftY &&
        prev.dpr === dpr
          ? prev
          : { width: nextWidth, height: nextHeight, shiftX, shiftY, dpr },
      );
    };
    const measure = (width: number, height: number, left: number, top: number) => {
      apply(width, height, left, top, readDevicePixelRatio());
    };
    const origin = host.getBoundingClientRect();
    measure(origin.width, origin.height, origin.left, origin.top);
    const stopResolution = watchDevicePixelRatio(() => {
      const next = host.getBoundingClientRect();
      measure(next.width, next.height, next.left, next.top);
    });
    if (typeof ResizeObserver === "undefined") return stopResolution;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const next = host.getBoundingClientRect();
      measure(rect.width, rect.height, next.left, next.top);
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
      stopResolution();
    };
  }, [hostRef, plotFraction]);
  return { plotWidthPx, box };
}
