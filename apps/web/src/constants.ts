/** Named CS2 / FACEIT values. Prefer these over unexplained literals. */

/** GOTV tick rate when the demo header omits one. */
export const DEFAULT_TICK_RATE = 64;

/** Competitive spawn HP (reset each round). */
export const FULL_HEALTH = 100;

/** FACEIT knife round: max freeze equipment and no gun kill. */
export const KNIFE_ROUND_MAX_EQUIPMENT = 200;

/** Average freeze equipment treated as an eco. */
export const ECO_MAX_EQUIPMENT = 2000;

/** Average freeze equipment still a force-buy (below this is not a full buy). */
export const FORCE_BUY_MAX_EQUIPMENT = 3700;

/** MR12: rounds in one half of regulation. */
export const REGULATION_ROUNDS_PER_HALF = 12;

/** MR12: both halves (12+12). */
export const REGULATION_ROUNDS = 24;

/** First 1-based round number of overtime. */
export const FIRST_OVERTIME_ROUND = 25;

/** Overtime side-swap block length. */
export const OVERTIME_BLOCK_ROUNDS = 3;

/** KAST / trade window: teammate kills the attacker. */
export const TRADE_SECONDS = 5;

/** C4 fuse after plant. */
export const BOMB_SECONDS = 40;

export const DEFUSE_WITH_KIT_SECONDS = 5;
export const DEFUSE_WITHOUT_KIT_SECONDS = 10;

/** Blind duration below this is ignored in review notes. */
export const MIN_REVIEW_FLASH_SECONDS = 0.4;

export const SMOKE_SECONDS = 18;
export const MOLOTOV_SECONDS = 7;
export const HE_DECOY_SECONDS = 0.5;
export const FLASH_POP_SECONDS = 0.4;

/** World-unit gap: nades farther than this are different sites. */
export const NADE_SITE_SEPARATION = 2000;

/** World-unit gap: execute pulses farther than this stay separate. */
export const PULSE_SITE_SEPARATION = 2400;

/** Valve overview texture size. `bombA_x` fractions are relative to this. */
export const RADAR_OVERVIEW_SIZE = 1024;

/** World units: inside this of bombsite A or B is that site, otherwise Mid. */
export const SITE_CALLOUT_RADIUS = 1800;

/** A/B only if that site is clearly closer; otherwise Mid. */
export const SITE_CALLOUT_CLOSER_RATIO = 0.85;

/** Seconds after freeze before we look for a T site take. */
export const T_PUSH_DELAY_SECONDS = 8;

/** How often to sample T positions while hunting a take. */
export const T_PUSH_STEP_SECONDS = 2;

/** Alive Ts that must still be grouped to count as a take. */
export const T_PUSH_MIN_PLAYERS = 3;

/** Max average distance from the T centroid (world units). */
export const T_PUSH_MAX_SPREAD = 1100;

/** How far the T centroid must travel from freeze (world units). */
export const T_PUSH_MIN_MOVED = 750;

/** Seconds of playback kept after an Action beat. */
export const ACTION_HIGHLIGHT_SECONDS = 8;

/** Kill-feed rows stay this long. */
export const KILL_FEED_SECONDS = 6;

/** Skip a kill line when attacker and victim are closer than this (world units). */
export const KILL_LINE_MIN_LENGTH = 24;

/** Opening-duel arrow on radar, screen pixels from the attacker. */
export const OPENING_ARROW_MAX_PX = 72;

/** Undo stack depth for drawings. */
export const DRAW_HISTORY_LIMIT = 80;

/** World units: skip pen samples closer than this (keep letter-sized strokes). */
export const PEN_MIN_SAMPLE_DISTANCE = 4;

/** How far interior pen points slide toward their neighbors (0–1). */
export const PEN_SMOOTH_AMOUNT = 0.2;

/** Debounce before writing the review overlay to IndexedDB. */
export const PROJECT_SAVE_DEBOUNCE_MS = 400;

/** Side panel: current layout is the floor; drag left to grow (CSS px). */
export const SIDEBAR_MIN_WIDTH = 400;
export const SIDEBAR_MAX_WIDTH = 640;

/** Leave at least this much of `.stage` for the radar while resizing. */
export const RADAR_MIN_WIDTH = 360;

/** CS2 round-win reason codes (`m_iRoundWinStatus` / game events). */
export const WIN_REASON_BOMB = 1;
export const WIN_REASON_DEFUSE = 7;
export const WIN_REASON_CT_ELIM = 8;
export const WIN_REASON_T_ELIM = 9;
export const WIN_REASON_DRAW = 10;
export const WIN_REASON_TIME = 12;
export const WIN_REASON_T_SURRENDER = 17;
export const WIN_REASON_CT_SURRENDER = 18;

/** Published HLTV 2.0 rating weights. */
export const HLTV_IMPACT_KILLS_PER_ROUND = 2.13;
export const HLTV_IMPACT_ASSISTS_PER_ROUND = 0.42;
export const HLTV_IMPACT_OFFSET = 0.41;
export const HLTV_RATING_KAST = 0.0073;
export const HLTV_RATING_KILLS_PER_ROUND = 0.3591;
export const HLTV_RATING_DEATHS_PER_ROUND = -0.5329;
export const HLTV_RATING_IMPACT = 0.2372;
export const HLTV_RATING_ADR = 0.0032;
export const HLTV_RATING_OFFSET = 0.1587;

export function tickRate(replay: { header: { tick_rate: number } }): number {
  return replay.header.tick_rate || DEFAULT_TICK_RATE;
}
