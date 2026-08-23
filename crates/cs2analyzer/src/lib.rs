//! Parse Counter-Strike 2 `.dem` files into compact replay snapshots and stats.

mod analysis;
mod assemble;
mod error;
mod inventory;
mod observer;
mod props;
mod radar;
mod types;

pub use analysis::{compute_stats, compute_stats_until};
pub use error::ParseError;
pub use radar::{calibration, MapCalibration, VerticalSection, MAPS};
pub use types::*;

use observer::Collector;
use source2_demo::prelude::*;

/// Options for a single demo parse.
#[derive(Debug, Clone)]
pub struct ParseOptions {
    /// Keep one snapshot every N demo ticks. CS2 is 64-tick; `4` ≈ 16 Hz.
    pub tick_stride: u32,
    /// Drop warmup ticks and events.
    pub skip_warmup: bool,
}

impl Default for ParseOptions {
    fn default() -> Self {
        Self {
            tick_stride: 4,
            skip_warmup: true,
        }
    }
}

/// Parse a CS2 demo from memory.
pub fn parse_demo(bytes: &[u8], opts: ParseOptions) -> Result<Match, ParseError> {
    parse_demo_with_progress(bytes, opts, None)
}

/// Parse a CS2 demo, invoking `progress(current_tick, total_ticks)` periodically.
pub fn parse_demo_with_progress(
    bytes: &[u8],
    opts: ParseOptions,
    progress: Option<Box<dyn FnMut(u32, u32)>>,
) -> Result<Match, ParseError> {
    let mut parser = Parser::new(bytes).map_err(|e| ParseError::Demo(e.to_string()))?;
    let mut collector = Collector::new(opts);
    collector.progress = progress;
    let total = parser.replay_info().playback_ticks().max(0) as u32;
    collector.total_ticks = total;
    let handle = parser.add_observer(collector);
    parser
        .run_to_end()
        .map_err(|e| ParseError::Demo(e.to_string()))?;
    let playback_ticks = parser.replay_info().playback_ticks();
    let playback_time = parser.replay_info().playback_time();
    let mut collector = handle.borrow_mut();
    Ok(assemble::assemble(
        &mut collector,
        playback_ticks,
        playback_time,
    ))
}

/// Bit in [`TickBuffer::flags`]: player has a pawn this frame.
pub const FLAG_PRESENT: u8 = 1 << 0;
/// Bit in [`TickBuffer::flags`]: player is alive.
pub const FLAG_ALIVE: u8 = 1 << 1;
/// Bit in [`TickBuffer::flags`]: player is ducked.
pub const FLAG_DUCKED: u8 = 1 << 2;
/// Bit in [`TickBuffer::flags`]: player is scoped.
pub const FLAG_SCOPED: u8 = 1 << 3;
/// Bit in [`TickBuffer::flags`]: player is currently on CT (unset = T).
pub const FLAG_CT: u8 = 1 << 4;

/// Maximum player slots stored in the tick buffer.
pub const MAX_PLAYERS: usize = 16;
