import { useEffect, type MutableRefObject, type RefObject } from "react";
import { clipExportFrame } from "@/lib/export/constants";
import { clipHudLayout, paintClipHud } from "@/lib/export/clipHud";
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
      paintFrame(target: ClipFrameCanvas, height: number, tick: number) {
        const frame = clipExportFrame(height);
        const ctx = target.getContext("2d");
        if (!ctx) return;
        if (target.width !== frame.width || target.height !== frame.height) {
          target.width = frame.width;
          target.height = frame.height;
        }
        const layout = clipHudLayout(frame.width, frame.height);
        const source = propsRef.current;
        if (source.tickRef) source.tickRef.current = tick;
        const live = view.current;
        const saved = { scale: live.scale, ox: live.ox, oy: live.oy };
        const paintCtx = ctx as CanvasRenderingContext2D;
        applyRadarFollowCam(
          live,
          layout.radar.size,
          layout.radar.size,
          source.replay,
          tick,
          source.selected,
          source.follow,
          source.cal,
        );
        try {
          paintCtx.fillStyle = "#10161c";
          paintCtx.fillRect(0, 0, frame.width, frame.height);
          paintCtx.save();
          paintCtx.beginPath();
          paintCtx.rect(layout.radar.x, layout.radar.y, layout.radar.size, layout.radar.size);
          paintCtx.clip();
          paintCtx.translate(layout.radar.x, layout.radar.y);
          paintSceneRef.current(paintCtx, layout.radar.size, layout.radar.size, tick);
          paintCtx.restore();
          paintClipHud(paintCtx, source.replay, tick, layout);
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
