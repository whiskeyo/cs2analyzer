//! Parse every downloaded assets-v1 demo.
//!
//! `cargo test` skips this. `cargo test -- --ignored` runs it after
//! `./scripts/run.sh --fetch-demos`.

#[path = "common/mod.rs"]
mod common;

use std::path::Path;
use std::time::Instant;

use cs2analyzer::{parse_demo, BombKind, GrenadeKind, ParseOptions, Round};

#[test]
fn missing_demos_with_ignored_is_a_failure_not_a_skip() {
    let dir = Path::new("test-demos/files");
    let failure = common::demos_unavailable_message(dir, true);
    assert!(
        !failure.starts_with("skip:"),
        "a --ignored run with no demos must fail, not look like a skip: {failure}"
    );
    assert!(
        failure.contains("missing"),
        "failure message should say the demos are missing: {failure}"
    );
    let skip = common::demos_unavailable_message(dir, false);
    assert!(
        skip.starts_with("skip:"),
        "a run that is not --ignored keeps the plain skip: {skip}"
    );
}

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

struct OpenFire {
    /// Substring of the demo file name.
    demo: &'static str,
    /// `inferno_startburn` entity id. The JSON does not store it; the burn tick identifies the fire.
    entity: i32,
    startburn: u32,
    end: u32,
}

/// Molotovs with no `inferno_expire`. Each one starts after its round's
/// `end_tick`, and the next round-open tick is sooner than startburn + 450.
const OPEN_FIRES: &[OpenFire] = &[
    OpenFire {
        demo: "1-0eb2df7f",
        entity: 783,
        startburn: 208060,
        end: 208470,
    },
    OpenFire {
        demo: "1-898c8041",
        entity: 342,
        startburn: 46875,
        end: 47275,
    },
    OpenFire {
        demo: "furia",
        entity: 98,
        startburn: 72707,
        end: 73063,
    },
    OpenFire {
        demo: "furia",
        entity: 319,
        startburn: 121984,
        end: 122319,
    },
    OpenFire {
        demo: "mouz-m3",
        entity: 190,
        startburn: 95814,
        end: 96184,
    },
    OpenFire {
        demo: "mouz-m4-nuke",
        entity: 685,
        startburn: 202037,
        end: 202395,
    },
];

/// Last round whose freeze has started at `tick`: `[start_tick, next start)`.
fn round_owning(rounds: &[Round], tick: u32) -> Option<usize> {
    rounds.iter().rposition(|round| round.start_tick <= tick)
}

#[test]
#[ignore = "needs ./scripts/run.sh --fetch-demos"]
fn open_fires_end_at_the_next_freeze_in_the_round_they_were_thrown() {
    let demos = common::require_demo_files();
    let mut parsed_by_demo: Vec<(&str, cs2analyzer::Match)> = Vec::new();
    for fire in OPEN_FIRES {
        if parsed_by_demo.iter().any(|(demo, _)| *demo == fire.demo) {
            continue;
        }
        let path = demos.iter().find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.contains(fire.demo))
        });
        let path = path.unwrap_or_else(|| panic!("no demo matching {}", fire.demo));
        let name = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(fire.demo);
        let bytes =
            std::fs::read(path).unwrap_or_else(|err| panic!("could not read {name}: {err}"));
        let parsed = parse_demo(&bytes, ParseOptions::default())
            .unwrap_or_else(|err| panic!("{name} failed to parse: {err}"));
        parsed_by_demo.push((fire.demo, parsed));
    }
    for fire in OPEN_FIRES {
        if std::env::var_os("CS2_EVENT_NAMES").is_some() && fire.demo != "furia" {
            continue;
        }
        let parsed = parsed_by_demo
            .iter()
            .find(|(demo, _)| *demo == fire.demo)
            .map(|(_, parsed)| parsed)
            .unwrap_or_else(|| panic!("missing parse for {}", fire.demo));
        let name = fire.demo;
        let matched: Vec<_> = parsed
            .grenades
            .iter()
            .filter(|grenade| {
                grenade.kind == GrenadeKind::Molotov && grenade.detonate_tick == fire.startburn
            })
            .collect();
        assert_eq!(
            matched.len(),
            1,
            "{name} inferno {} startburn {} matched {} molotovs",
            fire.entity,
            fire.startburn,
            matched.len()
        );
        let grenade = matched[0];
        assert_eq!(
            grenade.end_tick, fire.end,
            "{name} inferno {} end tick",
            fire.entity
        );
        for cell in &grenade.fires {
            assert!(
                cell.end_tick <= fire.end,
                "{name} inferno {} flame cell {} extends past {}",
                fire.entity,
                cell.end_tick,
                fire.end
            );
            assert!(
                cell.start_tick <= cell.end_tick,
                "{name} inferno {} flame cell starts after it ends",
                fire.entity
            );
        }

        let owner_index = round_owning(&parsed.rounds, fire.startburn).unwrap_or_else(|| {
            panic!(
                "{name} inferno {} startburn {} is before every round",
                fire.entity, fire.startburn
            )
        });
        let owner = &parsed.rounds[owner_index];
        let next_start = parsed
            .rounds
            .get(owner_index + 1)
            .map(|round| round.start_tick);
        assert!(
            grenade.start_tick >= owner.start_tick,
            "{name} inferno {} throw {} is before round {} start {}",
            fire.entity,
            grenade.start_tick,
            owner.number,
            owner.start_tick
        );
        if let Some(next) = next_start {
            assert!(
                grenade.start_tick < next,
                "{name} inferno {} throw {} belongs to the next round at {next}",
                fire.entity,
                grenade.start_tick
            );
            assert!(
                fire.startburn < next,
                "{name} inferno {} burn is already in the next round",
                fire.entity
            );
        }
        assert!(
            fire.startburn > owner.end_tick,
            "{name} inferno {} burn {} is not after round {} end {}",
            fire.entity,
            fire.startburn,
            owner.number,
            owner.end_tick
        );
        let closed = parsed
            .rounds
            .iter()
            .find(|round| fire.startburn >= round.start_tick && fire.startburn <= round.end_tick);
        assert!(
            closed.is_none(),
            "{name} inferno {} would land in round {} if the window used end_tick",
            fire.entity,
            closed.map(|round| round.number).unwrap_or(0)
        );
        eprintln!(
            "open-fire {name} inferno {} round {} {} -> {} cells {}",
            fire.entity,
            owner.number,
            fire.startburn,
            grenade.end_tick,
            grenade.fires.len()
        );
    }
}

/// A flame cell belongs to the burn that was already going when it started.
#[test]
#[ignore = "needs ./scripts/run.sh --fetch-demos"]
fn molotov_flames_stay_inside_their_burn_window() {
    let demos = common::require_demo_files();
    for path in demos {
        let name = path
            .file_name()
            .and_then(|file| file.to_str())
            .unwrap_or("demo");
        let bytes =
            std::fs::read(&path).unwrap_or_else(|err| panic!("could not read {name}: {err}"));
        let parsed = parse_demo(&bytes, ParseOptions::default())
            .unwrap_or_else(|err| panic!("{name} failed to parse: {err}"));
        let outside = parsed
            .grenades
            .iter()
            .filter(|grenade| {
                grenade.kind.is_fire()
                    && grenade.fires.iter().any(|cell| {
                        cell.start_tick < grenade.detonate_tick
                            || cell.start_tick > grenade.end_tick
                    })
            })
            .count();
        eprintln!("out-of-window {name} {outside}");
        assert_eq!(
            outside, 0,
            "{name} has {outside} molotovs with flames outside the burn window"
        );
    }
}
