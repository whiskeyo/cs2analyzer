import { useEffect, type RefObject } from "react";

/**
 * True when any listed input is `Object.is`-different from the last paint.
 * Pass a fresh array each rAF (literals are fine). Used as the F2 dirty check.
 */
export function canvasInputsChanged(
  last: { current: readonly unknown[] | null },
  inputs: readonly unknown[],
): boolean {
  const prev = last.current;
  if (prev && prev.length === inputs.length) {
    let i = 0;
    for (; i < inputs.length; i++) {
      if (!Object.is(prev[i], inputs[i])) {
        break;
      }
    }
    if (i === inputs.length) {
      return false;
    }
  }
  last.current = inputs;
  return true;
}

/**
 * Shared DPR resize + rAF paint loop for the three map canvases.
 * `paint` should read the latest props/refs; `restartWhen` remounts the loop.
 * `shouldPaint` is the dirty check: skip `paint` when the scene is unchanged.
 * Resize always paints because setting `canvas.width` clears the bitmap.
 */
export function useCanvasLoop(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  wrapRef: RefObject<HTMLElement | null>,
  paint: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  restartWhen: readonly unknown[],
  shouldPaint?: (w: number, h: number) => boolean,
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      const nextW = Math.floor(w * dpr);
      const nextH = Math.floor(h * dpr);
      const resized = canvas.width !== nextW || canvas.height !== nextH;
      if (resized) {
        canvas.width = nextW;
        canvas.height = nextH;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const dirty = shouldPaint?.(w, h) ?? true;
      if (!resized && !dirty) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint(ctx, w, h);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rAF loop reads latest refs
  }, restartWhen);
}
