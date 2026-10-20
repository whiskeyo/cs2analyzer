//! Named CS2 / FACEIT values. Prefer these over unexplained literals.

/// GOTV tick rate when the demo does not report `tick_interval`.
pub const DEFAULT_TICK_RATE: f32 = 64.0;

/// Keep one snapshot every N demo ticks (`64 / 4` ≈ 16 Hz).
pub const DEFAULT_TICK_STRIDE: u32 = 4;

/// Competitive spawn HP (reset each round).
pub const FULL_HEALTH: i32 = 100;

/// `player_hurt.hitgroup` (CS2). Keep aligned with `apps/web/src/lib/shared/constants.ts`.
pub const HITGROUP_GENERIC: u8 = 0;
pub const HITGROUP_HEAD: u8 = 1;
pub const HITGROUP_CHEST: u8 = 2;
pub const HITGROUP_STOMACH: u8 = 3;
pub const HITGROUP_LEFT_ARM: u8 = 4;
pub const HITGROUP_RIGHT_ARM: u8 = 5;
pub const HITGROUP_LEFT_LEG: u8 = 6;
pub const HITGROUP_RIGHT_LEG: u8 = 7;
pub const HITGROUP_GEAR: u8 = 8;

/// FACEIT knife round: max freeze equipment and no gun kill.
pub const KNIFE_ROUND_MAX_EQUIPMENT: i32 = 200;

/// Average freeze equipment treated as an eco.
/// Keep aligned with `apps/web/src/lib/shared/constants.ts`.
pub const ECO_MAX_EQUIPMENT: i32 = 2000;

/// Average freeze equipment still a force-buy (below this is not a full buy).
/// Keep aligned with `apps/web/src/lib/shared/constants.ts`.
pub const FORCE_BUY_MAX_EQUIPMENT: i32 = 3700;

/// Fallback when the next freeze is still 0–0 (FACEIT knife reset). Kevlar is 650.
pub const KNIFE_ROUND_RESET_MAX_EQUIPMENT: i32 = 1000;

/// MR12: rounds in one half of regulation.
pub const REGULATION_ROUNDS_PER_HALF: u32 = 12;

/// MR12: both halves (12+12).
pub const REGULATION_ROUNDS: u32 = 24;

/// First 1-based round number of overtime.
pub const FIRST_OVERTIME_ROUND: u32 = 25;

/// Tournament-config convar defaults. Always sent as `MatchInfo.convars.defaults`.
///
/// Strings are what a tournament server sends. Sources:
///
/// - Swiss LAN CS2 ruleset, Match Settings
///   (<https://rules.switzerlan.ch/rules/cs2/>): `mp_maxrounds` 24,
///   `mp_roundtime` 1.92, `mp_startmoney` 800, `mp_buytime` 20, `mp_c4timer` 40,
///   `mp_overtime_maxrounds` 6, `mp_overtime_startmoney` 12500.
/// - Tournament GOTV in `test-demos/`: the BLAST Nuke demo sends
///   `mp_roundtime_defuse` `"1.92"` (bomb-map round length, same as
///   `mp_roundtime`) and `mp_overtime_startmoney` `"12500"`. It omits
///   `mp_maxmoney`, so the table still carries the competitive cap `"16000"`.
///
/// `mp_freezetime` is not in this table. Organizers set 15 or 20, so only the
/// demo value is kept. Names are sorted. This list is the only copy of these
/// strings. [`OVERTIME_START_MONEY`] is parsed from `mp_overtime_startmoney`
/// here, so there is no second literal (the old hardcoded 10000 is not used).
pub const CONVAR_DEFAULTS: &[(&str, &str)] = &[
    ("mp_buytime", "20"),
    ("mp_c4timer", "40"),
    ("mp_maxmoney", "16000"),
    ("mp_maxrounds", "24"),
    ("mp_overtime_maxrounds", "6"),
    ("mp_overtime_startmoney", "12500"),
    ("mp_roundtime", "1.92"),
    ("mp_roundtime_defuse", "1.92"),
    ("mp_startmoney", "800"),
];

/// OT freeze money per player, parsed from [`CONVAR_DEFAULTS`]
/// `mp_overtime_startmoney` (12500). Keep aligned with
/// `apps/web/src/lib/shared/constants.ts`.
pub const OVERTIME_START_MONEY: i32 = convar_default_i32("mp_overtime_startmoney");

/// Round count from [`CONVAR_DEFAULTS`] (`mp_maxrounds`, `mp_overtime_maxrounds`).
pub(crate) const fn convar_default_u32(name: &str) -> u32 {
    let value = convar_default_i32(name);
    if value < 0 {
        panic!("convar default is negative");
    }
    value as u32
}

const fn convar_default_i32(name: &str) -> i32 {
    parse_decimal_i32(convar_default_str(name))
}

const fn convar_default_str(name: &str) -> &'static str {
    let mut index = 0;
    while index < CONVAR_DEFAULTS.len() {
        if bytes_eq(CONVAR_DEFAULTS[index].0.as_bytes(), name.as_bytes()) {
            return CONVAR_DEFAULTS[index].1;
        }
        index += 1;
    }
    panic!("CONVAR_DEFAULTS is missing the named convar");
}

const fn bytes_eq(left: &[u8], right: &[u8]) -> bool {
    if left.len() != right.len() {
        return false;
    }
    let mut index = 0;
    while index < left.len() {
        if left[index] != right[index] {
            return false;
        }
        index += 1;
    }
    true
}

const fn parse_decimal_i32(raw: &str) -> i32 {
    let bytes = raw.as_bytes();
    let mut index = 0;
    let mut value: i32 = 0;
    if bytes.is_empty() {
        panic!("convar default is empty");
    }
    while index < bytes.len() {
        let digit = bytes[index];
        if !digit.is_ascii_digit() {
            panic!("convar default is not a whole number");
        }
        value = value * 10 + (digit - b'0') as i32;
        index += 1;
    }
    value
}

/// Overtime side-swap block length.
pub const OVERTIME_BLOCK_ROUNDS: u32 = 3;

/// One overtime is two MR3 blocks (CT and T).
/// Keep aligned with `apps/web/src/lib/shared/constants.ts`.
pub const OVERTIME_PERIOD_ROUNDS: u32 = OVERTIME_BLOCK_ROUNDS * 2;

/// KAST / trade window: teammate kills the attacker.
pub const TRADE_SECONDS: f32 = 5.0;

/// Habits overlay: default seconds after freeze end when round length is unknown.
/// Keep aligned with `apps/web/src/lib/shared/constants.ts`.
pub const SERIES_HABITS_WINDOW_SECONDS: u32 = 20;

/// Habits overlay trail window clamp when round length is known.
pub const SERIES_HABITS_WINDOW_MIN_SECONDS: u32 = 5;
pub const SERIES_HABITS_WINDOW_MAX_SECONDS: u32 = 60;

/// C4 arm time (hold E). GOTV completed plants are ~3.12s.
pub const PLANT_SECONDS: f32 = 3.2;

/// A projectile detonate (`smokegrenade_detonate`, optional `molotov_detonate`, …)
/// may be recorded this many ticks before the projectile's first sample.
/// `inferno_startburn` does not use this window.
pub const GRENADE_DET_LEAD_TICKS: u32 = 16;

/// After the last projectile sample, a projectile detonate may still match for this many tick-strides.
/// `inferno_startburn` only pairs a molotov/incendiary whose last sample is at or before the burn.
pub const GRENADE_DET_LATE_STRIDES: u32 = 10;

/// Ticks after `inferno_startburn` during which `CInferno.m_hOwnerEntity` may
/// still be copied onto that burn. Premier's event descriptor has no `userid`;
/// the inferno entity appears on the following tick. One second does not reach
/// a later burn that reused the entity id.
pub const INFERNO_OWNER_LAG_TICKS: u32 = DEFAULT_TICK_RATE as u32;

/// Full cover before a smoke thins out. The cloud is gone at [`SMOKE_DURATION_SECONDS`].
pub const SMOKE_SECONDS: f32 = 18.0;
/// Dissipating tail after the full cover. Keep aligned with the web constants.
pub const SMOKE_FADE_SECONDS: f32 = 4.0;
/// `smokegrenade_detonate` to `smokegrenade_expired` when that event never arrives.
/// assets-v1 demos: about 95% of smokes last exactly this long (18s cover + 4s fade).
/// Scale by the demo tick rate (`1 / tick_interval`), not a fixed 64.
pub const SMOKE_DURATION_SECONDS: f32 = SMOKE_SECONDS + SMOKE_FADE_SECONDS;
pub const MOLOTOV_SECONDS: f32 = 7.0;

/// Ticks from `inferno_startburn` until a full burn when `inferno_expire` never
/// arrives. The fire keeps going after the round ends. Verified on the assets-v1
/// demos: an incendiary's expire is always 352 ticks after startburn, and a
/// molotov's is 449 or 450. These are demo ticks, not `seconds * tick_rate`.
/// An unknown grenade uses the molotov length. Cap the result at the next
/// `round_start` tick or the last demo tick.
pub const INCENDIARY_BURN_TICKS: u32 = 352;
pub const MOLOTOV_BURN_TICKS: u32 = 450;

pub const HE_DECOY_SECONDS: f32 = 0.5;
pub const FLASH_POP_SECONDS: f32 = 0.4;

/// CS2 game-event player ids (`userid`, `attacker`, `assister`) are this many
/// below the `CCSPlayerController` entity index. The first controller is index
/// 1, so its event id is 0. Using the raw id as an entity index returns the
/// previous controller and drops id 0 (`player_blind` has no `userid_pawn`).
pub const EVENT_USERID_CONTROLLER_OFFSET: i32 = 1;

/// Pawn-duration fallback only (`player_blind` absent). A duration jump farther
/// than this from a recent `flashbang_detonate` is not that pop. On Premier and
/// FACEIT demos that emit `player_blind`, unmatched pawn jumps sit inside about
/// 2600 units; event victims past that rarely move the pawn prop at all.
pub const FLASH_PAWN_RADIUS: f32 = 2500.0;
/// The duration prop is read on a later tick start than the detonate event.
/// Keep this short so two pops do not share one jump.
pub const FLASH_PAWN_LOOKBACK_SECONDS: f32 = 1.0;

/// Full-face CS2 flash. Pawn `m_flFlashDuration` often snaps into this band
/// even when `player_blind` is a short pop. Keep aligned with the web constants.
pub const FLASH_FULL_SECONDS: f32 = 5.47;
/// Wide enough that `4.95.toFixed(1) === "5.0"` leftover snaps are excluded.
pub const FLASH_OVERLAY_SLACK_SECONDS: f32 = 0.57;
pub const FLASH_OVERLAY_SPIKE_SECONDS: f32 = FLASH_FULL_SECONDS - FLASH_OVERLAY_SLACK_SECONDS;

pub fn flash_overlay_spike(duration: f32) -> bool {
    duration >= FLASH_OVERLAY_SPIKE_SECONDS
}

/// `CCSPlayerController.m_iConnected` (`PlayerConnectedState`). Missing GOTV
/// field must not drop the roster — `prop_i32_opt` is `None`, treated as in-server.
pub const PLAYER_NEVER_CONNECTED: i32 = -1;
pub const PLAYER_CONNECTED: i32 = 0;
pub const PLAYER_CONNECTING: i32 = 1;
pub const PLAYER_RECONNECTING: i32 = 2;
pub const PLAYER_DISCONNECTING: i32 = 3;
pub const PLAYER_DISCONNECTED: i32 = 4;
pub const PLAYER_RESERVED: i32 = 5;

/// True when the controller is still in the server (or GOTV omitted the field).
pub fn player_connected_in_server(state: Option<i32>) -> bool {
    match state {
        None => true,
        Some(PLAYER_CONNECTED | PLAYER_CONNECTING | PLAYER_RECONNECTING) => true,
        Some(_) => false,
    }
}

/// Synthetic Steam IDs for GOTV / offline bots (`m_steamID == 0`).
/// Identity is `BOT_STEAM_ID_BASE + CCSPlayerController` entity index.
/// Real SteamID64 values start at [`STEAMID64_MIN`], so this range never collides.
pub const BOT_STEAM_ID_BASE: u64 = 0xB070_0000;

/// Controller-index span reserved for synthetic bot ids. Keep aligned with web.
pub const BOT_STEAM_ID_SPAN: u64 = 0x1_0000;

/// First valid individual SteamID64 (universe 1, account type 1, instance 1).
pub const STEAMID64_MIN: u64 = 76_561_197_960_265_728;

/// Stable synthetic id for a bot on this controller slot. Not a real Steam ID.
pub fn bot_steam_id(controller_slot: u32) -> u64 {
    BOT_STEAM_ID_BASE.saturating_add(u64::from(controller_slot))
}

/// True for parser-assigned bot identities, never for a human SteamID64.
pub fn is_bot_steam_id(steam_id: u64) -> bool {
    (BOT_STEAM_ID_BASE..STEAMID64_MIN).contains(&steam_id)
}

/// CS2 buy menu prices. Keep aligned with `apps/web/src/lib/shared/constants.ts`.
pub const COST_GLOCK: u16 = 200;
pub const COST_USP: u16 = 200;
pub const COST_P2000: u16 = 200;
pub const COST_ELITE: u16 = 300;
pub const COST_P250: u16 = 300;
pub const COST_TEC9: u16 = 500;
pub const COST_FIVESEVEN: u16 = 500;
pub const COST_CZ75: u16 = 500;
pub const COST_DEAGLE: u16 = 700;
pub const COST_REVOLVER: u16 = 600;
pub const COST_MAC10: u16 = 1050;
pub const COST_MP9: u16 = 1250;
pub const COST_MP7: u16 = 1500;
pub const COST_MP5SD: u16 = 1500;
pub const COST_UMP45: u16 = 1200;
pub const COST_P90: u16 = 2350;
pub const COST_BIZON: u16 = 1400;
pub const COST_GALIL: u16 = 1800;
pub const COST_FAMAS: u16 = 2050;
pub const COST_AK47: u16 = 2700;
pub const COST_M4A4: u16 = 2900;
pub const COST_M4A1S: u16 = 2900;
pub const COST_SSG08: u16 = 1700;
pub const COST_AUG: u16 = 3300;
pub const COST_SG553: u16 = 3000;
pub const COST_AWP: u16 = 4750;
pub const COST_SCAR20: u16 = 5000;
pub const COST_G3SG1: u16 = 5000;
pub const COST_NOVA: u16 = 1050;
pub const COST_XM1014: u16 = 2000;
pub const COST_MAG7: u16 = 1300;
pub const COST_SAWEDOFF: u16 = 1100;
pub const COST_M249: u16 = 5200;
pub const COST_NEGEV: u16 = 1700;
pub const COST_TASER: u16 = 200;
pub const COST_HE: u16 = 300;
pub const COST_FLASH: u16 = 200;
pub const COST_SMOKE: u16 = 300;
pub const COST_MOLLY: u16 = 400;
pub const COST_INC: u16 = 500;
pub const COST_DECOY: u16 = 50;
pub const COST_KEVLAR: u16 = 650;
pub const COST_HELMET: u16 = 350;
pub const COST_DEFUSER: u16 = 400;
