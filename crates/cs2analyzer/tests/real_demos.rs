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
        assert!(rounds > 0, "{name} parsed but recorded no rounds");
        eprintln!(
            "real-demo {name} rounds={rounds} parse_ms={parse_ms} bomb_begindefuse={begin_defuse}"
        );
    }
}
