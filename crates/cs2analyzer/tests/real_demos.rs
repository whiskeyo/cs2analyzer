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
        let rounds = parsed.rounds.len();
        let begin_defuse = parsed
            .bomb_events
            .iter()
            .filter(|event| event.kind == BombKind::BeginDefuse)
            .count();
        let expected = expected_round_count(&name);
        let first = parsed.rounds.first();
        eprintln!(
            "real-demo {name} rounds={rounds} parse_ms={parse_ms} bomb_begindefuse={begin_defuse} first_number={} first_score={}-{}",
            first.map(|round| round.number).unwrap_or(0),
            first.map(|round| round.score_ct).unwrap_or(0),
            first.map(|round| round.score_t).unwrap_or(0),
        );
        assert_eq!(rounds, expected, "{name} round count");
        assert_eq!(
            first.map(|round| round.number),
            Some(1),
            "{name} should number the first played round 1"
        );
        assert_eq!(
            first.map(|round| (round.score_ct, round.score_t)),
            Some((0, 0)),
            "{name} should start the restarted match at 0-0"
        );
        assert!(
            first.is_some_and(|round| !round.is_knife),
            "{name} first played round is not a knife round"
        );
    }
}

/// Played rounds after the FACEIT knife restart. HLTV and Premier have no
/// post-knife `begin_new_match`, so their counts already excluded warmup.
fn expected_round_count(name: &str) -> usize {
    match name {
        "premier-d2.dem" => 15,
        "spirit-vs-dendele-m1-ancient.dem" => 21,
        "spirit-vs-furia-m1-ancient.dem" => 23,
        "spirit-vs-mouz-m3-ancient.dem" => 22,
        "legacy-vs-spirit-m2-ancient.dem" => 22,
        "spirit-vs-mouz-m4-nuke.dem" => 23,
        "1-898c8041-ac25-4ab8-8a2b-c384318aac1c-1-1.dem" => 16,
        "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem" => 35,
        "1-b3ea81e1-103d-4877-83d1-e5bbf1bcb7eb-1-1.dem" => 29,
        _ => panic!("no expected round count for {name}"),
    }
}
