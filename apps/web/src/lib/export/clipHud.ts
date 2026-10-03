import { CLIP_EXPORT_SIZE_DEFAULT, CLIP_HUD_TIMER_DECIMALS } from "@/lib/export/constants";
import { visibleKillFeed } from "@/lib/radar/killFeed";
import { CT_COLOR, T_COLOR } from "@/lib/radar/radarFrame";
import { attackerLabel, playerLabel } from "@/lib/replay/playerLabel";
import { currentRound, samplePlayers } from "@/lib/replay/sample";
import type { Replay, Round, Side } from "@/lib/replay/replayTypes";
import {
  BOMB_SECONDS,
  DEFUSE_WITH_KIT_SECONDS,
  DEFUSE_WITHOUT_KIT_SECONDS,
  FULL_HEALTH,
  tickRate,
} from "@/lib/shared/constants";
import { liveSituation, roundHudLabel, roundTimeRemaining } from "@/lib/stats/hud";
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
  measureText(text: string): { width: number };
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
 * Burned-in clip clock. After a plant this stays on the 40s fuse for the rest
 * of the round: a fake defuse does not move it, a real defuse freezes the
 * reading from that tick, and an explosion holds `C4 0.0`. The next round
 * counts down from freeze end again. This is not the live bomb chip, which
 * hides once the fuse is no longer running.
 */
export function clipClockLabel(replay: Replay, tick: number): string {
  const sit = liveSituation(replay, tick);
  const round = currentRound(replay, tick);
  const rate = tickRate(replay);
  const origin = round ? (round.freeze_end_tick > 0 ? round.freeze_end_tick : round.start_tick) : 0;
  const elapsed = rate > 0 ? Math.max(0, (tick - origin) / rate) : 0;
  if (sit.freeze != null) return `Freeze ${sit.freeze.toFixed(CLIP_HUD_TIMER_DECIMALS)}`;
  if (round) {
    const planted = plantedClipClock(replay, round, tick, rate);
    if (planted) return planted.clockLabel;
  }
  return formatClock(roundTimeRemaining(elapsed, round?.round_time_s ?? 0));
}

export function clipHudState(replay: Replay, tick: number): ClipHudState {
  const teams = liveTeams(replay, tick);
  const sit = liveSituation(replay, tick);
  const round = currentRound(replay, tick);
  const clockLabel = clipClockLabel(replay, tick);
  const clockKind: ClipHudState["clockKind"] =
    sit.freeze != null ? "freeze" : clockLabel.startsWith("C4 ") ? "bomb" : "round";
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

/** `C4 12.3` from a fuse reading. Zero stays `C4 0.0`. */
function c4ClockLabel(seconds: number): string {
  return `C4 ${Math.max(0, seconds).toFixed(1)}`;
}

/**
 * Clip clock after `bomb_planted` in this round. Counts the 40s fuse from the
 * plant tick. A fake defuse does not touch it. A real defuse freezes the
 * reading from that tick; an explosion holds `C4 0.0`. The next round has no
 * plant yet, so the caller keeps the round countdown. This is not `sit.bomb`:
 * the live chip hides when the fuse is no longer running.
 */
function plantedClipClock(
  replay: Replay,
  round: Round,
  tick: number,
  rate: number,
): { clockLabel: string; clockKind: "bomb" } | null {
  if (!(rate > 0)) return null;
  let plantTick = -1;
  let stopped: "defused" | "exploded" | null = null;
  let frozen = 0;
  for (const event of replay.bombEvents) {
    if (event.tick > tick || event.tick < round.start_tick || event.tick > round.end_tick) {
      continue;
    }
    if (event.kind === "planted") {
      plantTick = event.tick;
      stopped = null;
    } else if (event.kind === "defused" && plantTick >= 0 && event.tick >= plantTick) {
      stopped = "defused";
      frozen = BOMB_SECONDS - (event.tick - plantTick) / rate;
    } else if (event.kind === "exploded" && plantTick >= 0 && event.tick >= plantTick) {
      stopped = "exploded";
    }
  }
  if (plantTick < 0) return null;
  if (stopped === "exploded") return { clockLabel: c4ClockLabel(0), clockKind: "bomb" };
  if (stopped === "defused") return { clockLabel: c4ClockLabel(frozen), clockKind: "bomb" };
  return {
    clockLabel: c4ClockLabel(BOMB_SECONDS - (tick - plantTick) / rate),
    clockKind: "bomb",
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
    if (!row.alive) {
      ctx.font = `${bodySize}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(
        row.money,
        column.x + pad,
        y + pad + nameSize + 8 * scale,
        column.width - pad * 2,
      );
      return;
    }
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

function killNameColor(replay: Replay, index: number, tick: number): string {
  if (index < 0) return TEXT;
  return currentSide(replay, index, tick) === "CT" ? CT_COLOR : T_COLOR;
}

/** Simple text feed for the painted fallback. Same rows as the page kill feed. */
function drawKillFeed(
  ctx: ClipHudPainter,
  replay: Replay,
  tick: number,
  layout: ClipHudLayout,
  scale: number,
): void {
  const kills = visibleKillFeed(replay, tick);
  if (kills.length === 0) return;
  const size = Math.round(16 * scale);
  const rowH = size + 6 * scale;
  const pad = 12 * scale;
  ctx.font = `600 ${size}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  kills.forEach((kill, index) => {
    const parts: { text: string; color: string }[] = [
      {
        text: attackerLabel(replay, kill.attacker),
        color: killNameColor(replay, kill.attacker, kill.tick),
      },
    ];
    if (kill.assister >= 0) {
      parts.push({ text: " + ", color: MUTED });
      parts.push({
        text: playerLabel(replay.players[kill.assister]),
        color: killNameColor(replay, kill.assister, kill.tick),
      });
    }
    parts.push({ text: `  ${prettyWeapon(kill.weapon)}  `, color: MUTED });
    parts.push({
      text: playerLabel(replay.players[kill.victim]),
      color: killNameColor(replay, kill.victim, kill.tick),
    });
    let x = layout.radar.x + layout.radar.size - pad;
    const y = layout.radar.y + pad + index * rowH;
    for (let part = parts.length - 1; part >= 0; part -= 1) {
      const piece = parts[part];
      if (!piece) continue;
      x -= ctx.measureText(piece.text).width;
      ctx.fillStyle = piece.color;
      ctx.fillText(piece.text, x, y);
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
  drawKillFeed(ctx, replay, tick, layout, scale);

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
