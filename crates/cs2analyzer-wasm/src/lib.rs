use cs2analyzer::{parse_demo_with_progress, Match, ParseOptions};
use js_sys::Function;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// Parsed match handle. Tick buffers are exposed as typed arrays.
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

    #[wasm_bindgen(js_name = statsJson)]
    pub fn stats_json(&self) -> Result<String, JsValue> {
        serde_json::to_string(&self.inner.stats).map_err(js_err)
    }

    #[wasm_bindgen(js_name = playerCount)]
    pub fn player_count(&self) -> u32 {
        self.inner.ticks.player_count
    }

    #[wasm_bindgen(js_name = frameCount)]
    pub fn frame_count(&self) -> u32 {
        self.inner.ticks.frame_count
    }

    pub fn ticks(&self) -> Vec<u32> {
        self.inner.ticks.ticks.clone()
    }

    pub fn x(&self) -> Vec<f32> {
        self.inner.ticks.x.clone()
    }

    pub fn y(&self) -> Vec<f32> {
        self.inner.ticks.y.clone()
    }

    pub fn z(&self) -> Vec<f32> {
        self.inner.ticks.z.clone()
    }

    pub fn yaw(&self) -> Vec<f32> {
        self.inner.ticks.yaw.clone()
    }

    pub fn health(&self) -> Vec<u8> {
        self.inner.ticks.health.clone()
    }

    pub fn armor(&self) -> Vec<u8> {
        self.inner.ticks.armor.clone()
    }

    pub fn flags(&self) -> Vec<u8> {
        self.inner.ticks.flags.clone()
    }

    pub fn money(&self) -> Vec<u16> {
        self.inner.ticks.money.clone()
    }

    pub fn equip(&self) -> Vec<u16> {
        self.inner.ticks.equip.clone()
    }

    pub fn gear(&self) -> Vec<u16> {
        self.inner.ticks.gear.clone()
    }

    pub fn primary(&self) -> Vec<u8> {
        self.inner.ticks.primary.clone()
    }

    pub fn secondary(&self) -> Vec<u8> {
        self.inner.ticks.secondary.clone()
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
