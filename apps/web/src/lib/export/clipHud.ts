import { CLIP_EXPORT_SIZE_DEFAULT } from "@/lib/export/constants";
import { CT_COLOR, T_COLOR } from "@/lib/radar/radarFrame";
import { currentRound, samplePlayers } from "@/lib/replay/sample";
import type { Replay, Side } from "@/lib/replay/replayTypes";
import {
  DEFUSE_WITH_KIT_SECONDS,
  DEFUSE_WITHOUT_KIT_SECONDS,
  FULL_HEALTH,
  tickRate,
} from "@/lib/shared/constants";
import { liveSituation, roundHudLabel } from "@/lib/stats/hud";
import { currentSide, liveScoreboardPlayers, liveTeams } from "@/lib/stats/liveScore";
import { formatMoney, heldWeaponId, weaponHasMagazine } from "@/lib/weapons/loadout";
import {
  formatClock,
  prettyMap,
  prettyWeapon,
  WEAPON_BY_ID,
  winReasonLabel,
} from "@/lib/weapons/weapons";

/** Share of the frame height used by the top bar. */
export const CLIP_HUD_TOP_FRACTION = 0.1;
/** Share of the frame width kept for each team's player list. */
export const CLIP_HUD_SIDE_FRACTION = 0.18;

const FRAME_BG = "#10161c";
const TEXT = "#e8eef4";
const MUTED = "#8b98a5";
const DEAD = "#5c6770";
const BAR_TRACK = "#24303a";

export interface ClipHudRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClipHudLayout {
  width: number;
  height: number;
  top: number;
  radar: { x: number; y: number; size: number };
  tColumn: ClipHudRect;
  ctColumn: ClipHudRect;
}

export interface ClipHudPlayer {
  name: string;
  side: Side;
  hp: number;
  armor: number;
  money: string;
  weapon: string;
  ammo: string | null;
  alive: boolean;
}

export interface ClipHudDefuse {
  remaining: number;
  haskit: boolean;
  /** 0 at the start of the defuse, 1 when the timer finishes. */
  progress: number;
}

export interface ClipHudState {
  map: string;
  roundLabel: string;
  ctName: string;
  tName: string;
  scoreCt: number;
  scoreT: number;
  /** T alive, then CT alive, matching the left-to-right lists. */
  aliveLabel: string;
  clockLabel: string;
  clockKind: "round" | "bomb" | "freeze";
  bombRemaining: number | null;
  defuse: ClipHudDefuse | null;
  winLabel: string | null;
  playersT: ClipHudPlayer[];
  playersCt: ClipHudPlayer[];
}

export interface ClipHudPainter {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
}

/** Radar centered, T list on the left, CT list on the right, bar across the top. */
export function clipHudLayout(width: number, height: number): ClipHudLayout {
  const top = Math.round(height * CLIP_HUD_TOP_FRACTION);
  const side = Math.round(width * CLIP_HUD_SIDE_FRACTION);
  const radarSize = Math.max(0, Math.min(width - side * 2, height - top));
  const radarX = Math.round((width - radarSize) / 2);
  const radarY = top + Math.round((height - top - radarSize) / 2);
  return {
    width,
    height,
    top,
    radar: { x: radarX, y: radarY, size: radarSize },
    tColumn: { x: 0, y: top, width: radarX, height: height - top },
    ctColumn: {
      x: radarX + radarSize,
      y: top,
      width: width - (radarX + radarSize),
      height: height - top,
    },
  };
}

function playerRow(replay: Replay, index: number, tick: number): ClipHudPlayer | null {
  const snap = samplePlayers(replay, tick)[index];
  const name = replay.players[index]?.name ?? "";
  if (!snap?.present) return null;
  const side = currentSide(replay, index, tick);
  const weaponId = heldWeaponId(snap);
  const weaponKey = weaponId > 0 ? WEAPON_BY_ID[weaponId] : undefined;
  const weapon = weaponKey ? prettyWeapon(weaponKey) : "";
  const ammo = snap.alive && weaponHasMagazine(weaponId) ? `${snap.clip}/${snap.reserve}` : null;
  return {
    name,
    side,
    hp: snap.health,
    armor: snap.armor,
    money: formatMoney(snap.money),
    weapon,
    ammo,
    alive: snap.alive,
  };
}

/**
 * HUD facts for one export frame. Scores, the bomb clock, and the win line
 * come from the same helpers as the live HUD.
 */
export function clipHudState(replay: Replay, tick: number): ClipHudState {
  const teams = liveTeams(replay, tick);
  const sit = liveSituation(replay, tick);
  const round = currentRound(replay, tick);
  const rate = tickRate(replay);
  const origin = round ? (round.freeze_end_tick > 0 ? round.freeze_end_tick : round.start_tick) : 0;
  let clockLabel = formatClock(rate > 0 ? Math.max(0, (tick - origin) / rate) : 0);
  let clockKind: ClipHudState["clockKind"] = "round";
  if (sit.freeze != null) {
    clockLabel = `Freeze ${sit.freeze.toFixed(1)}`;
    clockKind = "freeze";
  } else if (sit.bomb) {
    clockLabel = `C4 ${sit.bomb.remaining.toFixed(1)}`;
    clockKind = "bomb";
  }
  const duration = sit.defuse
    ? sit.defuse.haskit
      ? DEFUSE_WITH_KIT_SECONDS
      : DEFUSE_WITHOUT_KIT_SECONDS
    : 0;
  const defuse = sit.defuse
    ? {
        remaining: sit.defuse.remaining,
        haskit: sit.defuse.haskit,
        progress: duration > 0 ? Math.min(1, Math.max(0, 1 - sit.defuse.remaining / duration)) : 0,
      }
    : null;
  const reason = sit.roundWin?.reason ? winReasonLabel(sit.roundWin.reason) : "";
  const winLabel = sit.roundWin
    ? reason
      ? `${sit.roundWin.winner} wins · ${reason}`
      : `${sit.roundWin.winner} wins`
    : null;
  const playersT: ClipHudPlayer[] = [];
  const playersCt: ClipHudPlayer[] = [];
  for (const index of liveScoreboardPlayers(replay, tick)) {
    const row = playerRow(replay, index, tick);
    if (!row) continue;
    if (row.side === "CT") playersCt.push(row);
    else playersT.push(row);
  }
  return {
    map: prettyMap(replay.header.map_name),
    roundLabel: round ? roundHudLabel(round) : "",
    ctName: teams.ctName,
    tName: teams.tName,
    scoreCt: teams.ct,
    scoreT: teams.t,
    aliveLabel: `${sit.tAlive}v${sit.ctAlive}`,
    clockLabel,
    clockKind,
    bombRemaining: sit.bomb ? sit.bomb.remaining : null,
    defuse,
    winLabel,
    playersT,
    playersCt,
  };
}

function drawPlayers(
  ctx: ClipHudPainter,
  rows: readonly ClipHudPlayer[],
  column: ClipHudRect,
  scale: number,
) {
  const slot = rows.length > 0 ? column.height / rows.length : column.height;
  const pad = 16 * scale;
  rows.forEach((row, index) => {
    const y = column.y + slot * index;
    const color = row.alive ? (row.side === "CT" ? CT_COLOR : T_COLOR) : DEAD;
    const nameSize = Math.round(22 * scale);
    const bodySize = Math.round(16 * scale);
    ctx.fillStyle = color;
    ctx.font = `600 ${nameSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(row.name, column.x + pad, y + pad, column.width - pad * 2);
    const barY = y + pad + nameSize + 8 * scale;
    const barW = column.width - pad * 2;
    const barH = Math.max(4, Math.round(8 * scale));
    ctx.fillStyle = BAR_TRACK;
    ctx.fillRect(column.x + pad, barY, barW, barH);
    ctx.fillStyle = color;
    ctx.fillRect(column.x + pad, barY, barW * Math.min(1, row.hp / FULL_HEALTH), barH);
    ctx.fillStyle = row.alive ? TEXT : MUTED;
    ctx.font = `${bodySize}px ui-sans-serif, system-ui, sans-serif`;
    const stats = `${row.hp} hp · ${row.armor} armor · ${row.money}`;
    ctx.fillText(stats, column.x + pad, barY + barH + 8 * scale, column.width - pad * 2);
    const weapon = row.ammo ? `${row.weapon} ${row.ammo}` : row.weapon;
    if (weapon) {
      ctx.fillStyle = MUTED;
      ctx.fillText(
        weapon,
        column.x + pad,
        barY + barH + 8 * scale + bodySize + 4 * scale,
        column.width - pad * 2,
      );
    }
  });
}

/** Burn the live HUD into the export frame. `layout` is the 16:9 composition. */
export function paintClipHud(
  ctx: ClipHudPainter,
  replay: Replay,
  tick: number,
  layout: ClipHudLayout,
): void {
  const state = clipHudState(replay, tick);
  const scale = layout.height / CLIP_EXPORT_SIZE_DEFAULT;
  const pad = 20 * scale;
  ctx.fillStyle = FRAME_BG;
  ctx.fillRect(0, 0, layout.tColumn.width, layout.top);
  ctx.fillRect(layout.ctColumn.x, 0, layout.ctColumn.width, layout.top);
  ctx.fillRect(layout.radar.x, 0, layout.radar.size, layout.top);

  const title = Math.round(28 * scale);
  const meta = Math.round(18 * scale);
  ctx.textBaseline = "middle";
  ctx.font = `600 ${title}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.fillStyle = T_COLOR;
  ctx.fillText(`${state.tName}  ${state.scoreT}`, pad, layout.top / 2, layout.tColumn.width - pad);
  ctx.textAlign = "right";
  ctx.fillStyle = CT_COLOR;
  ctx.fillText(
    `${state.scoreCt}  ${state.ctName}`,
    layout.width - pad,
    layout.top / 2,
    layout.ctColumn.width - pad,
  );

  ctx.textAlign = "center";
  ctx.fillStyle = TEXT;
  ctx.font = `700 ${Math.round(34 * scale)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(state.aliveLabel, layout.radar.x + layout.radar.size / 2, layout.top * 0.38);
  ctx.fillStyle = MUTED;
  ctx.font = `${meta}px ui-sans-serif, system-ui, sans-serif`;
  const metaLine = [state.map, state.roundLabel, state.clockLabel].filter(Boolean).join(" · ");
  ctx.fillText(metaLine, layout.radar.x + layout.radar.size / 2, layout.top * 0.74);

  drawPlayers(ctx, state.playersT, layout.tColumn, scale);
  drawPlayers(ctx, state.playersCt, layout.ctColumn, scale);

  if (state.defuse) {
    const barH = Math.max(6, Math.round(10 * scale));
    const y = layout.radar.y + layout.radar.size - barH - 8 * scale;
    ctx.fillStyle = BAR_TRACK;
    ctx.fillRect(layout.radar.x, y, layout.radar.size, barH);
    ctx.fillStyle = CT_COLOR;
    ctx.fillRect(layout.radar.x, y, layout.radar.size * state.defuse.progress, barH);
  }

  if (state.winLabel) {
    ctx.fillStyle = state.winLabel.startsWith("CT") ? CT_COLOR : T_COLOR;
    ctx.font = `700 ${Math.round(42 * scale)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      state.winLabel,
      layout.radar.x + layout.radar.size / 2,
      layout.radar.y + layout.radar.size / 2,
    );
  }
}
