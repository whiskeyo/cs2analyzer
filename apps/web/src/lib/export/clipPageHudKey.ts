import { CLIP_HUD_TIMER_DECIMALS } from "@/lib/export/constants";
import { currentRound, samplePlayers, type SampledPlayer } from "@/lib/replay/sample";
import type { Replay } from "@/lib/replay/replayTypes";
import { SIDEBAR_DEFAULT_WIDTH, tickRate } from "@/lib/shared/constants";
import { liveSituation, roundHudLabel, roundTimeRemaining } from "@/lib/stats/hud";
import { liveScoreboardPlayers, liveTeams } from "@/lib/stats/liveScore";
import { formatClock, prettyMap } from "@/lib/weapons/weapons";

export type ClipHudPanel = "hud" | "economy" | "scoreboard";

export const CLIP_HUD_PANEL_HUD: ClipHudPanel = "hud";
export const CLIP_HUD_PANEL_ECO: ClipHudPanel = "economy";
export const CLIP_HUD_PANEL_SCORE: ClipHudPanel = "scoreboard";

export interface ClipPageHudKey {
  hud: string;
  economy: string;
  scoreboard: string;
}

export interface ClipPageStage {
  x: number;
  y: number;
  width: number;
  height: number;
  sidebar: number;
}

/**
 * Radar stage plus the analyzer sidebar. The sidebar keeps the page width
 * (`SIDEBAR_DEFAULT_WIDTH`); the radar takes the rest of the 16:9 frame.
 */
export function clipPageStage(frameWidth: number, frameHeight: number): ClipPageStage {
  const sidebar = Math.min(SIDEBAR_DEFAULT_WIDTH, Math.max(0, frameWidth));
  return {
    x: 0,
    y: 0,
    width: Math.max(0, frameWidth - sidebar),
    height: frameHeight,
    sidebar,
  };
}

/**
 * Round clock for a clip frame. Same formula as the playback controls:
 * freeze replaces the clock, and the limit is `round?.round_time_s ?? 0`
 * (0 falls back to the competitive defuse length inside `roundTimeRemaining`).
 */
export function clipRoundClockLabel(replay: Replay, tick: number): string {
  const round = currentRound(replay, tick);
  const rate = tickRate(replay);
  const inFreeze = !!round && tick < round.freeze_end_tick;
  if (inFreeze && rate > 0) {
    return `Freeze ${((round.freeze_end_tick - tick) / rate).toFixed(CLIP_HUD_TIMER_DECIMALS)}s`;
  }
  const origin = round?.freeze_end_tick ?? replay.ticks.ticks[0] ?? 0;
  const elapsed = rate > 0 ? Math.max(0, (tick - origin) / rate) : 0;
  return formatClock(roundTimeRemaining(elapsed, round?.round_time_s ?? 0));
}

function timerLabel(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  return seconds.toFixed(CLIP_HUD_TIMER_DECIMALS);
}

function playerToken(player: SampledPlayer): string {
  return [
    player.index,
    player.ct ? "C" : "T",
    player.present ? 1 : 0,
    player.alive ? 1 : 0,
    player.health,
    player.armor,
    player.money,
    player.equip,
    player.gear,
    player.primary,
    player.secondary,
    player.active,
    player.clip,
    player.reserve,
  ].join(".");
}

/**
 * Cheap identity of what the page HUD would show at `tick`.
 * Pawn positions are omitted: the radar is painted every frame, and the
 * overlay only changes when a label, card, or scoreboard cell changes.
 */
export function clipPageHudKey(
  replay: Replay,
  tick: number,
  selected: number | null,
): ClipPageHudKey {
  const round = currentRound(replay, tick);
  const teams = liveTeams(replay, tick);
  const sit = liveSituation(replay, tick);
  const live = new Set(liveScoreboardPlayers(replay, tick));
  const players = samplePlayers(replay, tick)
    .filter((player) => live.has(player.index))
    .map(playerToken)
    .join(",");
  const win = sit.roundWin ? `${sit.roundWin.winner}:${sit.roundWin.reason}` : "";
  const clutch = sit.clutch ? `${sit.clutch.player}:${sit.clutch.vs}:${sit.clutch.side}` : "";
  const picked = selected == null ? "" : String(selected);
  return {
    hud: [
      clipRoundClockLabel(replay, tick),
      prettyMap(replay.header.map_name),
      round ? roundHudLabel(round) : "",
      teams.tName,
      teams.t,
      teams.ctName,
      teams.ct,
      sit.tAlive,
      sit.ctAlive,
      timerLabel(sit.freeze),
      timerLabel(sit.plant?.remaining),
      timerLabel(sit.bomb?.remaining),
      timerLabel(sit.defuse?.remaining),
      sit.defuse?.haskit ? 1 : 0,
      win,
      clutch,
    ].join("|"),
    economy: [teams.tName, teams.t, teams.ctName, teams.ct, picked, players].join("|"),
    scoreboard: [teams.ctName, teams.ct, teams.tName, teams.t, win, picked, players].join("|"),
  };
}

/** Panels whose pixels changed. An empty list means the last raster is still valid. */
export function clipHudPanelsToRaster(
  previous: ClipPageHudKey | null,
  next: ClipPageHudKey,
): ClipHudPanel[] {
  if (!previous) {
    return [CLIP_HUD_PANEL_HUD, CLIP_HUD_PANEL_ECO, CLIP_HUD_PANEL_SCORE];
  }
  const dirty: ClipHudPanel[] = [];
  if (previous.hud !== next.hud) dirty.push(CLIP_HUD_PANEL_HUD);
  if (previous.economy !== next.economy) dirty.push(CLIP_HUD_PANEL_ECO);
  if (previous.scoreboard !== next.scoreboard) dirty.push(CLIP_HUD_PANEL_SCORE);
  return dirty;
}
