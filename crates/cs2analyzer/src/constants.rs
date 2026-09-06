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

pub const SMOKE_SECONDS: f32 = 18.0;
pub const MOLOTOV_SECONDS: f32 = 7.0;
pub const HE_DECOY_SECONDS: f32 = 0.5;
pub const FLASH_POP_SECONDS: f32 = 0.4;
