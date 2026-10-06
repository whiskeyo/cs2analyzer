//! Parse every downloaded assets-v1 demo.
//!
//! `cargo test` skips this. `cargo test -- --ignored` runs it after
//! `./scripts/run.sh --fetch-demos`.

#[path = "common/mod.rs"]
mod common;

use std::path::Path;
use std::time::Instant;

use cs2analyzer::{
    parse_demo, BombKind, GrenadeKind, GrenadeThrow, ParseOptions, Round, SMOKE_DURATION_SECONDS,
};
use source2_demo::prelude::*;

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

#[derive(Clone)]
struct SmokeDetonate {
    entity: i32,
    tick: u32,
    x: f32,
    y: f32,
    z: f32,
}

#[derive(Clone)]
struct SmokeExpire {
    entity: i32,
    tick: u32,
}

#[derive(Default)]
struct SmokeEvents {
    detonates: Vec<SmokeDetonate>,
    expires: Vec<SmokeExpire>,
}

fn event_i32(ge: &GameEvent<'_>, key: &str) -> i32 {
    ge.get_value(key)
        .ok()
        .and_then(|value| TryInto::<i32>::try_into(value).ok())
        .unwrap_or(0)
}

fn event_f32(ge: &GameEvent<'_>, key: &str) -> f32 {
    let Ok(value) = ge.get_value(key) else {
        return 0.0;
    };
    if let Ok(number) = TryInto::<f32>::try_into(value) {
        return number;
    }
    if let Ok(number) = TryInto::<i32>::try_into(value) {
        return number as f32;
    }
    0.0
}

fn warmup_period(ctx: &Context) -> bool {
    let Ok(proxy) = ctx.entities().get_by_class_name("CCSGameRulesProxy") else {
        return false;
    };
    matches!(
        proxy.get_property("m_pGameRules.m_bWarmupPeriod"),
        Ok(FieldValue::Boolean(true))
    )
}

#[observer]
#[uses_entities]
#[uses_game_events]
impl SmokeEvents {
    #[on_game_event]
    fn on_game_event(&mut self, ctx: &Context, ge: &GameEvent) -> ObserverResult {
        // Same skip as the parser (`ParseOptions::skip_warmup`). Warmup ticks
        // are earlier than live play, but a flagged gap must not open a window.
        if warmup_period(ctx) {
            return Ok(());
        }
        match ge.name() {
            "smokegrenade_detonate" => self.detonates.push(SmokeDetonate {
                entity: event_i32(ge, "entityid"),
                tick: ctx.tick(),
                x: event_f32(ge, "x"),
                y: event_f32(ge, "y"),
                z: event_f32(ge, "z"),
            }),
            "smokegrenade_expired" => self.expires.push(SmokeExpire {
                entity: event_i32(ge, "entityid"),
                tick: ctx.tick(),
            }),
            _ => {}
        }
        Ok(())
    }
}

fn collect_smoke_events(bytes: &[u8]) -> (Vec<SmokeDetonate>, Vec<SmokeExpire>) {
    let mut parser = Parser::new(bytes)
        .unwrap_or_else(|err| panic!("could not open demo for smoke events: {err}"));
    let handle = parser.add_observer(SmokeEvents::default());
    parser
        .run_to_end()
        .unwrap_or_else(|err| panic!("could not read smoke events: {err}"));
    let events = handle.borrow();
    (events.detonates.clone(), events.expires.clone())
}

fn claim_detonate(
    grenade: &GrenadeThrow,
    detonates: &[SmokeDetonate],
    used: &mut [bool],
) -> Option<usize> {
    let mut hits = Vec::new();
    for (index, detonate) in detonates.iter().enumerate() {
        if !used[index] && detonate.tick == grenade.detonate_tick {
            hits.push(index);
        }
    }
    if hits.len() == 1 {
        return Some(hits[0]);
    }
    let land = grenade.points.last()?;
    let positioned: Vec<usize> = hits
        .into_iter()
        .filter(|&index| {
            let detonate = &detonates[index];
            detonate.x == land.x && detonate.y == land.y && detonate.z == land.z
        })
        .collect();
    if positioned.len() == 1 {
        Some(positioned[0])
    } else {
        None
    }
}

fn next_smoke_detonate(detonates: &[SmokeDetonate], entity: i32, detonate: u32) -> Option<u32> {
    detonates
        .iter()
        .filter(|event| event.entity == entity && event.tick > detonate)
        .map(|event| event.tick)
        .min()
}

fn expire_in_window(
    expires: &[SmokeExpire],
    entity: i32,
    detonate: u32,
    next: Option<u32>,
) -> Option<u32> {
    expires
        .iter()
        .filter(|event| {
            if event.entity != entity || event.tick <= detonate {
                return false;
            }
            next.is_none_or(|next_tick| event.tick < next_tick)
        })
        .map(|event| event.tick)
        .min()
}

fn next_round_start(rounds: &[Round], owner: &Round) -> Option<u32> {
    rounds
        .iter()
        .filter(|round| round.start_tick > owner.start_tick)
        .map(|round| round.start_tick)
        .min()
}

struct SmokeCensus {
    demo: &'static str,
    smokes: usize,
    with_expire: usize,
    without_expire: usize,
    after_round_end: usize,
}

/// Measured on the assets-v1 demos. `without_expire` is 4–14. More smokes
/// outlive `round.end_tick` than a first pass suggested (8–25); each of those
/// still ends by the next round's `start_tick`.
const SMOKE_CENSUS: &[SmokeCensus] = &[
    SmokeCensus {
        demo: "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem",
        smokes: 160,
        with_expire: 146,
        without_expire: 14,
        after_round_end: 25,
    },
    SmokeCensus {
        demo: "1-898c8041-ac25-4ab8-8a2b-c384318aac1c-1-1.dem",
        smokes: 52,
        with_expire: 44,
        without_expire: 8,
        after_round_end: 10,
    },
    SmokeCensus {
        demo: "1-b3ea81e1-103d-4877-83d1-e5bbf1bcb7eb-1-1.dem",
        smokes: 124,
        with_expire: 116,
        without_expire: 8,
        after_round_end: 20,
    },
    SmokeCensus {
        demo: "legacy-vs-spirit-m2-ancient.dem",
        smokes: 149,
        with_expire: 145,
        without_expire: 4,
        after_round_end: 8,
    },
    SmokeCensus {
        demo: "premier-d2.dem",
        smokes: 45,
        with_expire: 38,
        without_expire: 7,
        after_round_end: 13,
    },
    SmokeCensus {
        demo: "spirit-vs-dendele-m1-ancient.dem",
        smokes: 139,
        with_expire: 133,
        without_expire: 6,
        after_round_end: 8,
    },
    SmokeCensus {
        demo: "spirit-vs-furia-m1-ancient.dem",
        smokes: 160,
        with_expire: 152,
        without_expire: 8,
        after_round_end: 20,
    },
    SmokeCensus {
        demo: "spirit-vs-mouz-m3-ancient.dem",
        smokes: 149,
        with_expire: 143,
        without_expire: 6,
        after_round_end: 11,
    },
    SmokeCensus {
        demo: "spirit-vs-mouz-m4-nuke.dem",
        smokes: 176,
        with_expire: 168,
        without_expire: 8,
        after_round_end: 15,
    },
];

fn expected_smoke_census(name: &str) -> &'static SmokeCensus {
    SMOKE_CENSUS
        .iter()
        .find(|row| row.demo == name)
        .unwrap_or_else(|| panic!("no smoke census for {name}"))
}

/// Smokes end on the expire inside their entity window, or on the 22s /
/// next-round / demo-end cap. They may outlive `round.end_tick`.
#[test]
#[ignore = "needs ./scripts/run.sh --fetch-demos"]
fn smokes_end_on_the_expire_inside_their_entity_window() {
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
        let (detonates, expires) = collect_smoke_events(&bytes);
        let life = (SMOKE_DURATION_SECONDS * parsed.header.tick_rate).round() as u32;
        let last_tick = parsed.header.playback_ticks.max(
            parsed
                .ticks
                .ticks
                .last()
                .copied()
                .unwrap_or(parsed.header.playback_ticks),
        );
        let mut used = vec![false; detonates.len()];
        let mut smokes = 0usize;
        let mut with_expire = 0usize;
        let mut without_expire = 0usize;
        let mut after_round_end = 0usize;
        for grenade in parsed
            .grenades
            .iter()
            .filter(|grenade| grenade.kind == GrenadeKind::Smoke)
        {
            smokes += 1;
            let index = claim_detonate(grenade, &detonates, &mut used).unwrap_or_else(|| {
                let same_tick = detonates
                    .iter()
                    .filter(|detonate| detonate.tick == grenade.detonate_tick)
                    .count();
                let land = grenade.points.last();
                panic!(
                    "{name} smoke at {} did not match a smokegrenade_detonate (same_tick={same_tick}, points={}, land={land:?})",
                    grenade.detonate_tick,
                    grenade.points.len()
                )
            });
            used[index] = true;
            let entity = detonates[index].entity;
            let next = next_smoke_detonate(&detonates, entity, grenade.detonate_tick);
            let owner_index =
                round_owning(&parsed.rounds, grenade.detonate_tick).unwrap_or_else(|| {
                    panic!(
                        "{name} smoke at {} is before every round",
                        grenade.detonate_tick
                    )
                });
            let owner = &parsed.rounds[owner_index];
            let bound = next_round_start(&parsed.rounds, owner).unwrap_or(last_tick);
            let horizon = bound.min(last_tick);
            assert!(
                grenade.detonate_tick <= grenade.end_tick && grenade.end_tick <= horizon,
                "{name} smoke entity {entity} {} -> {} outside detonate..={horizon} (round {} ends {})",
                grenade.detonate_tick,
                grenade.end_tick,
                owner.number,
                owner.end_tick
            );
            if grenade.end_tick > owner.end_tick {
                after_round_end += 1;
            }
            if let Some(expire) = expire_in_window(&expires, entity, grenade.detonate_tick, next) {
                assert_eq!(
                    grenade.end_tick, expire,
                    "{name} smoke entity {entity} at {} paired outside its window (expire {expire}, next {next:?})",
                    grenade.detonate_tick
                );
                with_expire += 1;
            } else {
                let outside = expires
                    .iter()
                    .any(|event| event.entity == entity && event.tick == grenade.end_tick);
                assert!(
                    !outside,
                    "{name} smoke entity {entity} at {} paired with an expire outside its window",
                    grenade.detonate_tick
                );
                assert!(
                    grenade.end_tick <= grenade.detonate_tick.saturating_add(life),
                    "{name} smoke entity {entity} at {} runs past {life} ticks",
                    grenade.detonate_tick
                );
                without_expire += 1;
            }
        }
        eprintln!(
            "smoke-end {name} smokes={smokes} with_expire={with_expire} without_expire={without_expire} after_round_end={after_round_end}"
        );
        let expected = expected_smoke_census(name);
        assert_eq!(smokes, expected.smokes, "{name} smokes");
        assert_eq!(with_expire, expected.with_expire, "{name} with expire");
        assert_eq!(
            without_expire, expected.without_expire,
            "{name} without expire"
        );
        assert_eq!(
            after_round_end, expected.after_round_end,
            "{name} ending after round end"
        );
    }
}
