/** Named CS2 / FACEIT values. Prefer these over unexplained literals. */

/** GOTV tick rate when the demo header omits one. */
export const DEFAULT_TICK_RATE = 64;

/** Competitive spawn HP (reset each round). */
export const FULL_HEALTH = 100;

/** `player_hurt.hitgroup` (CS2). Keep aligned with `crates/cs2analyzer/src/constants.rs`. */
export const HITGROUP_GENERIC = 0;
export const HITGROUP_HEAD = 1;
export const HITGROUP_CHEST = 2;
export const HITGROUP_STOMACH = 3;
export const HITGROUP_LEFT_ARM = 4;
export const HITGROUP_RIGHT_ARM = 5;
export const HITGROUP_LEFT_LEG = 6;
export const HITGROUP_RIGHT_LEG = 7;
export const HITGROUP_GEAR = 8;

export const HITGROUP_LABELS = [
  "generic",
  "head",
  "chest",
  "stomach",
  "left arm",
  "right arm",
  "left leg",
  "right leg",
  "gear",
] as const;

export function hitgroupLabel(hitgroup: number): string {
  return HITGROUP_LABELS[hitgroup] ?? HITGROUP_LABELS[HITGROUP_GENERIC];
}

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

/** CS2 OT freeze money per player (no pistol round in OT). */
export const OVERTIME_START_MONEY = 10000;

/** Max GOTV files in one habits series. */
export const SERIES_MAX_FILES = 12;

/** Concurrent WASM parse workers (queue the rest). */
export const PARSE_POOL_MAX = 3;

/** Habits overlay: default seconds after freeze end when round length is unknown. */
export const SERIES_HABITS_WINDOW_SECONDS = 20;

/** Habits overlay trail window control range (legacy manual setting). */
export const SERIES_HABITS_WINDOW_MIN_SECONDS = 5;
export const SERIES_HABITS_WINDOW_MAX_SECONDS = 60;
export const SERIES_HABITS_WINDOW_STORAGE_KEY = "cs2analyzer.seriesTrailWindowSec";

/** First-wave util multiset window after freeze (util-set chips). */
export const SERIES_FIRST_WAVE_SECONDS = 8;

/** Min matching Steam IDs to merge "X" and "Team X" roster aliases. */
export const SERIES_TEAM_MERGE_MIN_STEAM_OVERLAP = 3;

/** Overtime side-swap block length. */
export const OVERTIME_BLOCK_ROUNDS = 3;

/** KAST / trade window: teammate kills the attacker. */
export const TRADE_SECONDS = 5;

/** C4 fuse after plant. */
export const BOMB_SECONDS = 40;

/** C4 arm time (hold E). GOTV completed plants are ~3.12s. */
export const PLANT_SECONDS = 3.2;

export const DEFUSE_WITH_KIT_SECONDS = 5;
export const DEFUSE_WITHOUT_KIT_SECONDS = 10;

/** Blind duration below this is ignored in review notes. */
export const MIN_REVIEW_FLASH_SECONDS = 0.4;

export const SMOKE_SECONDS = 18;
export const MOLOTOV_SECONDS = 7;
export const HE_DECOY_SECONDS = 0.5;
export const FLASH_POP_SECONDS = 0.4;

/** Full-face CS2 flash; scales the radar countdown dial around a blinded pawn. */
export const FLASH_FULL_SECONDS = 5.47;

/** How long an HE/flash pop stays drawn after detonate. */
export const HE_BURST_SECONDS = 0.55;
export const FLASH_BURST_SECONDS = 0.35;

/** World-unit gap: nades farther than this are different sites. */
export const NADE_SITE_SEPARATION = 2000;

/** World-unit gap: execute pulses farther than this stay separate. */
export const PULSE_SITE_SEPARATION = 2400;

/** Radar pixels: a landing this close to a drawn callout still counts as near it. */
export const CALLOUT_NEAR_RADIUS = 80;

/** Nearest callout stands alone if it is within this fraction of the next. */
export const CALLOUT_CLOSEST_RATIO = 0.7;

/** Max neighbors listed as "between X, Y, Z". */
export const CALLOUT_BETWEEN_MAX = 3;

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
export const KILL_FEED_SECONDS = 10;

/** Spectator last-hit line stays this long after the enemy hurt. */
export const LAST_HIT_SECONDS = 4;

/** Max kill-feed rows shown at once. */
export const KILL_FEED_MAX_ROWS = 6;

/** Saved-note cards per page on the home screen. */
export const SAVED_NOTES_PAGE_SIZE = 5;

/** Skip a kill line when attacker and victim are closer than this (world units). */
export const KILL_LINE_MIN_LENGTH = 24;

/** Round-clock marks on the scrubber (seconds after freeze). */
export const ROUND_TIMELINE_STEP_SECONDS = 10;

/** GOTV beat after bomb/win before the next round's freeze (round_out ~5s). */
export const ROUND_POST_ROUND_MAX_SECONDS = 5;

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

/** Same cap for callout groups in the layout editor / Util chips. */
export const LAYOUT_GROUP_NAME_MAX = NOTE_GROUP_NAME_MAX;

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
export const SIDEBAR_DEFAULT_WIDTH = 480;
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

/** CS2 buy menu prices. Keep aligned with `crates/cs2analyzer/src/constants.rs`. */
export const COST_GLOCK = 200;
export const COST_USP = 200;
export const COST_P2000 = 200;
export const COST_ELITE = 300;
export const COST_P250 = 300;
export const COST_TEC9 = 500;
export const COST_FIVESEVEN = 500;
export const COST_CZ75 = 500;
export const COST_DEAGLE = 700;
export const COST_REVOLVER = 600;
export const COST_MAC10 = 1050;
export const COST_MP9 = 1250;
export const COST_MP7 = 1500;
export const COST_MP5SD = 1500;
export const COST_UMP45 = 1200;
export const COST_P90 = 2350;
export const COST_BIZON = 1400;
export const COST_GALIL = 1800;
export const COST_FAMAS = 2050;
export const COST_AK47 = 2700;
export const COST_M4A4 = 2900;
export const COST_M4A1S = 2900;
export const COST_SSG08 = 1700;
export const COST_AUG = 3300;
export const COST_SG553 = 3000;
export const COST_AWP = 4750;
export const COST_SCAR20 = 5000;
export const COST_G3SG1 = 5000;
export const COST_NOVA = 1050;
export const COST_XM1014 = 2000;
export const COST_MAG7 = 1300;
export const COST_SAWEDOFF = 1100;
export const COST_M249 = 5200;
export const COST_NEGEV = 1700;
export const COST_TASER = 200;
export const COST_HE = 300;
export const COST_FLASH = 200;
export const COST_SMOKE = 300;
export const COST_MOLLY = 400;
export const COST_INC = 500;
export const COST_DECOY = 50;
export const COST_KEVLAR = 650;
export const COST_HELMET = 350;
export const COST_DEFUSER = 400;
