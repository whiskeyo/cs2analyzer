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

/** How long an HE/flash pop stays drawn after detonate. */
export const HE_BURST_SECONDS = 0.55;
export const FLASH_BURST_SECONDS = 0.35;

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

/** Round-clock marks on the scrubber (seconds after freeze). */
export const ROUND_TIMELINE_STEP_SECONDS = 10;

/** World units: skip pen samples closer than this (keep letter-sized strokes). */
export const PEN_MIN_SAMPLE_DISTANCE = 4;

/** How far interior pen points slide toward their neighbors (0–1). */
export const PEN_SMOOTH_AMOUNT = 0.2;

/** How long a Moment overlay stays on the radar by default. */
export const NOTE_MOMENT_SECONDS = 5;

/** Shortest Moment window the Notes tab will store. */
export const NOTE_MOMENT_MIN_SECONDS = 0.5;

/** Start/end stepper increment in the Notes tab. */
export const NOTE_MOMENT_STEP_SECONDS = 1;

/** Longest overlay group name stored on a stroke. */
export const NOTE_GROUP_NAME_MAX = 40;

/** Default name when squashing pens/arrows into one list row. */
export const NOTE_LAYER_NAME = "Drawings";

/** Default label for a timeline bookmark. */
export const NOTE_BOOKMARK_TITLE = "Bookmark";

/** Radar text label max width (screen px) when the box has not been resized. */
export const NOTE_TEXT_MAX_WIDTH = 160;

/** Smallest text editor / label box (screen px). */
export const NOTE_TEXT_MIN_WIDTH = 128;
export const NOTE_TEXT_MIN_HEIGHT = 40;

/** Screen px before a text-note press counts as a move, not a click. */
export const NOTE_TEXT_DRAG_PX = 4;

/** Undo stack depth for drawings. */
export const DRAW_HISTORY_LIMIT = 80;

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
