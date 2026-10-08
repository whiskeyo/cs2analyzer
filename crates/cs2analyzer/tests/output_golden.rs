//! SHA-256 of the parser output the WASM boundary exposes.
//!
//! `Match::stats` is omitted: the wasm crate does not ship it. Each JSON
//! string is `serde_json::to_string` of the same field, in the same order as
//! `ParsedMatch` in `crates/cs2analyzer-wasm`. Tick columns are the
//! little-endian bytes of those typed arrays (`Float32Array` / `Uint32Array` /
//! `Uint16Array` / `Uint8Array`).
//!
//! The events section is every non-column getter. Each piece is the getter
//! name, a newline, the decimal byte length, a newline, then the exact bytes
//! (`serde_json::to_string` for the JSON getters, decimal ASCII for
//! `playerCount` and `frameCount`). The demo hash frames every section the
//! same way. `events` is that whole blob. Each getter also has its own hash
//! (`header`, `grenades`, …) so a mismatch names the field. Those piece
//! hashes are not mixed into the demo sha256 a second time. Tick-column
//! hashes cover that column's bytes only.
//!
//! None of those JSON types contain a map. Object keys are struct fields in
//! declaration order, so they do not follow `HashMap` iteration. `serde_json`
//! prints each `f32` with the same text for the same bits.
//!
//! `cargo test` skips the demo run. Regenerate hashes with
//! `UPDATE_HASHES=1 cargo test --release -p cs2analyzer --test real_demos -- --ignored`.
//! The serializer snapshot stays on `UPDATE_SNAPSHOT=1` (`tests/serializers.rs`).
//! Hash framing lives in `output_hash.rs` so that walk can hash the one parse.

#[allow(dead_code)]
#[path = "common/mod.rs"]
mod common;

#[allow(dead_code)]
#[path = "support/output_hash.rs"]
mod output_hash;

use cs2analyzer::{Match, TickBuffer};
use output_hash::{
    diff_report, events_payload, hash_match, hex_bytes, DemoHash, OutputHashes, SectionHashes,
    SECTION_ORDER,
};
use sha2::{Digest, Sha256};

#[test]
fn wasm_boundary_hashes_json_and_little_endian_columns() {
    let parsed = sample_match();
    let header = serde_json::to_string(&parsed.header)
        .unwrap_or_else(|err| panic!("could not serialize header: {err}"));
    let events = events_payload(&parsed);
    let events = String::from_utf8(events)
        .unwrap_or_else(|err| panic!("events payload is not utf-8: {err}"));
    assert!(
        events.contains(&format!("headerJson\n{}\n{header}", header.len())),
        "events section must embed the WASM header JSON bytes"
    );
    assert!(
        events.contains("playerCount\n1\n1"),
        "playerCount is a WASM getter, not a tick column"
    );
    assert!(
        !events.contains("\"adr\""),
        "Match::stats is not on the WASM boundary"
    );

    let (sha256, sections) = hash_match(&parsed);
    assert_eq!(
        sections.x,
        hex_bytes(&Sha256::digest(1.0f32.to_le_bytes())),
        "x must be the Float32Array bytes"
    );
    assert_eq!(sections.y, hex_bytes(&Sha256::digest(0.0f32.to_le_bytes())));
    assert_ne!(sections.x, sections.y);
    assert_ne!(
        sections.reserve,
        hex_bytes(&Sha256::digest(1u16.to_be_bytes())),
        "reserve must be little-endian"
    );
    assert_eq!(
        sections.reserve,
        hex_bytes(&Sha256::digest(1u16.to_le_bytes()))
    );
    assert_eq!(sections.values().len(), SECTION_ORDER.len());
    for (got, expected) in sections.values().iter().zip(SECTION_ORDER) {
        assert_eq!(got.0, expected);
    }

    let mut changed = parsed.clone();
    changed.ticks.yaw[0] = 90.0;
    let (changed_sha, changed_sections) = hash_match(&changed);
    assert_ne!(sha256, changed_sha);
    assert_eq!(sections.events, changed_sections.events);
    assert_eq!(sections.header, changed_sections.header);
    assert_eq!(sections.grenades, changed_sections.grenades);
    assert_ne!(sections.yaw, changed_sections.yaw);

    let mut renamed = parsed.clone();
    renamed.header.map_name = "de_nuke".to_string();
    let (_, renamed_sections) = hash_match(&renamed);
    assert_ne!(sections.header, renamed_sections.header);
    assert_ne!(sections.events, renamed_sections.events);
    assert_eq!(sections.kills, renamed_sections.kills);
    assert_eq!(sections.grenades, renamed_sections.grenades);
    assert_eq!(
        sections.header,
        hex_bytes(&Sha256::digest(header.as_bytes())),
        "header hash is the header JSON bytes, not the framed events blob"
    );
}

#[test]
fn mismatch_names_the_sections_that_differ() {
    let expected = OutputHashes {
        demos: vec![
            demo_hash("a.dem", "overall-a", "events-a", "x-a"),
            demo_hash("gone.dem", "overall-g", "events-g", "x-g"),
        ],
    };
    let actual = OutputHashes {
        demos: vec![
            demo_hash("a.dem", "overall-b", "events-b", "x-a"),
            demo_hash("new.dem", "overall-n", "events-n", "x-n"),
        ],
    };
    let report = diff_report(&expected, &actual);
    assert!(report.contains("a.dem\n  events\n"), "{report}");
    assert!(report.contains("expected events-a"), "{report}");
    assert!(report.contains("got events-b"), "{report}");
    assert!(!report.contains("  x\n"), "{report}");
    assert!(!report.contains("  yaw\n"), "{report}");
    assert!(
        report.contains("new.dem: missing from output-hashes.json"),
        "{report}"
    );
    assert!(
        report.contains("gone.dem: in output-hashes.json but not parsed"),
        "{report}"
    );
}

#[test]
fn events_json_keys_follow_struct_fields_not_a_map() {
    let parsed = sample_match();
    let header = serde_json::to_string(&parsed.header)
        .unwrap_or_else(|err| panic!("could not serialize header: {err}"));
    // Declaration order. A `HashMap` or `BTreeMap` would not emit `map_name` first.
    assert_eq!(
        header,
        r#"{"map_name":"de_dust2","tick_rate":64.0,"tick_stride":4,"duration_s":1.0,"playback_ticks":64,"team_ct":"CT","team_t":"T","score_ct":0,"score_t":0}"#
    );
    let players = serde_json::to_string(&parsed.players)
        .unwrap_or_else(|err| panic!("could not serialize players: {err}"));
    assert_eq!(players, "[]");
    let again = events_payload(&parsed);
    assert_eq!(events_payload(&parsed), again);
}

#[test]
fn serde_json_f32_text_is_stable() {
    let values = [
        0.0f32,
        -0.0,
        1.0,
        -1.0,
        0.5,
        -1.25,
        0.1,
        64.0,
        90.0,
        1.0e20,
        f32::MIN_POSITIVE,
        16_777_216.0,
    ];
    for value in values {
        let once = json_f32(value);
        let twice = json_f32(value);
        assert_eq!(once, twice, "{value:?}");
        let back: f32 = serde_json::from_str(&once)
            .unwrap_or_else(|err| panic!("could not parse {once}: {err}"));
        assert_eq!(back.to_bits(), value.to_bits(), "{once} did not round-trip");
    }
    assert_eq!(json_f32(0.0), "0.0");
    assert_eq!(json_f32(-0.0), "-0.0");
    assert_eq!(json_f32(64.0), "64.0");
    assert_eq!(json_f32(0.5), "0.5");
    assert_eq!(json_f32(-1.25), "-1.25");
    assert_eq!(json_f32(0.1), "0.1");
}

fn json_f32(value: f32) -> String {
    serde_json::to_string(&value)
        .unwrap_or_else(|err| panic!("could not serialize {value:?}: {err}"))
}

fn demo_hash(name: &str, sha256: &str, events: &str, x: &str) -> DemoHash {
    DemoHash {
        name: name.to_string(),
        sha256: sha256.to_string(),
        sections: SectionHashes {
            events: events.to_string(),
            header: "header".to_string(),
            players: "players".to_string(),
            rounds: "rounds".to_string(),
            grenades: "grenades".to_string(),
            shots: "shots".to_string(),
            kills: "kills".to_string(),
            hurts: "hurts".to_string(),
            blinds: "blinds".to_string(),
            bomb_events: "bomb_events".to_string(),
            buy_events: "buy_events".to_string(),
            controller_dump: "controller_dump".to_string(),
            player_count: "player_count".to_string(),
            frame_count: "frame_count".to_string(),
            ticks: "ticks".to_string(),
            x: x.to_string(),
            y: "y".to_string(),
            z: "z".to_string(),
            yaw: "yaw".to_string(),
            health: "health".to_string(),
            armor: "armor".to_string(),
            flags: "flags".to_string(),
            money: "money".to_string(),
            equip: "equip".to_string(),
            gear: "gear".to_string(),
            primary: "primary".to_string(),
            secondary: "secondary".to_string(),
            active: "active".to_string(),
            clip: "clip".to_string(),
            reserve: "reserve".to_string(),
        },
    }
}

fn sample_match() -> Match {
    Match {
        header: cs2analyzer::MatchHeader {
            map_name: "de_dust2".to_string(),
            tick_rate: 64.0,
            tick_stride: 4,
            duration_s: 1.0,
            playback_ticks: 64,
            team_ct: "CT".to_string(),
            team_t: "T".to_string(),
            score_ct: 0,
            score_t: 0,
        },
        players: Vec::new(),
        rounds: Vec::new(),
        ticks: TickBuffer {
            frame_count: 1,
            player_count: 1,
            ticks: vec![0],
            x: vec![1.0],
            y: vec![0.0],
            z: vec![0.0],
            yaw: vec![0.0],
            health: vec![100],
            armor: vec![0],
            flags: vec![0],
            money: vec![0],
            equip: vec![0],
            gear: vec![0],
            primary: vec![0],
            secondary: vec![0],
            active: vec![0],
            clip: vec![0],
            reserve: vec![1],
        },
        grenades: Vec::new(),
        shots: Vec::new(),
        kills: Vec::new(),
        hurts: Vec::new(),
        blinds: Vec::new(),
        bomb_events: Vec::new(),
        buy_events: Vec::new(),
        stats: vec![cs2analyzer::PlayerStats::empty(0)],
        controller_dump: Vec::new(),
    }
}
