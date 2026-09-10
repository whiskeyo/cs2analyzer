import { NOTE_TEXT_MAX_WIDTH, DEFAULT_TICK_RATE, LOOSE_C4_PULSE_HZ } from "@/lib/shared/constants";
import { darkenHexColor } from "@/lib/shared/color";
import { overlayVisible } from "@/lib/notes";
import type { NoteItemRef } from "@/lib/notes/noteGroups";
import type { GrenadeKind } from "@/lib/replay/replayTypes";
import type { Drawing, Note } from "@/lib/notes/types";

type TextLabel = Extract<Drawing, { type: "text" }>;

/** Canvas pixels: flying nade silhouettes (longest SVG side). */
export const NADE_FLIGHT_ICON_SIZE = 20;

export type NadeIcons = Partial<Record<GrenadeKind, HTMLImageElement | null>>;

export function yawToCanvas(yaw: number): number {
  // CS2 eye yaw 0 is +X, but the pawn forward used on radar is 180° from that.
  return ((-yaw + 180) * Math.PI) / 180;
}

/** Inverse of `yawToCanvas` — canvas radians (atan2 screen delta) back to eye yaw. */
export function canvasToYaw(rad: number): number {
  return 180 - (rad * 180) / Math.PI;
}

export function drawC4(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  icon: HTMLImageElement | null,
) {
  const r = 14;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#161208";
  ctx.fill();
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = "#f5d76e";
  ctx.stroke();
  if (icon && icon.complete && icon.naturalWidth > 0) {
    const size = 18;
    ctx.drawImage(icon, at.x - size / 2, at.y - size / 2, size, size);
  } else {
    ctx.fillStyle = "#f5d76e";
    ctx.font = "bold 9px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("C4", at.x, at.y);
  }
}

/** Loose pack: C4 SVG plus a ping so it does not disappear into the radar. */
export function drawLooseC4(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  icon: HTMLImageElement | null,
  tick = 0,
) {
  const wave = 0.5 + 0.5 * Math.sin((tick / DEFAULT_TICK_RATE) * LOOSE_C4_PULSE_HZ * Math.PI * 2);
  const radius = 11 + wave * 7;
  ctx.save();
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(245, 215, 110, ${0.1 + wave * 0.12})`;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(245, 215, 110, ${0.35 + wave * 0.5})`;
  ctx.stroke();
  ctx.restore();

  const size = 20;
  ctx.save();
  ctx.globalAlpha = 0.95;
  if (icon && icon.complete && icon.naturalWidth > 0) {
    ctx.drawImage(icon, at.x - size / 2, at.y - size / 2, size, size);
  } else {
    ctx.fillStyle = "#e8d48a";
    ctx.font = "bold 8px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("C4", at.x, at.y);
  }
  ctx.restore();
}

function iconReady(icon: HTMLImageElement | null | undefined): icon is HTMLImageElement {
  return Boolean(icon && icon.complete && icon.naturalWidth > 0);
}

/** In-flight grenade: weapon SVG, or the old colored dot/diamond if the icon is not ready. */
export function drawNadeFlightHead(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  kind: GrenadeKind,
  color: string,
  icon: HTMLImageElement | null | undefined,
) {
  if (iconReady(icon)) {
    const iw = icon.naturalWidth;
    const ih = icon.naturalHeight || 1;
    const scale = NADE_FLIGHT_ICON_SIZE / Math.max(iw, ih);
    const w = iw * scale;
    const h = ih * scale;
    const x = at.x - w / 2;
    const y = at.y - h / 2;

    // Draw a filled circle backdrop so the SVG stands out on any radar colour.
    // shadowBlur on drawImage is unreliable across browsers for SVG sources.
    const pad = 3;
    const r = Math.max(w, h) / 2 + pad;
    ctx.beginPath();
    ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
    ctx.fillStyle = darkenHexColor(color, 0.45);
    ctx.globalAlpha = 0.72;
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.drawImage(icon, x, y, w, h);
    return;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  if (kind === "he") {
    ctx.save();
    ctx.translate(at.x, at.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.4, -3.4, 6.8, 6.8);
    ctx.restore();
    return;
  }
  ctx.arc(at.x, at.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

/** Analyzer cap so a deep zoom does not turn a smoke/burst into a wall. */
export const NADE_EFFECT_ZOOM_CAP = 1.4;

/** Screen multiplier for linger/burst size. `cap === null` keeps map-relative size. */
export function nadeEffectZoom(scale: number, cap: number | null = NADE_EFFECT_ZOOM_CAP): number {
  const zoom = Math.max(0, scale);
  return cap == null ? zoom : Math.min(cap, zoom);
}

export function drawHeBurst(
  ctx: CanvasRenderingContext2D,
  at: { x: number; y: number },
  color: string,
  progress: number,
  scale: number,
  opacity = 1,
  cap: number | null = NADE_EFFECT_ZOOM_CAP,
) {
  const t = Math.min(1, Math.max(0, progress));
  const zoom = nadeEffectZoom(scale, cap);
  const r = (12 + t * 22) * zoom;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.28 * (1 - t) * opacity;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.85 * (1 - t * 0.65) * opacity;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.45 * (1 - t) * opacity;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(at.x, at.y, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.9 * (1 - t * 0.5) * opacity;
  ctx.lineWidth = 1.6;
  const spike = r + 6 * zoom;
  const inner = r * 0.35;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + t * 0.2;
    ctx.beginPath();
    ctx.moveTo(at.x + Math.cos(a) * inner, at.y + Math.sin(a) * inner);
    ctx.lineTo(at.x + Math.cos(a) * spike, at.y + Math.sin(a) * spike);
    ctx.stroke();
  }
  ctx.restore();
}

export function grenadePosAt(
  points: { tick: number; x: number; y: number; z: number }[],
  tick: number,
): { x: number; y: number } | null {
  if (points.length === 0) return null;
  if (tick <= points[0].tick) return points[0];
  for (let i = 1; i < points.length; i++) {
    if (tick <= points[i].tick) {
      const a = points[i - 1];
      const b = points[i];
      const span = b.tick - a.tick;
      const t = span === 0 ? 1 : (tick - a.tick) / span;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return points[points.length - 1];
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  a: { x: number; y: number },
  b: { x: number; y: number },
  color: string,
  width: number,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const ang = Math.atan2(dy, dx);
  const head = 14;
  const tx = b.x - Math.cos(ang) * head * 0.55;
  const ty = b.y - Math.sin(ang) * head * 0.55;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - head * Math.cos(ang - 0.4), b.y - head * Math.sin(ang - 0.4));
  ctx.lineTo(b.x - head * Math.cos(ang + 0.4), b.y - head * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fill();
}

const TEXT_PAD = 6;
const TEXT_LINE = 15;
const TEXT_FONT = "12px ui-sans-serif, system-ui";

function wrapNote(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    if (para.length === 0) {
      out.push("");
      continue;
    }
    let line = "";
    for (const word of para.split(/(\s+)/)) {
      const next = line + word;
      if (line && ctx.measureText(next).width > maxWidth) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = next;
      }
    }
    if (line.length > 0) out.push(line.trimEnd());
  }
  return out.length > 0 ? out : [""];
}

function textWrapWidth(st: TextLabel): number {
  if (st.box_w == null) return NOTE_TEXT_MAX_WIDTH;
  return Math.max(1, st.box_w - TEXT_PAD * 2);
}

function textBox(
  ctx: CanvasRenderingContext2D,
  st: TextLabel,
  screen: { x: number; y: number },
): { x: number; y: number; w: number; h: number; lines: string[] } {
  ctx.font = TEXT_FONT;
  const wrapW = textWrapWidth(st);
  const lines = wrapNote(ctx, st.text, wrapW);
  let inner = 24;
  for (const line of lines) {
    inner = Math.max(inner, ctx.measureText(line || " ").width);
  }
  const contentW = Math.min(wrapW, inner) + TEXT_PAD * 2;
  const contentH = Math.max(1, lines.length) * TEXT_LINE + TEXT_PAD * 2;
  const w = st.box_w ?? contentW;
  const h = st.box_h ?? contentH;
  return { x: screen.x - w / 2, y: screen.y - h / 2, w, h, lines };
}

export function drawTextLabel(
  ctx: CanvasRenderingContext2D,
  st: TextLabel,
  screen: { x: number; y: number },
) {
  const box = textBox(ctx, st, screen);
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.fillStyle = "#12181f";
  ctx.strokeStyle = st.color;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, 4);
  ctx.fill();
  ctx.stroke();
  ctx.clip();
  ctx.fillStyle = st.color;
  ctx.font = TEXT_FONT;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.globalAlpha = 1;
  for (let i = 0; i < box.lines.length; i++) {
    ctx.fillText(box.lines[i], box.x + TEXT_PAD, box.y + TEXT_PAD + i * TEXT_LINE);
  }
  ctx.restore();
}

export function hitTextLabel(
  ctx: CanvasRenderingContext2D,
  st: TextLabel,
  screen: { x: number; y: number },
  mx: number,
  my: number,
): boolean {
  const box = textBox(ctx, st, screen);
  return mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h;
}

export function findTextRef(
  ctx: CanvasRenderingContext2D,
  note: Note,
  tick: number,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  mx: number,
  my: number,
): NoteItemRef | null {
  for (let i = note.drawings.length - 1; i >= 0; i--) {
    const drawing = note.drawings[i];
    if (!drawing || drawing.type !== "text" || !overlayVisible(drawing, tick)) continue;
    const s = toScreen(drawing.x, drawing.y);
    if (hitTextLabel(ctx, drawing, s, mx, my)) return { kind: "loose", index: i };
  }
  for (let g = note.groups.length - 1; g >= 0; g--) {
    const group = note.groups[g];
    if (!group || group.hidden || !overlayVisible(group, tick)) continue;
    for (let d = group.drawings.length - 1; d >= 0; d--) {
      const drawing = group.drawings[d];
      if (!drawing || drawing.type !== "text" || drawing.hidden) continue;
      const s = toScreen(drawing.x, drawing.y);
      if (hitTextLabel(ctx, drawing, s, mx, my)) {
        return { kind: "group", groupIndex: g, drawingIndex: d };
      }
    }
  }
  return null;
}
