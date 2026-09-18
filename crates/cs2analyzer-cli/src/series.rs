//! Aggregated / habits tutorial series → TypeScript under `tutorial/multi-demo/`.
//!
//! Each GOTV is a same-map match. Round headers stay for the Analyzer shell
//! (pistol / eco / force / full labels). Heavy SoA ticks and util/events are
//! the habits window of full-buy regulation rounds, plus a freeze snapshot on
//! every other non-knife round so tags can still classify unused chips.
//! This is Analyzer, not `/playbook`.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use cs2analyzer::{
    Match, MatchHeader, Round, TickBuffer, DEFAULT_TICK_RATE, FIRST_OVERTIME_ROUND, FLAG_CT,
    FLAG_PRESENT, FORCE_BUY_MAX_EQUIPMENT, REGULATION_ROUNDS_PER_HALF,
    SERIES_HABITS_WINDOW_SECONDS,
};

use crate::fixture::{
    clamp_habits_window_sec, discover_tutorial_dir, emit_match_modules, habits_window_for_round,
    header_scores, module_file, remap_round, round_window_end, slice_blinds, slice_bomb_events,
    slice_grenades, slice_hurts, slice_kills, slice_ticks_windows, write_tutorial_files,
    GeneratedFile, TutorialSlice, TS_SHARD_VALUE_THRESHOLD,
};

/// Target same-map matches for Overall paths / smokes.
pub const TUTORIAL_SERIES_TARGET_MATCHES: usize = 5;

/// Hard cap so stub loaders and checked-in folders stay bounded.
pub const TUTORIAL_SERIES_MAX_MATCHES: usize = 5;

/// Default cap on full-buy regulation rounds that keep habits-window ticks,
/// counted across the whole series (not per match).
pub const TUTORIAL_SERIES_FULL_BUY_CAP: u32 = 20;

/// One series match after remapping, plus which round numbers are active.
#[derive(Debug)]
pub struct SeriesMatchSlice {
    pub slice: TutorialSlice,
    pub active_rounds: Vec<u32>,
    pub file_name: String,
    pub id: String,
}

/// Written manifest + per-match files.
pub struct SeriesWriteSummary {
    pub map_name: String,
    pub match_count: usize,
    pub habits_window_sec: u32,
    pub files: Vec<(String, usize)>,
    pub total_bytes: usize,
    pub frame_count: u32,
    pub player_count: u32,
}

/// MR12 pistols: first round of each regulation half.
fn is_regulation_pistol_round(number: u32) -> bool {
    number == 1 || number == REGULATION_ROUNDS_PER_HALF + 1
}

fn freeze_tick(round: &Round) -> u32 {
    if round.freeze_end_tick > 0 {
        round.freeze_end_tick
    } else {
        round.start_tick
    }
}

/// One stride of snapshots around freeze so unused rounds still classify.
fn freeze_snapshot_window(round: &Round, tick_stride: u32) -> (u32, u32) {
    let freeze = freeze_tick(round);
    let pad = tick_stride.max(1);
    (freeze.saturating_sub(pad), freeze.saturating_add(pad))
}

fn side_avg_equip(ticks: &TickBuffer, at_tick: u32, ct: bool) -> Option<f32> {
    if ticks.frame_count == 0 || ticks.player_count == 0 {
        return None;
    }
    let frame = ticks.frame_index_at_tick(at_tick);
    let mut sum = 0i32;
    let mut n = 0u32;
    for player in 0..ticks.player_count as usize {
        let Some(tp) = ticks.player_at(frame, player) else {
            continue;
        };
        if tp.flags & FLAG_PRESENT == 0 {
            continue;
        }
        if (tp.flags & FLAG_CT != 0) != ct {
            continue;
        }
        sum = sum.saturating_add(i32::from(tp.equip));
        n += 1;
    }
    if n == 0 {
        None
    } else {
        Some(sum as f32 / n as f32)
    }
}

fn is_full_buy_regulation_round(round: &Round, ticks: &TickBuffer) -> bool {
    if round.is_knife || round.number == 0 || round.number >= FIRST_OVERTIME_ROUND {
        return false;
    }
    if is_regulation_pistol_round(round.number) {
        return false;
    }
    let freeze = freeze_tick(round);
    let ct = side_avg_equip(ticks, freeze, true).unwrap_or(0.0);
    let t = side_avg_equip(ticks, freeze, false).unwrap_or(0.0);
    ct >= FORCE_BUY_MAX_EQUIPMENT as f32 || t >= FORCE_BUY_MAX_EQUIPMENT as f32
}

/// Regulation non-pistol rounds where either side’s freeze avg is a full buy.
pub fn full_buy_regulation_round_numbers(m: &Match) -> Vec<u32> {
    m.rounds
        .iter()
        .filter(|round| is_full_buy_regulation_round(round, &m.ticks))
        .map(|round| round.number)
        .collect()
}

/// Round-robin full-buy rounds across matches until `cap` (series-wide).
pub fn assign_full_buy_active_rounds(per_match: &[Vec<u32>], cap: usize) -> Vec<Vec<u32>> {
    let mut out: Vec<Vec<u32>> = vec![Vec::new(); per_match.len()];
    if cap == 0 || per_match.is_empty() {
        return out;
    }
    let mut cursor = vec![0usize; per_match.len()];
    let mut total = 0usize;
    loop {
        let mut progressed = false;
        for (index, candidates) in per_match.iter().enumerate() {
            if total >= cap {
                break;
            }
            let next = cursor[index];
            if next >= candidates.len() {
                continue;
            }
            out[index].push(candidates[next]);
            cursor[index] = next + 1;
            total += 1;
            progressed = true;
        }
        if !progressed || total >= cap {
            break;
        }
    }
    out
}

fn series_tick_windows(
    m: &Match,
    active: &HashSet<u32>,
    tick_rate: f32,
    window_sec: u32,
) -> Result<Vec<(u32, u32)>, String> {
    let mut windows = Vec::new();
    for round in &m.rounds {
        if round.is_knife {
            continue;
        }
        let window = if active.contains(&round.number) {
            habits_window_for_round(round, tick_rate, window_sec)
        } else {
            freeze_snapshot_window(round, m.header.tick_stride)
        };
        if window.1 < window.0 {
            return Err("selected rounds have an empty habits window".to_string());
        }
        windows.push(window);
    }
    Ok(windows)
}

/// Keep every round header; habits-window ticks for `active_round_numbers`,
/// freeze snapshots for other non-knife rounds. Drops shots / buys / controller
/// dump — Aggregated habits does not use them.
pub fn slice_series_match(
    m: &Match,
    active_round_numbers: &[u32],
    habits_window_sec: u32,
) -> Result<TutorialSlice, String> {
    let window_sec = clamp_habits_window_sec(habits_window_sec);
    let tick_rate = if m.header.tick_rate > 0.0 {
        m.header.tick_rate
    } else {
        DEFAULT_TICK_RATE
    };
    let active: HashSet<u32> = active_round_numbers.iter().copied().collect();
    let windows = series_tick_windows(m, &active, tick_rate, window_sec)?;
    let origin = m
        .rounds
        .iter()
        .map(|round| round.start_tick)
        .min()
        .unwrap_or(0);
    let mut rounds = m.rounds.clone();
    for round in &mut rounds {
        remap_round(round, origin);
    }
    let (score_ct, score_t) = header_scores(&rounds);
    let playback_ticks = rounds.iter().map(round_window_end).max().unwrap_or(0);
    let header = MatchHeader {
        map_name: m.header.map_name.clone(),
        tick_rate: m.header.tick_rate,
        tick_stride: m.header.tick_stride,
        duration_s: playback_ticks as f32 / tick_rate.max(1.0),
        playback_ticks,
        team_ct: m.header.team_ct.clone(),
        team_t: m.header.team_t.clone(),
        score_ct,
        score_t,
    };
    Ok(TutorialSlice {
        sliced: Match {
            header,
            players: m.players.clone(),
            rounds,
            ticks: slice_ticks_windows(&m.ticks, &windows, origin),
            grenades: slice_grenades(&m.grenades, &windows, origin),
            shots: Vec::new(),
            kills: slice_kills(&m.kills, &windows, origin),
            hurts: slice_hurts(&m.hurts, &windows, origin),
            blinds: slice_blinds(&m.blinds, &windows, origin),
            bomb_events: slice_bomb_events(&m.bomb_events, &windows, origin),
            buy_events: Vec::new(),
            stats: Vec::new(),
            controller_dump: Vec::new(),
        },
        origin_tick: origin,
    })
}

pub fn series_match_id(index: usize) -> String {
    format!("match-{index}")
}

pub fn series_match_file_name(index: usize) -> String {
    format!("tutorial-series-{index}.dem")
}

fn emit_payload_reexport() -> Result<GeneratedFile, String> {
    module_file(
        "payload.ts",
        "export { header } from \"./header\";\n\
         export { players } from \"./players\";\n\
         export { rounds } from \"./rounds\";\n\
         export {\n\
           blinds,\n\
           bombEvents,\n\
           buyEvents,\n\
           controllerDump,\n\
           grenades,\n\
           hurts,\n\
           kills,\n\
           shots,\n\
         } from \"./events\";\n\
         export {\n\
           active,\n\
           armor,\n\
           clip,\n\
           equip,\n\
           flags,\n\
           frameCount,\n\
           gear,\n\
           health,\n\
           money,\n\
           playerCount,\n\
           primary,\n\
           reserve,\n\
           secondary,\n\
           ticks,\n\
           x,\n\
           y,\n\
           yaw,\n\
           z,\n\
         } from \"./ticks\";\n",
    )
}

fn emit_manifest(
    map_name: &str,
    habits_window_sec: u32,
    tick_stride: u32,
    matches: &[SeriesMatchSlice],
) -> Result<GeneratedFile, String> {
    let map = serde_json::to_string(map_name).map_err(|e| e.to_string())?;
    let mut body = format!(
        "import type {{ TutorialSeriesManifest }} from \"./types\";\n\n\
         export const tutorialSeriesManifest: TutorialSeriesManifest = {{\n\
           mapName: {map},\n\
           habitsWindowSec: {habits_window_sec},\n\
           tickStride: {tick_stride},\n\
           matches: [\n"
    );
    for match_slice in matches {
        let id = serde_json::to_string(&match_slice.id).map_err(|e| e.to_string())?;
        let file_name = serde_json::to_string(&match_slice.file_name).map_err(|e| e.to_string())?;
        let match_map = serde_json::to_string(&match_slice.slice.sliced.header.map_name)
            .map_err(|e| e.to_string())?;
        let active =
            serde_json::to_string(&match_slice.active_rounds).map_err(|e| e.to_string())?;
        body.push_str(&format!(
            "    {{ id: {id}, fileName: {file_name}, mapName: {match_map}, activeRounds: {active} }},\n"
        ));
    }
    body.push_str("  ],\n};\n");
    module_file("manifest.ts", &body)
}

fn emit_loaders(matches: &[SeriesMatchSlice]) -> Result<GeneratedFile, String> {
    let mut body = String::from(
        "import type { SeriesMatchPayload } from \"./types\";\n\n\
         export const seriesMatchLoaders: Record<string, () => Promise<SeriesMatchPayload>> = {\n",
    );
    if matches.is_empty() {
        body.push_str("  \"match-0\": () => import(\"./matches/match-0/payload\"),\n");
    } else {
        for match_slice in matches {
            body.push_str(&format!(
                "  \"{}\": () => import(\"./matches/{}/payload\"),\n",
                match_slice.id, match_slice.id
            ));
        }
    }
    body.push_str("};\n");
    module_file("loaders.ts", &body)
}

/// Build one series match from a parsed demo (id / file name from index).
pub fn series_match_from_parsed(
    parsed: &Match,
    index: usize,
    active_round_numbers: &[u32],
    habits_window_sec: u32,
) -> Result<SeriesMatchSlice, String> {
    let slice = slice_series_match(parsed, active_round_numbers, habits_window_sec)?;
    Ok(SeriesMatchSlice {
        slice,
        active_rounds: active_round_numbers.to_vec(),
        file_name: series_match_file_name(index),
        id: series_match_id(index),
    })
}

fn remove_stale_match_dirs(matches_dir: &Path, keep: &[SeriesMatchSlice]) -> Result<(), String> {
    if !matches_dir.is_dir() {
        return Ok(());
    }
    let keep_ids: Vec<&str> = keep.iter().map(|m| m.id.as_str()).collect();
    let entries = std::fs::read_dir(matches_dir)
        .map_err(|e| format!("cannot read {}: {e}", matches_dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("cannot read {}: {e}", matches_dir.display()))?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else {
            continue;
        };
        if !name.starts_with("match-") {
            continue;
        }
        if keep_ids.contains(&name) {
            continue;
        }
        let path = entry.path();
        if path.is_dir() {
            std::fs::remove_dir_all(&path)
                .map_err(|e| format!("cannot remove stale {}: {e}", path.display()))?;
        }
    }
    Ok(())
}

/// Write `manifest.ts`, `loaders.ts`, and `matches/match-N/*`.
pub fn write_tutorial_series(
    dir: &Path,
    matches: &[SeriesMatchSlice],
    habits_window_sec: u32,
    shard_after: usize,
) -> Result<SeriesWriteSummary, String> {
    if matches.is_empty() {
        return Err("series fixture needs at least one demo".to_string());
    }
    let map_name = matches[0].slice.sliced.header.map_name.clone();
    for match_slice in matches {
        if match_slice.slice.sliced.header.map_name != map_name {
            return Err(format!(
                "series demos must share a map (found {map_name} and {})",
                match_slice.slice.sliced.header.map_name
            ));
        }
    }
    std::fs::create_dir_all(dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    let matches_dir = dir.join("matches");
    std::fs::create_dir_all(&matches_dir)
        .map_err(|e| format!("cannot create {}: {e}", matches_dir.display()))?;
    remove_stale_match_dirs(&matches_dir, matches)?;

    let tick_stride = matches[0].slice.sliced.header.tick_stride;
    let mut files = Vec::new();
    let mut frame_count: u32 = 0;
    let mut player_count: u32 = 0;

    for match_slice in matches {
        let mut modules = emit_match_modules(&match_slice.slice.sliced, shard_after)?;
        modules.push(emit_payload_reexport()?);
        let match_dir = matches_dir.join(&match_slice.id);
        let written = write_tutorial_files(&match_dir, &modules, None)?;
        frame_count = frame_count.saturating_add(match_slice.slice.sliced.ticks.frame_count);
        player_count = match_slice
            .slice
            .sliced
            .ticks
            .player_count
            .max(player_count);
        for (name, bytes) in written {
            files.push((format!("matches/{}/{}", match_slice.id, name), bytes));
        }
    }

    let root_files = [
        emit_manifest(&map_name, habits_window_sec, tick_stride, matches)?,
        emit_loaders(matches)?,
    ];
    let written_root = write_tutorial_files(dir, &root_files, None)?;
    for (name, bytes) in written_root {
        files.push((name, bytes));
    }

    let total_bytes = files.iter().map(|(_, n)| *n).sum();
    Ok(SeriesWriteSummary {
        map_name,
        match_count: matches.len(),
        habits_window_sec,
        files,
        total_bytes,
        frame_count,
        player_count,
    })
}

/// `apps/web/src/lib/tutorial/multi-demo` next to the single-demo folder.
pub fn discover_series_dir(start: &Path) -> Result<PathBuf, String> {
    Ok(discover_tutorial_dir(start)?.join("multi-demo"))
}

/// Soft uncompressed budget for the lazy Aggregated tutorial chunk.
pub const SERIES_FIXTURE_BUDGET_BYTES: usize = 2 * 1024 * 1024;

pub fn default_habits_window_sec() -> u32 {
    SERIES_HABITS_WINDOW_SECONDS
}

pub fn shard_threshold() -> usize {
    TS_SHARD_VALUE_THRESHOLD
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::fixture::{
        estimated_frame_count, measure_emitted_bytes, synthetic_tick_buffer,
        ESTIMATE_FULL_ROUND_SECONDS, ESTIMATE_PLAYER_COUNT, TUTORIAL_TICK_STRIDE,
    };
    use cs2analyzer::{
        GrenadeKind, GrenadePoint, GrenadeThrow, Kill, Player, Round, Side, TickBuffer, FLAG_CT,
        FLAG_PRESENT,
    };

    fn empty_header(map: &str) -> MatchHeader {
        MatchHeader {
            map_name: map.into(),
            tick_rate: 64.0,
            tick_stride: 6,
            duration_s: 80.0,
            playback_ticks: 5000,
            team_ct: "CT".into(),
            team_t: "T".into(),
            score_ct: 13,
            score_t: 11,
        }
    }

    fn player(index: u8, name: &str, side: Side) -> Player {
        Player {
            index,
            steam_id: u64::from(index) + 1,
            name: name.into(),
            start_side: side,
            is_bot: false,
        }
    }

    fn live_round(number: u32, start: u32, freeze: u32, end: u32) -> Round {
        Round {
            number,
            start_tick: start,
            freeze_end_tick: freeze,
            end_tick: end,
            playback_end_tick: end + 16,
            winner: Some(if number % 2 == 1 { Side::Ct } else { Side::T }),
            win_reason: 8,
            score_ct: 0,
            score_t: 0,
            is_knife: false,
            team_ct: "CT".into(),
            team_t: "T".into(),
        }
    }

    fn knife_round(start: u32, end: u32) -> Round {
        Round {
            number: 0,
            start_tick: start,
            freeze_end_tick: start + 10,
            end_tick: end,
            playback_end_tick: 0,
            winner: Some(Side::T),
            win_reason: 1,
            score_ct: 0,
            score_t: 0,
            is_knife: true,
            team_ct: "CT".into(),
            team_t: "T".into(),
        }
    }

    fn kill(tick: u32) -> Kill {
        Kill {
            tick,
            attacker: 0,
            victim: 1,
            assister: -1,
            weapon: "ak47".into(),
            headshot: false,
            assisted_flash: false,
            wallbang: false,
            noscope: false,
            through_smoke: false,
            attacker_blind: false,
            attacker_airborne: false,
            x: 1.0,
            y: 2.0,
            z: 3.0,
            attacker_x: 4.0,
            attacker_y: 5.0,
            attacker_z: 6.0,
        }
    }

    /// Long regulation rounds so a 20s habits window is a real slice.
    fn mixed_buy_match() -> Match {
        // Two pawns so CT vs T freeze averages can disagree.
        let ticks = TickBuffer {
            frame_count: 5,
            player_count: 2,
            ticks: vec![1960, 11_060, 19_060, 27_060, 35_060],
            x: vec![0.0; 10],
            y: vec![0.0; 10],
            z: vec![0.0; 10],
            yaw: vec![0.0; 10],
            health: vec![100; 10],
            armor: vec![0; 10],
            flags: vec![
                FLAG_PRESENT | FLAG_CT,
                FLAG_PRESENT,
                FLAG_PRESENT | FLAG_CT,
                FLAG_PRESENT,
                FLAG_PRESENT | FLAG_CT,
                FLAG_PRESENT,
                FLAG_PRESENT | FLAG_CT,
                FLAG_PRESENT,
                FLAG_PRESENT | FLAG_CT,
                FLAG_PRESENT,
            ],
            money: vec![800; 10],
            // R1 pistol 800, R2 eco 800, R3 full 4700, R4 force 2500, R5 full 4700.
            equip: vec![800, 800, 800, 800, 4700, 4700, 2500, 2500, 4700, 4700],
            gear: vec![0; 10],
            primary: vec![0; 10],
            secondary: vec![0; 10],
            active: vec![0; 10],
            clip: vec![0; 10],
            reserve: vec![0; 10],
        };
        Match {
            header: empty_header("de_mirage"),
            players: vec![player(0, "A", Side::Ct), player(1, "B", Side::T)],
            rounds: vec![
                live_round(1, 1000, 1960, 10_000),
                live_round(2, 10_100, 11_060, 18_000),
                live_round(3, 18_100, 19_060, 26_000),
                live_round(4, 26_100, 27_060, 34_000),
                live_round(5, 34_100, 35_060, 42_000),
            ],
            ticks,
            grenades: vec![],
            shots: vec![],
            kills: vec![],
            hurts: vec![],
            blinds: vec![],
            bomb_events: vec![],
            buy_events: vec![],
            stats: vec![],
            controller_dump: vec![],
        }
    }

    fn series_test_match() -> Match {
        let ticks = TickBuffer {
            frame_count: 8,
            player_count: 1,
            ticks: vec![50, 1000, 1960, 2500, 3240, 4000, 9000, 12_000],
            x: vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
            y: vec![0.0; 8],
            z: vec![0.0; 8],
            yaw: vec![0.0; 8],
            health: vec![100; 8],
            armor: vec![0; 8],
            flags: vec![3; 8],
            money: vec![800; 8],
            equip: vec![4700; 8],
            gear: vec![0; 8],
            primary: vec![0; 8],
            secondary: vec![0; 8],
            active: vec![0; 8],
            clip: vec![0; 8],
            reserve: vec![0; 8],
        };
        Match {
            header: empty_header("de_mirage"),
            players: vec![player(0, "A", Side::Ct), player(1, "B", Side::T)],
            rounds: vec![
                knife_round(10, 90),
                live_round(1, 1000, 1960, 10_000),
                live_round(2, 10_100, 11_060, 18_000),
                live_round(3, 18_100, 19_060, 26_000),
            ],
            ticks,
            grenades: vec![
                GrenadeThrow {
                    thrower: 0,
                    kind: GrenadeKind::Smoke,
                    start_tick: 2100,
                    detonate_tick: 2200,
                    end_tick: 2300,
                    points: vec![GrenadePoint {
                        tick: 2150,
                        x: 10.0,
                        y: 20.0,
                        z: 0.0,
                    }],
                    fires: vec![],
                },
                GrenadeThrow {
                    thrower: 0,
                    kind: GrenadeKind::Smoke,
                    start_tick: 5000,
                    detonate_tick: 5100,
                    end_tick: 5200,
                    points: vec![GrenadePoint {
                        tick: 5050,
                        x: 1.0,
                        y: 2.0,
                        z: 0.0,
                    }],
                    fires: vec![],
                },
            ],
            shots: vec![],
            kills: vec![kill(80), kill(2500), kill(5000), kill(12_500)],
            hurts: vec![],
            blinds: vec![],
            bomb_events: vec![],
            buy_events: vec![],
            stats: vec![],
            controller_dump: vec![],
        }
    }

    #[test]
    fn habits_window_is_post_freeze_and_clamped() {
        let round = live_round(1, 1000, 1960, 10_000);
        let (start, end) = habits_window_for_round(&round, 64.0, SERIES_HABITS_WINDOW_SECONDS);
        assert_eq!(start, 1960);
        assert_eq!(end, 1960 + 20 * 64);
        assert_eq!(clamp_habits_window_sec(1), 5);
        assert_eq!(clamp_habits_window_sec(99), 60);
    }

    #[test]
    fn full_buy_skips_pistol_eco_and_force() {
        let parsed = mixed_buy_match();
        assert_eq!(full_buy_regulation_round_numbers(&parsed), vec![3, 5]);
    }

    #[test]
    fn assign_full_buy_round_robins_to_cap() {
        let per_match = vec![vec![3, 5, 7], vec![2, 4, 6], vec![8]];
        assert_eq!(
            assign_full_buy_active_rounds(&per_match, 4),
            vec![vec![3, 5], vec![2], vec![8]]
        );
        assert_eq!(
            assign_full_buy_active_rounds(&per_match, 5),
            vec![vec![3, 5], vec![2, 4], vec![8]]
        );
        assert_eq!(
            assign_full_buy_active_rounds(&per_match, 20),
            vec![vec![3, 5, 7], vec![2, 4, 6], vec![8]]
        );
        assert_eq!(
            assign_full_buy_active_rounds(&per_match, 0),
            vec![Vec::<u32>::new(), vec![], vec![]]
        );
    }

    #[test]
    fn series_slice_keeps_round_list_and_habits_window_only() {
        let parsed = series_test_match();
        assert_eq!(full_buy_regulation_round_numbers(&parsed), vec![2, 3]);
        let slice = slice_series_match(&parsed, &[2, 3], SERIES_HABITS_WINDOW_SECONDS).unwrap();
        assert_eq!(slice.origin_tick, 10);
        assert_eq!(slice.sliced.rounds.len(), 4);
        assert!(slice.sliced.rounds.iter().any(|r| r.is_knife));
        assert_eq!(slice.sliced.rounds[1].number, 1);
        assert_eq!(slice.sliced.rounds[1].start_tick, 990);
        assert_eq!(slice.sliced.rounds[1].freeze_end_tick, 1950);
        // Unused R1 keeps the freeze snapshot (1960); R2 habits keeps 12000.
        // R1 mid-round ticks 2500/3240/4000/9000 are dropped.
        assert_eq!(slice.sliced.ticks.ticks, vec![1950, 11_990]);
        assert_eq!(slice.sliced.ticks.x, vec![3.0, 8.0]);
        assert!(slice.sliced.kills.is_empty());
        assert!(slice.sliced.grenades.is_empty());
        assert!(slice.sliced.shots.is_empty());
        assert!(slice.sliced.buy_events.is_empty());
        assert!(slice.sliced.controller_dump.is_empty());
    }

    #[test]
    fn series_slice_keeps_habits_events_for_full_buy_only() {
        let parsed = series_test_match();
        let slice = slice_series_match(&parsed, &[1, 2], SERIES_HABITS_WINDOW_SECONDS).unwrap();
        // R1 window 1960..3240 and R2 11060..12340 in source ticks.
        assert_eq!(slice.sliced.ticks.ticks, vec![1950, 2490, 3230, 11_990]);
        assert_eq!(slice.sliced.kills.len(), 1);
        assert_eq!(slice.sliced.kills[0].tick, 2490);
        assert_eq!(slice.sliced.grenades.len(), 1);
        assert_eq!(slice.sliced.grenades[0].start_tick, 2090);
    }

    #[test]
    fn manifest_lists_active_rounds_and_loaders() {
        let parsed = series_test_match();
        let match_slice =
            series_match_from_parsed(&parsed, 0, &[2, 3], SERIES_HABITS_WINDOW_SECONDS).unwrap();
        assert_eq!(match_slice.id, "match-0");
        assert_eq!(match_slice.active_rounds, vec![2, 3]);
        let files = [
            emit_manifest(
                "de_mirage",
                SERIES_HABITS_WINDOW_SECONDS,
                6,
                std::slice::from_ref(&match_slice),
            )
            .unwrap(),
            emit_loaders(std::slice::from_ref(&match_slice)).unwrap(),
        ];
        let manifest = &files[0];
        assert!(manifest.contents.contains("tutorialSeriesManifest"));
        assert!(manifest.contents.contains("TutorialSeriesManifest"));
        assert!(manifest.contents.contains("activeRounds: [2,3]"));
        assert!(manifest.contents.contains("match-0"));
        assert!(files[1]
            .contents
            .contains("import type { SeriesMatchPayload } from \"./types\""));
        assert!(files[1]
            .contents
            .contains("() => import(\"./matches/match-0/payload\")"));
    }

    #[test]
    fn write_series_uses_repo_layout_and_drops_stale_matches() {
        let root =
            std::env::temp_dir().join(format!("cs2a-series-{}-{}", std::process::id(), "write"));
        let lib = root.join("apps/web/src/lib");
        std::fs::create_dir_all(&lib).unwrap();
        let dir = discover_series_dir(&root).unwrap();
        assert_eq!(dir, lib.join("tutorial/multi-demo"));

        let parsed = series_test_match();
        let one =
            series_match_from_parsed(&parsed, 0, &[2, 3], SERIES_HABITS_WINDOW_SECONDS).unwrap();
        let summary =
            write_tutorial_series(&dir, &[one], SERIES_HABITS_WINDOW_SECONDS, 10_000).unwrap();
        assert_eq!(summary.match_count, 1);
        assert_eq!(summary.map_name, "de_mirage");
        assert!(dir.join("manifest.ts").is_file());
        assert!(dir.join("matches/match-0/header.ts").is_file());
        assert!(dir.join("matches/match-0/payload.ts").is_file());

        std::fs::create_dir_all(dir.join("matches/match-9")).unwrap();
        std::fs::write(dir.join("matches/match-9/stale.ts"), "nope\n").unwrap();
        let again =
            series_match_from_parsed(&parsed, 0, &[2, 3], SERIES_HABITS_WINDOW_SECONDS).unwrap();
        write_tutorial_series(&dir, &[again], SERIES_HABITS_WINDOW_SECONDS, 10_000).unwrap();
        assert!(!dir.join("matches/match-9").exists());
        std::fs::remove_dir_all(&root).ok();
    }

    #[test]
    fn size_budget_single_vs_series_synthetic() {
        let tick_rate = DEFAULT_TICK_RATE;
        let stride = TUTORIAL_TICK_STRIDE;
        let single_seconds = 2 * ESTIMATE_FULL_ROUND_SECONDS;
        let series_seconds = TUTORIAL_SERIES_FULL_BUY_CAP * SERIES_HABITS_WINDOW_SECONDS;
        let single_frames = estimated_frame_count(single_seconds, tick_rate, stride);
        let series_frames = estimated_frame_count(series_seconds, tick_rate, stride);

        let single_ticks = synthetic_tick_buffer(single_frames, ESTIMATE_PLAYER_COUNT, stride);
        let series_ticks = synthetic_tick_buffer(series_frames, ESTIMATE_PLAYER_COUNT, stride);
        let single_match = Match {
            header: empty_header("de_mirage"),
            players: vec![player(0, "A", Side::Ct)],
            rounds: vec![live_round(1, 0, 64, 2000)],
            ticks: single_ticks,
            grenades: vec![],
            shots: vec![],
            kills: vec![],
            hurts: vec![],
            blinds: vec![],
            bomb_events: vec![],
            buy_events: vec![],
            stats: vec![],
            controller_dump: vec![],
        };
        let mut series_match = single_match.clone();
        series_match.ticks = series_ticks;

        let single_files = emit_match_modules(&single_match, usize::MAX).unwrap();
        let series_files = emit_match_modules(&series_match, usize::MAX).unwrap();
        let single_bytes = measure_emitted_bytes(&single_files);
        let series_bytes = measure_emitted_bytes(&series_files);

        eprintln!(
            "tutorial size estimate (no .dem; 64-tick, stride {stride}, {} pawns, ~10.67 Hz):\n\
               single: {single_seconds}s / {single_frames} frames → {:.1} KiB uncompressed TS\n\
               series: {series_seconds}s / {series_frames} frames ({}×{}s full-buy cap) → {:.1} KiB uncompressed TS\n\
               assumptions: freeze+live {}s/round for single; habits window only for series",
            ESTIMATE_PLAYER_COUNT,
            single_bytes as f64 / 1024.0,
            TUTORIAL_SERIES_FULL_BUY_CAP,
            SERIES_HABITS_WINDOW_SECONDS,
            series_bytes as f64 / 1024.0,
            ESTIMATE_FULL_ROUND_SECONDS,
        );

        // Synthetic JSON is denser unique-looking floats than a real GOTV slice.
        // The CLI still warns at SERIES_FIXTURE_BUDGET_BYTES (2 MiB).
        const SYNTHETIC_SERIES_JSON_CEILING_BYTES: usize = 4 * 1024 * 1024;
        assert!(
            series_bytes < SYNTHETIC_SERIES_JSON_CEILING_BYTES,
            "series ticks+headers {:.1} KiB should stay under 4 MiB synthetic JSON",
            series_bytes as f64 / 1024.0
        );
        // Twenty 20s windows should stay in the same ballpark as two full rounds.
        assert!(series_frames < single_frames.saturating_mul(2));
    }
}
