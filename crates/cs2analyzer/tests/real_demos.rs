//! Parse every downloaded assets-v1 demo.
//!
//! `cargo test` skips this. `cargo test -- --ignored` runs it after
//! `./scripts/run.sh --fetch-demos`.

#[path = "common/mod.rs"]
mod common;

use std::time::Instant;

use cs2analyzer::{parse_demo, BombKind, ParseOptions};

#[test]
#[ignore = "needs ./scripts/run.sh --fetch-demos"]
fn parses_release_demos() {
    let demos = common::require_demo_files();
    for path in demos {
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("demo")
            .to_string();
        let bytes =
            std::fs::read(&path).unwrap_or_else(|err| panic!("could not read {name}: {err}"));
        let started = Instant::now();
        let parsed = parse_demo(&bytes, ParseOptions::default())
            .unwrap_or_else(|err| panic!("{name} failed to parse: {err}"));
        let parse_ms = started.elapsed().as_millis();
        let played = parsed.rounds.iter().filter(|round| !round.is_knife).count();
        let knife = parsed.rounds.iter().filter(|round| round.is_knife).count();
        let begin_defuse = parsed
            .bomb_events
            .iter()
            .filter(|event| event.kind == BombKind::BeginDefuse)
            .count();
        let (expected_played, expected_knife) = expected_rounds(&name);
        eprintln!(
            "real-demo {name} played={played} knife={knife} parse_ms={parse_ms} bomb_begindefuse={begin_defuse}"
        );
        assert_eq!(played, expected_played, "{name} played rounds");
        assert_eq!(knife, expected_knife, "{name} knife rounds");
        assert!(
            parsed
                .rounds
                .iter()
                .filter(|round| round.is_knife)
                .all(|round| round.number == 0),
            "{name} knife round should be number 0"
        );
    }
}

/// Played rounds (excluding `is_knife`) and knife rounds.
///
/// FACEIT keeps the knife round in the output (`is_knife`, number 0). HLTV and
/// Premier have no knife round.
fn expected_rounds(name: &str) -> (usize, usize) {
    match name {
        "premier-d2.dem" => (15, 0),
        "spirit-vs-dendele-m1-ancient.dem" => (21, 0),
        "spirit-vs-furia-m1-ancient.dem" => (23, 0),
        "spirit-vs-mouz-m3-ancient.dem" => (22, 0),
        "legacy-vs-spirit-m2-ancient.dem" => (22, 0),
        "spirit-vs-mouz-m4-nuke.dem" => (23, 0),
        "1-898c8041-ac25-4ab8-8a2b-c384318aac1c-1-1.dem" => (16, 1),
        "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem" => (35, 1),
        "1-b3ea81e1-103d-4877-83d1-e5bbf1bcb7eb-1-1.dem" => (29, 1),
        _ => panic!("no expected round count for {name}"),
    }
}
