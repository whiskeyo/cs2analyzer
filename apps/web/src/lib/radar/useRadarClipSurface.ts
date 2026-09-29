import { useEffect, type MutableRefObject, type RefObject } from "react";
import { applyRadarFollowCam } from "@/lib/radar/radarPaintDirty";
import type { RadarView } from "@/lib/radar/maps";
import type { MapCalibration, Replay } from "@/lib/replay/replayTypes";
import {
  paintRadarClipFrame,
  registerRadarClipSurface,
  type ClipFrameCanvas,
} from "@/lib/radar/radarClipSurface";

interface ClipPaintSource {
  tickRef?: MutableRefObject<number>;
  replay: Replay;
  selected: number | null;
  follow: boolean;
  cal: MapCalibration | undefined;
}

type ScenePaint = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tick: number,
) => void;

/** Register the mounted radar canvas so single-playback clip export can paint ticks. */
export function useRadarClipSurface(
  replay: Replay,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  wrapRef: RefObject<HTMLElement | null>,
  view: { current: RadarView },
  propsRef: { current: ClipPaintSource },
  paintSceneRef: { current: ScenePaint },
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    registerRadarClipSurface({
      canvas,
      paintAt(tick) {
        const wrap = wrapRef.current;
        if (!wrap) return;
        const source = propsRef.current;
        if (source.tickRef) source.tickRef.current = tick;
        paintRadarClipFrame(
          canvas,
          wrap,
          tick,
          (width, height) => {
            applyRadarFollowCam(
              view.current,
              width,
              height,
              source.replay,
              tick,
              source.selected,
              source.follow,
              source.cal,
            );
          },
          paintSceneRef.current,
        );
      },
      paintSquare(target: ClipFrameCanvas, size: number, tick: number) {
        const ctx = target.getContext("2d");
        if (!ctx) return;
        if (target.width !== size || target.height !== size) {
          target.width = size;
          target.height = size;
        }
        const source = propsRef.current;
        if (source.tickRef) source.tickRef.current = tick;
        const live = view.current;
        const saved = { scale: live.scale, ox: live.ox, oy: live.oy };
        applyRadarFollowCam(
          live,
          size,
          size,
          source.replay,
          tick,
          source.selected,
          source.follow,
          source.cal,
        );
        try {
          paintSceneRef.current(ctx as CanvasRenderingContext2D, size, size, tick);
        } finally {
          live.scale = saved.scale;
          live.ox = saved.ox;
          live.oy = saved.oy;
        }
      },
    });
    return () => registerRadarClipSurface(null);
  }, [replay, canvasRef, wrapRef, view, propsRef, paintSceneRef]);
}
