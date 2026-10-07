//! Parse Counter-Strike 2 `.dem` files into compact replay snapshots and stats.

mod analysis;
mod assemble;
mod constants;
mod error;
mod inventory;
mod observer;
mod props;
mod radar;
mod types;

#[cfg(feature = "match-stats")]
pub use analysis::{compute_stats, compute_stats_until};
pub use constants::*;
pub use error::ParseError;
pub use radar::{calibration, MapCalibration, VerticalSection, MAPS};
pub use types::*;

use std::cell::RefCell;
use std::rc::Rc;

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
            tick_stride: DEFAULT_TICK_STRIDE,
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
    let (mut parser, handle) = prepare_parser(bytes, opts, progress)?;
    parser
        .run_to_end()
        .map_err(|e| ParseError::Demo(e.to_string()))?;
    Ok(assemble_match(&parser, &handle))
}

/// Parse a demo and return a read-only observer that ran after [`Collector`].
///
/// Integration tests are not `cfg(test)` for this crate, so the hook is also
/// gated on the `test-hooks` feature (a default feature; WASM and the CLI turn
/// default features off). Registering the extra observer does not change the
/// `Match`: [`Collector`] is still first and already uses every interest.
#[cfg(any(test, feature = "test-hooks"))]
#[doc(hidden)]
pub fn parse_demo_with_test_observer<O>(
    bytes: &[u8],
    opts: ParseOptions,
    observer: O,
) -> Result<(Match, O), ParseError>
where
    O: Observer + Clone + 'static,
{
    let (mut parser, handle) = prepare_parser(bytes, opts, None)?;
    let extra = parser.add_observer(observer);
    parser
        .run_to_end()
        .map_err(|e| ParseError::Demo(e.to_string()))?;
    let parsed = assemble_match(&parser, &handle);
    let observed = extra.borrow().clone();
    Ok((parsed, observed))
}

fn prepare_parser<'a>(
    bytes: &'a [u8],
    opts: ParseOptions,
    progress: Option<Box<dyn FnMut(u32, u32)>>,
) -> Result<(Parser<'a>, Rc<RefCell<Collector>>), ParseError> {
    let opts = ParseOptions {
        tick_stride: opts.tick_stride.max(1),
        skip_warmup: opts.skip_warmup,
    };
    let mut parser = Parser::new(bytes).map_err(|e| ParseError::Demo(e.to_string()))?;
    let mut collector = Collector::new(opts);
    collector.progress = progress;
    let total = parser.replay_info().playback_ticks().max(0) as u32;
    collector.total_ticks = total;
    let handle = parser.add_observer(collector);
    Ok((parser, handle))
}

fn assemble_match(parser: &Parser, handle: &Rc<RefCell<Collector>>) -> Match {
    let playback_ticks = parser.replay_info().playback_ticks();
    let playback_time = parser.replay_info().playback_time();
    let mut collector = handle.borrow_mut();
    assemble::assemble(&mut collector, playback_ticks, playback_time)
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
/// Bit in [`TickBuffer::flags`]: C4 `m_bStartedArming` on this pawn's bomb.
pub const FLAG_PLANTING: u8 = 1 << 5;
/// Bit in [`TickBuffer::flags`]: pawn `m_bIsDefusing`.
pub const FLAG_DEFUSING: u8 = 1 << 6;

/// Maximum player slots stored in the tick buffer.
pub const MAX_PLAYERS: usize = 16;
