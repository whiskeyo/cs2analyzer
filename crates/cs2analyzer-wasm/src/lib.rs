use cs2analyzer::{parse_demo_with_progress, Match, ParseOptions};
use js_sys::{Float32Array, Function, Uint16Array, Uint32Array, Uint8Array};
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(feature = "panic-hook")]
    console_error_panic_hook::set_once();
}

/// Parsed match handle. Tick buffers are exposed as typed arrays.
///
/// `Match::stats` is deliberately not exposed: it is a whole-match snapshot,
/// while the viewer needs the scoreboard through the current tick and computes
/// that itself in `apps/web/src/lib/stats/stats.ts`. Use the CLI for a
/// match-level Rust tally.
#[wasm_bindgen]
pub struct ParsedMatch {
    inner: Match,
}

#[wasm_bindgen]
impl ParsedMatch {
    #[wasm_bindgen(js_name = headerJson)]
    pub fn header_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.header).map_err(js_err)
    }

    #[wasm_bindgen(js_name = playersJson)]
    pub fn players_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.players).map_err(js_err)
    }

    #[wasm_bindgen(js_name = roundsJson)]
    pub fn rounds_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.rounds).map_err(js_err)
    }

    #[wasm_bindgen(js_name = grenadesJson)]
    pub fn grenades_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.grenades).map_err(js_err)
    }

    #[wasm_bindgen(js_name = shotsJson)]
    pub fn shots_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.shots).map_err(js_err)
    }

    #[wasm_bindgen(js_name = killsJson)]
    pub fn kills_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.kills).map_err(js_err)
    }

    #[wasm_bindgen(js_name = hurtsJson)]
    pub fn hurts_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.hurts).map_err(js_err)
    }

    #[wasm_bindgen(js_name = blindsJson)]
    pub fn blinds_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.blinds).map_err(js_err)
    }

    #[wasm_bindgen(js_name = bombEventsJson)]
    pub fn bomb_events_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.bomb_events).map_err(js_err)
    }

    #[wasm_bindgen(js_name = playerCount)]
    pub fn player_count(&self) -> u32 {
        self.inner.ticks.player_count
    }

    #[wasm_bindgen(js_name = frameCount)]
    pub fn frame_count(&self) -> u32 {
        self.inner.ticks.frame_count
    }

    pub fn ticks(&self) -> Uint32Array {
        typed_view_u32(&self.inner.ticks.ticks)
    }

    pub fn x(&self) -> Float32Array {
        typed_view_f32(&self.inner.ticks.x)
    }

    pub fn y(&self) -> Float32Array {
        typed_view_f32(&self.inner.ticks.y)
    }

    pub fn z(&self) -> Float32Array {
        typed_view_f32(&self.inner.ticks.z)
    }

    pub fn yaw(&self) -> Float32Array {
        typed_view_f32(&self.inner.ticks.yaw)
    }

    pub fn health(&self) -> Uint8Array {
        typed_view_u8(&self.inner.ticks.health)
    }

    pub fn armor(&self) -> Uint8Array {
        typed_view_u8(&self.inner.ticks.armor)
    }

    pub fn flags(&self) -> Uint8Array {
        typed_view_u8(&self.inner.ticks.flags)
    }

    pub fn money(&self) -> Uint16Array {
        typed_view_u16(&self.inner.ticks.money)
    }

    pub fn equip(&self) -> Uint16Array {
        typed_view_u16(&self.inner.ticks.equip)
    }

    pub fn gear(&self) -> Uint16Array {
        typed_view_u16(&self.inner.ticks.gear)
    }

    pub fn primary(&self) -> Uint8Array {
        typed_view_u8(&self.inner.ticks.primary)
    }

    pub fn secondary(&self) -> Uint8Array {
        typed_view_u8(&self.inner.ticks.secondary)
    }

    pub fn active(&self) -> Uint8Array {
        typed_view_u8(&self.inner.ticks.active)
    }
}

/// Parse a CS2 demo. `progress` is called as `progress(currentTick, totalTicks)`.
#[wasm_bindgen(js_name = parseDemo)]
pub fn parse_demo(
    data: &[u8],
    tick_stride: u32,
    skip_warmup: bool,
    progress: Option<Function>,
) -> Result<ParsedMatch, JsValue> {
    let cb: Option<Box<dyn FnMut(u32, u32)>> = progress.map(|f| {
        Box::new(move |cur: u32, total: u32| {
            let _ = f.call2(&JsValue::NULL, &JsValue::from(cur), &JsValue::from(total));
        }) as Box<dyn FnMut(u32, u32)>
    });
    let parsed = parse_demo_with_progress(
        data,
        ParseOptions {
            tick_stride: tick_stride.max(1),
            skip_warmup,
        },
        cb,
    )
    .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(ParsedMatch { inner: parsed })
}

fn js_err(e: serde_json::Error) -> JsValue {
    JsValue::from_str(&e.to_string())
}

fn typed_view_u32(data: &[u32]) -> Uint32Array {
    if data.is_empty() {
        return Uint32Array::new_with_length(0);
    }
    unsafe { Uint32Array::view(data) }
}

fn typed_view_f32(data: &[f32]) -> Float32Array {
    if data.is_empty() {
        return Float32Array::new_with_length(0);
    }
    unsafe { Float32Array::view(data) }
}

fn typed_view_u8(data: &[u8]) -> Uint8Array {
    if data.is_empty() {
        return Uint8Array::new_with_length(0);
    }
    unsafe { Uint8Array::view(data) }
}

fn typed_view_u16(data: &[u16]) -> Uint16Array {
    if data.is_empty() {
        return Uint16Array::new_with_length(0);
    }
    unsafe { Uint16Array::view(data) }
}
