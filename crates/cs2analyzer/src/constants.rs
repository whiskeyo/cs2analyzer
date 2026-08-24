//! Named CS2 / FACEIT values. Prefer these over unexplained literals.

/// GOTV tick rate when the demo does not report `tick_interval`.
pub const DEFAULT_TICK_RATE: f32 = 64.0;

/// Keep one snapshot every N demo ticks (`64 / 4` ≈ 16 Hz).
pub const DEFAULT_TICK_STRIDE: u32 = 4;

/// Competitive spawn HP (reset each round).
pub const FULL_HEALTH: i32 = 100;

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

/// Overtime side-swap block length.
pub const OVERTIME_BLOCK_ROUNDS: u32 = 3;

/// KAST / trade window: teammate kills the attacker.
pub const TRADE_SECONDS: f32 = 5.0;

pub const SMOKE_SECONDS: f32 = 18.0;
pub const MOLOTOV_SECONDS: f32 = 7.0;
pub const HE_DECOY_SECONDS: f32 = 0.5;
pub const FLASH_POP_SECONDS: f32 = 0.4;

/// World units: voxel centroid can be this far from the throw or detonate pos.
pub const SMOKE_VOXEL_ATTACH_DIST: f32 = 2500.0;

/// First occupancy sample may lag detonate by this many ticks (~5s at 64 Hz).
pub const SMOKE_VOXEL_ATTACH_TICKS: u32 = 320;
