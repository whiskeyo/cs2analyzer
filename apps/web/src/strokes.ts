import { PEN_MIN_SAMPLE_DISTANCE, PEN_SMOOTH_AMOUNT } from "./constants";

export interface Point {
  x: number;
  y: number;
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Drop samples that sit on top of each other. Always keeps the last point. */
export function spacePoints(points: Point[], minDist = PEN_MIN_SAMPLE_DISTANCE): Point[] {
  if (points.length < 2) return points;
  const out: Point[] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    if (dist(points[i], out[out.length - 1]) >= minDist) out.push(points[i]);
  }
  const last = points[points.length - 1];
  if (dist(last, out[out.length - 1]) > 0) out.push(last);
  return out;
}

/** Light Laplacian: kills tremor without flattening small letters. */
function lightSmooth(points: Point[], amount = PEN_SMOOTH_AMOUNT): Point[] {
  if (points.length < 3) return points;
  const out: Point[] = [{ ...points[0] }];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const p = points[i];
    const next = points[i + 1];
    const mx = (prev.x + next.x) / 2;
    const my = (prev.y + next.y) / 2;
    out.push({
      x: p.x + (mx - p.x) * amount,
      y: p.y + (my - p.y) * amount,
    });
  }
  out.push({ ...points[points.length - 1] });
  return out;
}

/** Keep the handwriting path; only drop stacked samples and a bit of tremor. */
export function simplifyStroke(points: Point[]): Point[] {
  return lightSmooth(spacePoints(points));
}

/** Quadratic midpoints — follows the hand, no Catmull-Rom overshoot on tight letters. */
export function drawSmoothLine(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  if (pts.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 1) {
    ctx.stroke();
    return;
  }
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.stroke();
    return;
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) / 2;
    const midY = (pts[i].y + pts[i + 1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}
