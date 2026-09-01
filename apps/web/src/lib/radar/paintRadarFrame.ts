/**
 * Draws a `RadarFrame`. No replay lookups and no decisions beyond canvas
 * mechanics: if something looks wrong on the radar, the frame model says why.
 */

import type { MapCalibration } from "@/lib/replay/replayTypes";
import { drawArrow, drawC4, drawHeBurst, yawToCanvas } from "@/lib/radar/draw";
import { worldOnRadar } from "@/lib/radar/maps";
import type {
  HabitsNadeFilter,
  SeriesOverlay,
  SeriesOverlayDisplay,
} from "@/lib/parse/seriesOverlay";
import { habitsNadeVisible, habitsNadeViewTick, overlayAtPlaySec } from "@/lib/parse/seriesOverlay";
import { formatBlindLeft, NADE_COLORS } from "@/lib/radar/radarFx";
import { FULL_HEALTH } from "@/lib/shared/constants";
import {
  nadeRenderAt,
  RADAR_STYLE,
  type NadeRender,
  type Point,
  type RadarFrame,
} from "./radarFrame";

/** Projects a world position onto the canvas. */
export type ToScreen = (x: number, y: number) => Point;

const LOW_HEALTH = 20;
const HEALTH_BAR_WIDTH = 20;
const TRACER_GLOW_LENGTH = 62;
const TRACER_CORE_LENGTH = 48;
const DIAL_START = -Math.PI / 2;
const DIAL_BACKDROP = "#12181f";

function paintDeathCross(ctx: CanvasRenderingContext2D, toScreen: ToScreen, x: number, y: number) {
  const s = toScreen(x, y);
  ctx.strokeStyle = RADAR_STYLE.deathMarkColor;
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(s.x - 4, s.y - 4);
  ctx.lineTo(s.x + 4, s.y + 4);
  ctx.moveTo(s.x + 4, s.y - 4);
  ctx.lineTo(s.x - 4, s.y + 4);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function circle(ctx: CanvasRenderingContext2D, at: Point, radius: number) {
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
}

/** Pie slice showing how much of a smoke / molly is left. */
function dial(
  ctx: CanvasRenderingContext2D,
  at: Point,
  radius: number,
  left: number,
  color: string,
  opacity = 1,
) {
  ctx.globalAlpha = 0.85 * opacity;
  ctx.fillStyle = DIAL_BACKDROP;
  circle(ctx, at, radius + 1.2);
  ctx.fill();
  ctx.globalAlpha = 0.35 * opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.3;
  circle(ctx, at, radius);
  ctx.stroke();
  if (left <= 0) return;
  ctx.globalAlpha = 0.95 * opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(at.x, at.y);
  ctx.arc(at.x, at.y, radius, DIAL_START, DIAL_START + left * Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

function paintNade(
  ctx: CanvasRenderingContext2D,
  nade: NadeRender,
  toScreen: ToScreen,
  scale: number,
  opacity = 1,
) {
  const color = nade.color;
  if (nade.phase === "flight") {
    ctx.strokeStyle = color;
    ctx.lineWidth = nade.kind === "he" ? 2.2 : 1.8;
    ctx.setLineDash(nade.kind === "he" ? [6, 4] : []);
    ctx.globalAlpha = 0.9 * opacity;
    ctx.beginPath();
    nade.trail.forEach((p, i) => {
      const s = toScreen(p.x, p.y);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    if (!nade.head) {
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }
    const s = toScreen(nade.head.x, nade.head.y);
    if (nade.trail.length > 0) ctx.lineTo(s.x, s.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (nade.kind === "he") {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
      ctx.restore();
      return;
    }
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (nade.phase === "fires") {
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.42 * opacity;
    for (const cell of nade.cells) {
      const s = toScreen(cell.x, cell.y);
      circle(ctx, s, nade.cellRadius);
      ctx.fill();
    }
    dial(
      ctx,
      toScreen(nade.centroid.x, nade.centroid.y),
      nade.dialRadius,
      nade.left,
      color,
      opacity,
    );
    return;
  }

  const at = toScreen(nade.at.x, nade.at.y);
  if (nade.phase === "linger") {
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22 * opacity;
    circle(ctx, at, nade.radius);
    ctx.fill();
    ctx.globalAlpha = 0.4 * opacity;
    ctx.lineWidth = 1.4;
    circle(ctx, at, nade.radius);
    ctx.stroke();
    dial(ctx, at, nade.dialRadius, nade.left, color, opacity);
    return;
  }
  if (nade.phase === "burst") {
    drawHeBurst(ctx, at, color, nade.progress, scale, opacity);
    return;
  }
  ctx.globalAlpha = nade.alpha * opacity;
  ctx.fillStyle = color;
  circle(ctx, at, nade.radius);
  ctx.fill();
}

export function paintRadarFrame(
  ctx: CanvasRenderingContext2D,
  frame: RadarFrame,
  toScreen: ToScreen,
  opts: { scale: number; c4Icon: HTMLImageElement | null },
) {
  if (frame.heatmap.length > 0) {
    ctx.globalAlpha = RADAR_STYLE.heatmapAlpha;
    for (const dot of frame.heatmap) {
      const s = toScreen(dot.x, dot.y);
      ctx.fillStyle = dot.color;
      circle(ctx, s, dot.radius);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  for (const disc of frame.summary) {
    const s = toScreen(disc.x, disc.y);
    ctx.fillStyle = disc.color;
    ctx.strokeStyle = disc.color;
    ctx.globalAlpha = 0.2;
    circle(ctx, s, disc.radius);
    ctx.fill();
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 1.2;
    circle(ctx, s, disc.radius);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const nade of frame.nades) {
    paintNade(ctx, nade, toScreen, opts.scale);
    ctx.globalAlpha = 1;
  }

  for (const tracer of frame.tracers) {
    const origin = toScreen(tracer.x, tracer.y);
    const rad = yawToCanvas(tracer.yaw);
    const dx = Math.cos(rad);
    const dy = Math.sin(rad);
    ctx.strokeStyle = RADAR_STYLE.tracerColor;
    ctx.globalAlpha = tracer.fade * 0.28;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + dx * TRACER_GLOW_LENGTH, origin.y + dy * TRACER_GLOW_LENGTH);
    ctx.stroke();
    ctx.globalAlpha = tracer.fade * 0.95;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + dx * TRACER_CORE_LENGTH, origin.y + dy * TRACER_CORE_LENGTH);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (frame.bomb) {
    drawC4(ctx, toScreen(frame.bomb.x, frame.bomb.y), opts.c4Icon);
  }

  for (const death of frame.deaths) {
    if (death.line) {
      const from = toScreen(death.line.from.x, death.line.from.y);
      const to = toScreen(death.line.to.x, death.line.to.y);
      ctx.strokeStyle = death.line.color;
      ctx.globalAlpha = death.line.alpha;
      ctx.lineWidth = death.line.lineWidth;
      ctx.setLineDash([7, 5]);
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = death.line.color;
      circle(ctx, from, 3);
      ctx.fill();
    }
    const s = toScreen(death.x, death.y);
    ctx.strokeStyle = RADAR_STYLE.deathMarkColor;
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(s.x - 4, s.y - 4);
    ctx.lineTo(s.x + 4, s.y + 4);
    ctx.moveTo(s.x + 4, s.y - 4);
    ctx.lineTo(s.x - 4, s.y + 4);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (frame.opening) {
    const from = toScreen(frame.opening.from.x, frame.opening.from.y);
    const to = toScreen(frame.opening.to.x, frame.opening.to.y);
    drawArrow(ctx, from, to, frame.opening.color, 3.2);
    ctx.fillStyle = frame.opening.color;
    ctx.strokeStyle = DIAL_BACKDROP;
    ctx.lineWidth = 3;
    ctx.font = "bold 11px ui-sans-serif, system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.strokeText("FK", from.x, from.y - 8);
    ctx.fillText("FK", from.x, from.y - 8);
    ctx.strokeText("FD", to.x, to.y - 8);
    ctx.fillText("FD", to.x, to.y - 8);
  }

  for (const trail of frame.trails) {
    ctx.strokeStyle = trail.color;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    trail.points.forEach((pt, i) => {
      const s = toScreen(pt.x, pt.y);
      if (i === 0) ctx.moveTo(s.x, s.y);
      else ctx.lineTo(s.x, s.y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function paintHabitsArrow(
  ctx: CanvasRenderingContext2D,
  toScreen: ToScreen,
  x: number,
  y: number,
  yaw: number,
  color: string,
) {
  const s = toScreen(x, y);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(yawToCanvas(yaw));
  ctx.beginPath();
  const size = 7;
  ctx.moveTo(size + 2, 0);
  ctx.lineTo(-size * 0.7, size * 0.7);
  ctx.lineTo(-size * 0.35, 0);
  ctx.lineTo(-size * 0.7, -size * 0.7);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.92;
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Habits overlay: freeze-aligned paths, optional heatmap, util, and player arrows. */
export function paintHabitsOverlay(
  ctx: CanvasRenderingContext2D,
  overlay: SeriesOverlay,
  display: SeriesOverlayDisplay,
  nadeFilter: HabitsNadeFilter,
  toScreen: ToScreen,
  scale: number,
  opts: {
    showTrails?: boolean;
    showArrows?: boolean;
    nadesOn?: boolean;
    nadeOpacity?: number;
    playSec?: number;
    cal?: MapCalibration;
  } = {},
) {
  const showTrails = opts.showTrails ?? true;
  const showArrows = opts.showArrows ?? false;
  const nadesOn = opts.nadesOn ?? true;
  const nadeOpacity = opts.nadeOpacity ?? 1;
  const playSec = opts.playSec;
  const cal = opts.cal;
  const visible = playSec != null ? overlayAtPlaySec(overlay, playSec) : overlay;
  if (showTrails && display === "heatmap") {
    for (const dot of visible.heatDots) {
      const s = toScreen(dot.x, dot.y);
      ctx.fillStyle = `rgba(255, 210, 90, ${dot.alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 10, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (showTrails && display === "trails") {
    for (const trail of visible.trails) {
      ctx.strokeStyle = trail.color;
      ctx.lineWidth = 2.2;
      ctx.globalAlpha = 0.38;
      ctx.beginPath();
      trail.points.forEach((pt, i) => {
        const s = toScreen(pt.x, pt.y);
        if (i === 0) ctx.moveTo(s.x, s.y);
        else ctx.lineTo(s.x, s.y);
      });
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const trail of visible.trails) {
      if (trail.deathAt) paintDeathCross(ctx, toScreen, trail.deathAt.x, trail.deathAt.y);
    }
  }

  if (showArrows) {
    for (const trail of visible.trails) {
      const head = trail.points.at(-1);
      if (!head) continue;
      if (cal && !worldOnRadar(cal, head.x, head.y)) continue;
      paintHabitsArrow(ctx, toScreen, head.x, head.y, head.yaw, trail.color);
    }
  }

  if (!nadesOn) {
    ctx.globalAlpha = 1;
    return;
  }

  for (const nade of visible.nades) {
    if (!habitsNadeVisible(nade.kind, nadeFilter)) continue;
    const viewTick =
      playSec != null
        ? habitsNadeViewTick(nade, playSec)
        : habitsNadeViewTick(nade, overlay.windowSec);
    const render = nadeRenderAt(nade.grenade, viewTick, nade.tps, scale, nade.roundEndTick);
    if (!render) continue;
    const opacity = (display === "heatmap" ? 0.28 : 1) * nadeOpacity;
    paintNade(ctx, render, toScreen, scale, opacity);
  }
  ctx.globalAlpha = 1;
}

/** The view cone sits under the drawings; pawns and FX sit on top of them. */
export function paintViewCone(
  ctx: CanvasRenderingContext2D,
  frame: RadarFrame,
  toScreen: ToScreen,
) {
  if (!frame.cone) return;
  const s = toScreen(frame.cone.x, frame.cone.y);
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.rotate(yawToCanvas(frame.cone.yaw));
  ctx.fillStyle = frame.cone.color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, frame.cone.radius, -0.55, 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function paintPawns(
  ctx: CanvasRenderingContext2D,
  frame: RadarFrame,
  toScreen: ToScreen,
  showNames: boolean,
) {
  for (const hit of frame.hits) {
    const s = toScreen(hit.x, hit.y);
    ctx.strokeStyle = RADAR_STYLE.deathMarkColor;
    ctx.fillStyle = RADAR_STYLE.deathMarkColor;
    ctx.globalAlpha = hit.innerAlpha;
    circle(ctx, s, hit.innerRadius);
    ctx.fill();
    ctx.globalAlpha = hit.ringAlpha;
    ctx.lineWidth = 2.2;
    circle(ctx, s, hit.ringRadius);
    ctx.stroke();
  }
  for (const flash of frame.flashes) {
    const s = toScreen(flash.x, flash.y);
    ctx.fillStyle = `rgba(255, 248, 200, ${0.12 + flash.intensity * 0.38})`;
    ctx.globalAlpha = 1;
    circle(ctx, s, 11 + flash.intensity * 5);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 236, 150, ${0.45 + flash.intensity * 0.5})`;
    ctx.lineWidth = 2;
    circle(ctx, s, flash.pulseRadius);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (const pawn of frame.pawns) {
    const s = toScreen(pawn.x, pawn.y);
    ctx.globalAlpha = pawn.alive ? 1 : 0.35;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(yawToCanvas(pawn.yaw));
    ctx.beginPath();
    const size = pawn.selected ? 9 : 7;
    ctx.moveTo(size + 2, 0);
    ctx.lineTo(-size * 0.7, size * 0.7);
    ctx.lineTo(-size * 0.35, 0);
    ctx.lineTo(-size * 0.7, -size * 0.7);
    ctx.closePath();
    ctx.fillStyle = pawn.color;
    ctx.fill();
    if (pawn.flash > 0 && pawn.alive) {
      ctx.fillStyle = `rgba(255, 252, 230, ${Math.min(0.88, 0.4 + pawn.flash * 0.35)})`;
      ctx.fill();
    }
    if (pawn.selected) {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    ctx.restore();

    if (pawn.alive && pawn.flash > 0) {
      ctx.fillStyle = NADE_COLORS.flash;
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(formatBlindLeft(pawn.flash), s.x + 12, s.y);
    }

    if (pawn.alive) {
      if (showNames) {
        ctx.fillStyle = "#e8eef4";
        ctx.font = "11px ui-sans-serif, system-ui";
        ctx.textAlign = "center";
        ctx.fillText(pawn.name.slice(0, 12), s.x, s.y + 16);
      }
      ctx.fillStyle = pawn.health > LOW_HEALTH ? "#3dba6a" : RADAR_STYLE.deathMarkColor;
      ctx.fillRect(s.x - 10, s.y + 18, HEALTH_BAR_WIDTH * (pawn.health / FULL_HEALTH), 3);
    }
    ctx.globalAlpha = 1;
  }
}
