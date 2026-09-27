type ToScreen = (x: number, y: number) => { x: number; y: number };

const CLUTCH_WON_COLOR = "#7dcea0";
const CLUTCH_LOST_COLOR = "#ff8a8a";
const CLUTCH_LABEL_HALO = "#12181f";

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
}

/** Dots at clutch-start positions. Won and lost use the review-note colours. */
export function paintClutchMarks(
  ctx: CanvasRenderingContext2D,
  marks: readonly {
    x: number;
    y: number;
    vs: number;
    won: boolean;
    placed: boolean;
    player: number;
    tick: number;
  }[],
  toScreen: ToScreen,
  tick: number,
  selected: number | null,
) {
  ctx.save();
  ctx.font = "bold 10px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  for (const mark of marks) {
    if (!mark.placed) continue;
    const s = toScreen(mark.x, mark.y);
    const hot = mark.tick === tick || (selected != null && mark.player === selected);
    const color = mark.won ? CLUTCH_WON_COLOR : CLUTCH_LOST_COLOR;
    const radius = hot ? 7 : 5.5;
    ctx.globalAlpha = hot ? 0.95 : 0.72;
    ctx.fillStyle = color;
    circle(ctx, s.x, s.y, radius);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = CLUTCH_LABEL_HALO;
    ctx.lineWidth = hot ? 2 : 1.25;
    circle(ctx, s.x, s.y, radius);
    ctx.stroke();
    const label = `1v${mark.vs}`;
    ctx.lineWidth = 3;
    ctx.strokeText(label, s.x, s.y - 8);
    ctx.fillStyle = color;
    ctx.fillText(label, s.x, s.y - 8);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
