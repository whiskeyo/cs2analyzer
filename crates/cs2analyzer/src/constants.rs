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

/// Fallback when the next freeze is still 0–0 (FACEIT knife reset). Kevlar is 650.
pub const KNIFE_ROUND_RESET_MAX_EQUIPMENT: i32 = 1000;

/// MR12: rounds in one half of regulation.
pub const REGULATION_ROUNDS_PER_HALF: u32 = 12;

/// MR12: both halves (12+12).
pub const REGULATION_ROUNDS: u32 = 24;

/// First 1-based round number of overtime.
pub const FIRST_OVERTIME_ROUND: u32 = 25;

/// CS2 OT freeze money per player (no pistol round in OT).
pub const OVERTIME_START_MONEY: i32 = 10000;

/// Overtime side-swap block length.
pub const OVERTIME_BLOCK_ROUNDS: u32 = 3;

/// KAST / trade window: teammate kills the attacker.
pub const TRADE_SECONDS: f32 = 5.0;

/// C4 arm time (hold E). GOTV completed plants are ~3.12s.
pub const PLANT_SECONDS: f32 = 3.2;

pub const SMOKE_SECONDS: f32 = 18.0;
pub const MOLOTOV_SECONDS: f32 = 7.0;
pub const HE_DECOY_SECONDS: f32 = 0.5;
pub const FLASH_POP_SECONDS: f32 = 0.4;

/// Full-face CS2 flash. Pawn `m_flFlashDuration` often snaps into this band
/// even when `player_blind` is a short pop. Keep aligned with the web constants.
pub const FLASH_FULL_SECONDS: f32 = 5.47;
pub const FLASH_OVERLAY_SLACK_SECONDS: f32 = 0.5;
pub const FLASH_OVERLAY_SPIKE_SECONDS: f32 = FLASH_FULL_SECONDS - FLASH_OVERLAY_SLACK_SECONDS;

pub fn flash_overlay_spike(duration: f32) -> bool {
    duration >= FLASH_OVERLAY_SPIKE_SECONDS
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
