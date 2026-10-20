//! `player_blind` has no `userid_pawn`. Victims and the attacker must be the
//! controller at event userid + 1, including a self-flash.

use std::collections::BTreeSet;
use std::path::PathBuf;

use cs2analyzer::{parse_demo, Match, ParseOptions};

fn repo_root() -> PathBuf {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    root.canonicalize()
        .unwrap_or_else(|err| panic!("could not resolve {}: {err}", root.display()))
}

fn player_name(parsed: &Match, index: i8) -> &str {
    parsed
        .players
        .iter()
        .find(|player| i8::try_from(player.index) == Ok(index))
        .map(|player| player.name.as_str())
        .unwrap_or("")
}

#[test]
#[ignore = "needs ./scripts/run.sh --fetch-demos"]
fn premier_tick_2293_flash_names_haiiru_victims() {
    let path = repo_root().join("test-demos/files/premier-d2.dem");
    let bytes = std::fs::read(&path).unwrap_or_else(|err| panic!("read {}: {err}", path.display()));
    let parsed = parse_demo(
        &bytes,
        ParseOptions {
            tick_stride: 64,
            skip_warmup: true,
        },
    )
    .expect("parse premier-d2");

    let rows: Vec<_> = parsed
        .blinds
        .iter()
        .filter(|blind| blind.tick == 2293)
        .collect();
    assert_eq!(
        rows.len(),
        3,
        "three player_blind rows, including the self-flash"
    );
    let victims: BTreeSet<&str> = rows
        .iter()
        .map(|blind| player_name(&parsed, blind.victim))
        .collect();
    assert_eq!(
        victims,
        BTreeSet::from(["Haiiru", "Es", "cJ"]),
        "raw userid 9/7/8 are Haiiru, Es, and cJ — not the previous controller"
    );
    for blind in &rows {
        assert_eq!(
            player_name(&parsed, blind.attacker),
            "Haiiru",
            "attacker userid 9 is Haiiru"
        );
    }
    assert!(
        victims.contains("Haiiru"),
        "Haiiru flashed himself; that row stays"
    );
    assert!(
        parsed.blinds.iter().any(|blind| player_name(&parsed, blind.victim) == "!NOVAK!"),
        "userid 0 is !NOVAK! at controller index 1; dropping userid <= 0 removed every one of their blinds"
    );
}
