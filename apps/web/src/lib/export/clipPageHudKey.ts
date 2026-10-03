import { clipClockLabel } from "@/lib/export/clipHud";
import { CLIP_HUD_TIMER_DECIMALS } from "@/lib/export/constants";
import { currentRound, samplePlayers, type SampledPlayer } from "@/lib/replay/sample";
import type { Kill, Replay } from "@/lib/replay/replayTypes";
import { KILL_FEED_MAX_ROWS, KILL_FEED_SECONDS, tickRate } from "@/lib/shared/constants";
import { liveSituation, roundHudLabel } from "@/lib/stats/hud";
import { liveScoreboardPlayers, liveTeams } from "@/lib/stats/liveScore";
import { recentKills } from "@/lib/stats/stats";
import { prettyMap } from "@/lib/weapons/weapons";

export type ClipHudPanel = "hud" | "economy" | "feed";

export const CLIP_HUD_PANEL_HUD: ClipHudPanel = "hud";
export const CLIP_HUD_PANEL_ECO: ClipHudPanel = "economy";
export const CLIP_HUD_PANEL_FEED: ClipHudPanel = "feed";

export interface ClipPageHudKey {
  hud: string;
  economy: string;
  feed: string;
}

export interface ClipPageStage {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The clip is the radar plus the page HUD. The analyzer sidebar is not in the
 * frame, so the radar uses the full 16:9 size.
 */
export function clipPageStage(frameWidth: number, frameHeight: number): ClipPageStage {
  return {
    x: 0,
    y: 0,
    width: Math.max(0, frameWidth),
    height: Math.max(0, frameHeight),
  };
}

/** Same burned-in clock as the painted fallback, including a fuse held after the bomb is done. */
export function clipRoundClockLabel(replay: Replay, tick: number): string {
  return clipClockLabel(replay, tick);
}

function timerLabel(seconds: number | null | undefined): string {
  if (seconds == null) return "";
  return seconds.toFixed(CLIP_HUD_TIMER_DECIMALS);
}

function killToken(kill: Kill): string {
  return [
    kill.tick,
    kill.attacker,
    kill.victim,
    kill.assister,
    kill.assisted_flash ? 1 : 0,
    kill.weapon,
    kill.headshot ? 1 : 0,
    kill.noscope ? 1 : 0,
    kill.through_smoke ? 1 : 0,
    kill.wallbang ? 1 : 0,
    kill.attacker_blind ? 1 : 0,
    kill.attacker_airborne ? 1 : 0,
  ].join(".");
}

/** Visible kill-feed rows. The raster stays put until one of these changes. */
function clipKillFeedKey(replay: Replay, tick: number): string {
  const rate = tickRate(replay);
  return recentKills(replay, tick, rate * KILL_FEED_SECONDS, KILL_FEED_MAX_ROWS)
    .map(killToken)
    .join(",");
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
 * overlay only changes when a label or a player card changes.
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
      prettyMap(replay.header.map_name),
      round ? roundHudLabel(round) : "",
      teams.tName,
      teams.t,
      teams.ctName,
      teams.ct,
      sit.tAlive,
      sit.ctAlive,
      clipClockLabel(replay, tick),
      timerLabel(sit.plant?.remaining),
      timerLabel(sit.bomb?.remaining),
      timerLabel(sit.defuse?.remaining),
      sit.defuse?.haskit ? 1 : 0,
      win,
      clutch,
    ].join("|"),
    economy: [teams.tName, teams.t, teams.ctName, teams.ct, picked, players].join("|"),
    feed: clipKillFeedKey(replay, tick),
  };
}

/** Panels whose pixels changed. An empty list means the last raster is still valid. */
export function clipHudPanelsToRaster(
  previous: ClipPageHudKey | null,
  next: ClipPageHudKey,
): ClipHudPanel[] {
  if (!previous) {
    return [CLIP_HUD_PANEL_HUD, CLIP_HUD_PANEL_ECO, CLIP_HUD_PANEL_FEED];
  }
  const dirty: ClipHudPanel[] = [];
  if (previous.hud !== next.hud) dirty.push(CLIP_HUD_PANEL_HUD);
  if (previous.economy !== next.economy) dirty.push(CLIP_HUD_PANEL_ECO);
  if (previous.feed !== next.feed) dirty.push(CLIP_HUD_PANEL_FEED);
  return dirty;
}
