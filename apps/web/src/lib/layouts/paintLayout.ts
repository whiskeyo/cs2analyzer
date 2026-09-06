import { calloutCentroid } from "@/lib/layout/regions.ts";
import { calloutColor } from "./layout";
import type { RadarView } from "./maps";
import type { LayoutCallout, LayoutDraft, LayoutFloor, Point } from "./types";

export function paintCalloutRegions(
  ctx: CanvasRenderingContext2D,
  callouts: LayoutCallout[],
  floor: LayoutFloor,
  selectedIds: string[],
  toScreen: (p: Point) => { x: number; y: number },
): void {
  for (const callout of callouts) {
    if (callout.floor !== floor) continue;
    const selected = selectedIds.includes(callout.id);
    const vertices = selected && selectedIds.length === 1;
    const color = calloutColor(callout.id);
    for (const region of callout.regions) {
      ctx.beginPath();
      if (region.kind === "circle") {
        const c = toScreen({ x: region.x, y: region.y });
        const rim = toScreen({ x: region.x + region.radius, y: region.y });
        ctx.arc(c.x, c.y, Math.max(0, rim.x - c.x), 0, Math.PI * 2);
      } else {
        if (region.points.length < 1) continue;
        const first = toScreen(region.points[0]!);
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < region.points.length; i++) {
          const s = toScreen(region.points[i]!);
          ctx.lineTo(s.x, s.y);
        }
        ctx.closePath();
      }
      ctx.fillStyle = color;
      ctx.globalAlpha = selected ? 0.38 : 0.22;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color;
      ctx.lineWidth = selected ? 2.4 : 1.5;
      ctx.stroke();
      if (vertices) {
        const handles =
          region.kind === "circle"
            ? [
                { x: region.x, y: region.y },
                { x: region.x + region.radius, y: region.y },
              ]
            : region.points;
        for (const p of handles) {
          const s = toScreen(p);
          ctx.beginPath();
          ctx.arc(s.x, s.y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = "#0b0e12";
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }
    const c = toScreen(calloutCentroid(callout));
    ctx.font = "bold 12px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#12181f";
    ctx.fillStyle = color;
    ctx.strokeText(callout.name, c.x, c.y);
    ctx.fillText(callout.name, c.x, c.y);
  }
}

export function paintDraft(
  ctx: CanvasRenderingContext2D,
  draft: LayoutDraft,
  cursor: Point | null,
  toScreen: (p: Point) => { x: number; y: number },
): void {
  const color = "#e8eef4";
  ctx.strokeStyle = color;
  ctx.fillStyle = "rgba(232, 238, 244, 0.12)";
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 4]);
  if (draft.kind === "polygon") {
    const pts = draft.points;
    if (pts.length > 0) {
      ctx.beginPath();
      const origin = toScreen(pts[0]!);
      ctx.moveTo(origin.x, origin.y);
      for (let i = 1; i < pts.length; i++) {
        const s = toScreen(pts[i]!);
        ctx.lineTo(s.x, s.y);
      }
      if (cursor) {
        const s = toScreen(cursor);
        ctx.lineTo(s.x, s.y);
      }
      ctx.stroke();
      for (const p of pts) {
        const s = toScreen(p);
        ctx.beginPath();
        ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
        ctx.setLineDash([]);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.setLineDash([5, 4]);
      }
    }
  } else if (draft.kind === "rect") {
    const a = toScreen(draft.start);
    const b = toScreen(draft.end);
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    ctx.beginPath();
    ctx.rect(x, y, Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    ctx.fill();
    ctx.stroke();
  } else {
    const c = toScreen(draft.start);
    const e = toScreen(draft.end);
    ctx.beginPath();
    ctx.arc(c.x, c.y, Math.hypot(e.x - c.x, e.y - c.y), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

export function paintLayoutFrame(
  ctx: CanvasRenderingContext2D,
  args: {
    w: number;
    h: number;
    view: RadarView;
    floor: LayoutFloor;
    callouts: LayoutCallout[];
    selectedIds: string[];
    draft: LayoutDraft | null;
    cursor: Point | null;
    image: CanvasImageSource | null;
    toScreen: (p: Point) => { x: number; y: number };
    fit: number;
    baseX: number;
    baseY: number;
  },
): void {
  ctx.clearRect(0, 0, args.w, args.h);
  const { fit, baseX, baseY, view } = args;
  if (args.image) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(args.image, baseX, baseY, fit * view.scale, fit * view.scale);
  } else {
    ctx.fillStyle = "#12171d";
    ctx.fillRect(baseX, baseY, fit * view.scale, fit * view.scale);
  }
  paintCalloutRegions(ctx, args.callouts, args.floor, args.selectedIds, args.toScreen);
  if (args.draft) paintDraft(ctx, args.draft, args.cursor, args.toScreen);
}
