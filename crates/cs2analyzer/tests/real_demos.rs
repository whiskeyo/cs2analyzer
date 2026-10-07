//! Parse every downloaded assets-v1 demo once.
//!
//! `cargo test` skips the demo walk. `cargo test -- --ignored` runs it after
//! `./scripts/run.sh --fetch-demos`.
//!
//! Each demo is parsed once. Every check for that demo runs on that `Match`,
//! then the `Match` is dropped before the next file so the peak is one demo.
//! Smoke checks still take one raw `Parser` pass: they read `smokegrenade_*`
//! events and `m_nRoundStartCount` edges the `Match` does not store.
//!
//! A failed check is a line `<demo> :: <check> :: <message>`. The walk keeps
//! going and panics at the end with every line.

#[path = "common/mod.rs"]
mod common;

use std::collections::{BTreeMap, BTreeSet};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;
use std::time::Instant;

use cs2analyzer::{
    parse_demo, BombKind, GrenadeKind, GrenadeThrow, Match, ParseOptions, Round,
    SMOKE_DURATION_SECONDS,
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

const CHECK_ROUND_COUNTS: &str = "round-counts";
const CHECK_MOLOTOV: &str = "molotov-burn-window";
const CHECK_SMOKE: &str = "smoke-end";
const CHECK_DEMO_END: &str = "demo-end-smoke";
const CHECK_PARSE: &str = "parse";
const CHECK_READ: &str = "read";
const CHECK_COUNT: &str = "check-count";
/// Cross-demo rollups. Not a file name.
const ALL_DEMOS: &str = "all";
const GLOBAL_CHECK_COUNT: usize = 4;
const MISSING_DEMO: &str = "demo was not in this run";

/// Round counts from #111 and the smoke census measured on assets-v1.
struct DemoExpect {
    name: &'static str,
    /// Played rounds, excluding `is_knife`.
    played: usize,
    knife: usize,
    smokes: usize,
    with_expire: usize,
    without_expire: usize,
    after_round_end: usize,
}

/// FACEIT keeps the knife round (`is_knife`, number 0). HLTV and Premier have none.
const DEMO_EXPECTATIONS: &[DemoExpect] = &[
    DemoExpect {
        name: "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem",
        played: 35,
        knife: 1,
        smokes: 160,
        with_expire: 146,
        without_expire: 14,
        after_round_end: 25,
    },
    DemoExpect {
        name: "1-898c8041-ac25-4ab8-8a2b-c384318aac1c-1-1.dem",
        played: 16,
        knife: 1,
        smokes: 52,
        with_expire: 44,
        without_expire: 8,
        after_round_end: 10,
    },
    DemoExpect {
        name: "1-b3ea81e1-103d-4877-83d1-e5bbf1bcb7eb-1-1.dem",
        played: 29,
        knife: 1,
        smokes: 124,
        with_expire: 116,
        without_expire: 8,
        after_round_end: 20,
    },
    DemoExpect {
        name: "legacy-vs-spirit-m2-ancient.dem",
        played: 22,
        knife: 0,
        smokes: 149,
        with_expire: 145,
        without_expire: 4,
        after_round_end: 8,
    },
    DemoExpect {
        name: "premier-d2.dem",
        played: 15,
        knife: 0,
        smokes: 45,
        with_expire: 38,
        without_expire: 7,
        after_round_end: 13,
    },
    DemoExpect {
        name: "spirit-vs-dendele-m1-ancient.dem",
        played: 21,
        knife: 0,
        smokes: 139,
        with_expire: 133,
        without_expire: 6,
        after_round_end: 8,
    },
    DemoExpect {
        name: "spirit-vs-furia-m1-ancient.dem",
        played: 23,
        knife: 0,
        smokes: 160,
        with_expire: 152,
        without_expire: 8,
        after_round_end: 20,
    },
    DemoExpect {
        name: "spirit-vs-mouz-m3-ancient.dem",
        played: 22,
        knife: 0,
        smokes: 149,
        with_expire: 143,
        without_expire: 6,
        after_round_end: 11,
    },
    DemoExpect {
        name: "spirit-vs-mouz-m4-nuke.dem",
        played: 23,
        knife: 0,
        smokes: 176,
        with_expire: 168,
        without_expire: 8,
        after_round_end: 15,
    },
];

struct OpenFire {
    /// Manifest file name. A demo that never appears in the run fails this check.
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
        demo: "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem",
        entity: 783,
        startburn: 208060,
        end: 208470,
    },
    OpenFire {
        demo: "1-898c8041-ac25-4ab8-8a2b-c384318aac1c-1-1.dem",
        entity: 342,
        startburn: 46875,
        end: 47275,
    },
    OpenFire {
        demo: "spirit-vs-furia-m1-ancient.dem",
        entity: 98,
        startburn: 72707,
        end: 73063,
    },
    OpenFire {
        demo: "spirit-vs-furia-m1-ancient.dem",
        entity: 319,
        startburn: 121984,
        end: 122319,
    },
    OpenFire {
        demo: "spirit-vs-mouz-m3-ancient.dem",
        entity: 190,
        startburn: 95814,
        end: 96184,
    },
    OpenFire {
        demo: "spirit-vs-mouz-m4-nuke.dem",
        entity: 685,
        startburn: 202037,
        end: 202395,
    },
];

struct DemoEndSmoke {
    demo: &'static str,
    /// Detonate tick of the missing-expire smoke.
    detonate: u32,
    /// Last sampled tick, where that smoke ends.
    end: u32,
}

/// 228691 and 81808 are the detonate ticks. Both clouds stop on the last
/// sampled tick (a couple of ticks before playback_ticks), not on +22s.
const DEMO_END_SMOKES: &[DemoEndSmoke] = &[
    DemoEndSmoke {
        demo: "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem",
        detonate: 228_691,
        end: 230_008,
    },
    DemoEndSmoke {
        demo: "premier-d2.dem",
        detonate: 81_808,
        end: 83_030,
    },
];

/// Literal so a dropped `report.run` fails the count even if the name list
/// and the call were edited together. Keep this, [`demo_check_names`], and
/// [`run_demo_checks`] in step.
fn expected_check_count(name: &str) -> usize {
    match name {
        "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem" => 5,
        "1-898c8041-ac25-4ab8-8a2b-c384318aac1c-1-1.dem" => 5,
        "spirit-vs-furia-m1-ancient.dem" => 6,
        "spirit-vs-mouz-m3-ancient.dem" => 5,
        "spirit-vs-mouz-m4-nuke.dem" => 5,
        _ => 4,
    }
}

fn open_fire_check_name(entity: i32) -> String {
    format!("open-fire-{entity}")
}

fn demo_check_names(demo: &str) -> Vec<String> {
    let mut names = vec![CHECK_ROUND_COUNTS.to_string(), CHECK_MOLOTOV.to_string()];
    for fire in OPEN_FIRES {
        if fire.demo == demo {
            names.push(open_fire_check_name(fire.entity));
        }
    }
    names.push(CHECK_SMOKE.to_string());
    names.push(CHECK_DEMO_END.to_string());
    names
}

fn lookup_demo(name: &str) -> Option<&'static DemoExpect> {
    DEMO_EXPECTATIONS.iter().find(|row| row.name == name)
}

struct AssertSink {
    failures: Vec<String>,
}

impl AssertSink {
    fn fail(&mut self, message: impl Into<String>) {
        self.failures.push(message.into());
    }
}

#[derive(Default)]
struct FailureReport {
    lines: Vec<String>,
    executed: BTreeMap<String, usize>,
}

impl FailureReport {
    fn executed(&self, demo: &str) -> usize {
        self.executed.get(demo).copied().unwrap_or(0)
    }

    /// Counts the check as executed, then records every assert that fails.
    /// A panic inside the check is one more line. Later checks still run.
    fn run(&mut self, demo: &str, check: &str, body: impl FnOnce(&mut AssertSink)) {
        *self.executed.entry(demo.to_string()).or_default() += 1;
        let mut sink = AssertSink {
            failures: Vec::new(),
        };
        let panicked = catch_unwind(AssertUnwindSafe(|| body(&mut sink)));
        for message in sink.failures {
            self.lines.push(failure_line(demo, check, &message));
        }
        if let Err(payload) = panicked {
            self.lines
                .push(failure_line(demo, check, &panic_message(payload)));
        }
    }

    fn fail(&mut self, demo: &str, check: &str, message: impl std::fmt::Display) {
        self.lines
            .push(failure_line(demo, check, &message.to_string()));
    }

    /// Panics with exactly the failure lines, one per line, when any check failed.
    fn finish(self) {
        if !self.lines.is_empty() {
            panic!("{}", self.lines.join("\n"));
        }
    }
}

fn failure_line(demo: &str, check: &str, message: &str) -> String {
    format!(
        "{demo} :: {check} :: {}",
        message.replace(['\n', '\r'], " ")
    )
}

fn panic_message(payload: Box<dyn std::any::Any + Send>) -> String {
    if let Some(message) = payload.downcast_ref::<&str>() {
        return (*message).to_string();
    }
    if let Some(message) = payload.downcast_ref::<String>() {
        return message.clone();
    }
    "panic (non-string payload)".to_string()
}

fn enforce_check_count(report: &mut FailureReport, demo: &str, expected: usize) {
    let executed = report.executed(demo);
    if executed != expected {
        report.fail(
            demo,
            CHECK_COUNT,
            format!("executed {executed}, expected {expected}"),
        );
    }
}

/// Parse `demo`. A `Err` or a panic is `<demo> :: parse :: ...` and the other
/// demos still run. Checks run only after a successful parse. The returned
/// value is the caller's to drop before the next demo.
fn visit_demo<T, F, C>(
    report: &mut FailureReport,
    demo: &str,
    parse: F,
    checks: C,
    expected_checks: usize,
) -> Option<T>
where
    F: FnOnce() -> Result<T, String>,
    C: FnOnce(&mut FailureReport, &T),
{
    let parsed = catch_unwind(AssertUnwindSafe(parse));
    let value = match parsed {
        Ok(Ok(value)) => Some(value),
        Ok(Err(message)) => {
            report.fail(demo, CHECK_PARSE, message);
            None
        }
        Err(payload) => {
            report.fail(demo, CHECK_PARSE, panic_message(payload));
            None
        }
    };
    if let Some(value) = &value {
        checks(report, value);
    }
    enforce_check_count(report, demo, expected_checks);
    value
}

fn record_missing_demo(report: &mut FailureReport, demo: &str) {
    for check_name in demo_check_names(demo) {
        report.run(demo, &check_name, |check| {
            check.fail(MISSING_DEMO);
        });
    }
    enforce_check_count(report, demo, expected_check_count(demo));
}

struct ParsedDemo {
    parsed: Match,
    parse_ms: u128,
}

#[derive(Default)]
struct SmokeRollup {
    missing_expire: usize,
    ended_at_round_open: usize,
    ended_at_demo_end: Vec<(String, u32, u32)>,
}

fn demo_file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("demo")
        .to_string()
}

/// One ignored test. Each file is read, parsed, checked, and dropped before
/// the next so a failure in one check cannot hide the rest.
#[test]
#[ignore = "needs ./scripts/run.sh --fetch-demos"]
fn parses_each_release_demo_once() {
    let demos = common::require_demo_files();
    let mut report = FailureReport::default();
    let mut rollup = SmokeRollup::default();
    let mut seen = BTreeSet::new();
    for path in demos {
        let name = demo_file_name(&path);
        seen.insert(name.clone());
        let bytes = match std::fs::read(&path) {
            Ok(bytes) => bytes,
            Err(err) => {
                report.fail(&name, CHECK_READ, format!("could not read {name}: {err}"));
                enforce_check_count(&mut report, &name, expected_check_count(&name));
                continue;
            }
        };
        let held = visit_demo(
            &mut report,
            &name,
            || {
                let started = Instant::now();
                let result =
                    parse_demo(&bytes, ParseOptions::default()).map_err(|err| err.to_string());
                let parse_ms = started.elapsed().as_millis();
                result.map(|parsed| ParsedDemo { parsed, parse_ms })
            },
            |report, timed| {
                run_demo_checks(
                    report,
                    &name,
                    &timed.parsed,
                    &bytes,
                    timed.parse_ms,
                    &mut rollup,
                );
            },
            expected_check_count(&name),
        );
        drop(held);
        drop(bytes);
    }
    for row in DEMO_EXPECTATIONS {
        if !seen.contains(row.name) {
            record_missing_demo(&mut report, row.name);
        }
    }
    run_global_checks(&mut report, &rollup);
    report.finish();
}

/// New per-demo checks go in this function, in [`demo_check_names`], and as a
/// literal arm of [`expected_check_count`].
fn run_demo_checks(
    report: &mut FailureReport,
    name: &str,
    parsed: &Match,
    bytes: &[u8],
    parse_ms: u128,
    rollup: &mut SmokeRollup,
) {
    report.run(name, CHECK_ROUND_COUNTS, |check| {
        check_round_counts(check, name, parsed, parse_ms);
    });
    report.run(name, CHECK_MOLOTOV, |check| {
        check_molotov_burn_window(check, name, parsed);
    });
    for fire in OPEN_FIRES.iter().filter(|fire| fire.demo == name) {
        let check_name = open_fire_check_name(fire.entity);
        report.run(name, &check_name, |check| {
            check_open_fire(check, name, parsed, fire);
        });
    }
    report.run(name, CHECK_SMOKE, |check| {
        check_smoke_end(check, name, parsed, bytes, rollup);
    });
    report.run(name, CHECK_DEMO_END, |check| {
        check_demo_end_smoke(check, name, rollup);
    });
}

fn check_round_counts(check: &mut AssertSink, name: &str, parsed: &Match, parse_ms: u128) {
    let played = parsed.rounds.iter().filter(|round| !round.is_knife).count();
    let knife = parsed.rounds.iter().filter(|round| round.is_knife).count();
    let begin_defuse = parsed
        .bomb_events
        .iter()
        .filter(|event| event.kind == BombKind::BeginDefuse)
        .count();
    eprintln!(
        "real-demo {name} played={played} knife={knife} parse_ms={parse_ms} bomb_begindefuse={begin_defuse}"
    );
    match lookup_demo(name) {
        Some(expected) => {
            if played != expected.played {
                check.fail(format!(
                    "{name} played rounds: got {played}, expected {}",
                    expected.played
                ));
            }
            if knife != expected.knife {
                check.fail(format!(
                    "{name} knife rounds: got {knife}, expected {}",
                    expected.knife
                ));
            }
        }
        None => check.fail(format!("no expected round count for {name}")),
    }
    if parsed
        .rounds
        .iter()
        .filter(|round| round.is_knife)
        .any(|round| round.number != 0)
    {
        check.fail(format!("{name} knife round should be number 0"));
    }
}

fn check_molotov_burn_window(check: &mut AssertSink, name: &str, parsed: &Match) {
    let outside = parsed
        .grenades
        .iter()
        .filter(|grenade| {
            grenade.kind.is_fire()
                && grenade.fires.iter().any(|cell| {
                    cell.start_tick < grenade.detonate_tick || cell.start_tick > grenade.end_tick
                })
        })
        .count();
    eprintln!("out-of-window {name} {outside}");
    if outside != 0 {
        check.fail(format!(
            "{name} has {outside} molotovs with flames outside the burn window"
        ));
    }
}

fn check_open_fire(check: &mut AssertSink, name: &str, parsed: &Match, fire: &OpenFire) {
    let matched: Vec<_> = parsed
        .grenades
        .iter()
        .filter(|grenade| {
            grenade.kind == GrenadeKind::Molotov && grenade.detonate_tick == fire.startburn
        })
        .collect();
    if matched.len() != 1 {
        check.fail(format!(
            "{name} inferno {} startburn {} matched {} molotovs",
            fire.entity,
            fire.startburn,
            matched.len()
        ));
        check.fail(format!(
            "{name} inferno {} end tick not checked (expected {})",
            fire.entity, fire.end
        ));
        check.fail(format!(
            "{name} inferno {} round window not checked",
            fire.entity
        ));
        return;
    }
    let grenade = matched[0];
    if grenade.end_tick != fire.end {
        check.fail(format!(
            "{name} inferno {} end tick: got {}, expected {}",
            fire.entity, grenade.end_tick, fire.end
        ));
    }
    for cell in &grenade.fires {
        if cell.end_tick > fire.end {
            check.fail(format!(
                "{name} inferno {} flame cell {} extends past {}",
                fire.entity, cell.end_tick, fire.end
            ));
        }
        if cell.start_tick > cell.end_tick {
            check.fail(format!(
                "{name} inferno {} flame cell starts after it ends",
                fire.entity
            ));
        }
    }
    let Some(owner_index) = round_owning(&parsed.rounds, fire.startburn) else {
        check.fail(format!(
            "{name} inferno {} startburn {} is before every round",
            fire.entity, fire.startburn
        ));
        return;
    };
    let owner = &parsed.rounds[owner_index];
    let next_start = parsed
        .rounds
        .get(owner_index + 1)
        .map(|round| round.start_tick);
    if grenade.start_tick < owner.start_tick {
        check.fail(format!(
            "{name} inferno {} throw {} is before round {} start {}",
            fire.entity, grenade.start_tick, owner.number, owner.start_tick
        ));
    }
    if let Some(next) = next_start {
        if grenade.start_tick >= next {
            check.fail(format!(
                "{name} inferno {} throw {} belongs to the next round at {next}",
                fire.entity, grenade.start_tick
            ));
        }
        if fire.startburn >= next {
            check.fail(format!(
                "{name} inferno {} burn is already in the next round",
                fire.entity
            ));
        }
    }
    if fire.startburn <= owner.end_tick {
        check.fail(format!(
            "{name} inferno {} burn {} is not after round {} end {}",
            fire.entity, fire.startburn, owner.number, owner.end_tick
        ));
    }
    let closed = parsed
        .rounds
        .iter()
        .find(|round| fire.startburn >= round.start_tick && fire.startburn <= round.end_tick);
    if let Some(round) = closed {
        check.fail(format!(
            "{name} inferno {} would land in round {} if the window used end_tick",
            fire.entity, round.number
        ));
    }
    eprintln!(
        "open-fire {name} inferno {} round {} {} -> {} cells {}",
        fire.entity,
        owner.number,
        fire.startburn,
        grenade.end_tick,
        grenade.fires.len()
    );
}

fn check_smoke_end(
    check: &mut AssertSink,
    name: &str,
    parsed: &Match,
    bytes: &[u8],
    rollup: &mut SmokeRollup,
) {
    let (detonates, expires, round_opens) = collect_smoke_events(bytes);
    let life = (SMOKE_DURATION_SECONDS * parsed.header.tick_rate).round() as u32;
    let last_tick = parsed
        .ticks
        .ticks
        .last()
        .copied()
        .unwrap_or(parsed.header.playback_ticks);
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
        let Some(index) = claim_detonate(grenade, &detonates, &mut used) else {
            let same_tick = detonates
                .iter()
                .filter(|detonate| detonate.tick == grenade.detonate_tick)
                .count();
            let land = grenade.points.last();
            check.fail(format!(
                "{name} smoke at {} did not match a smokegrenade_detonate (same_tick={same_tick}, points={}, land={land:?})",
                grenade.detonate_tick,
                grenade.points.len()
            ));
            continue;
        };
        used[index] = true;
        let entity = detonates[index].entity;
        let next = next_smoke_detonate(&detonates, entity, grenade.detonate_tick);
        let Some(owner_index) = round_owning(&parsed.rounds, grenade.detonate_tick) else {
            check.fail(format!(
                "{name} smoke at {} is before every round",
                grenade.detonate_tick
            ));
            continue;
        };
        let owner = &parsed.rounds[owner_index];
        let bound = next_round_start(&parsed.rounds, owner).unwrap_or(last_tick);
        let horizon = bound.min(last_tick);
        if !(grenade.detonate_tick <= grenade.end_tick && grenade.end_tick <= horizon) {
            check.fail(format!(
                "{name} smoke entity {entity} {} -> {} outside detonate..={horizon} (round {} ends {})",
                grenade.detonate_tick, grenade.end_tick, owner.number, owner.end_tick
            ));
        }
        if grenade.end_tick > owner.end_tick {
            after_round_end += 1;
        }
        if let Some(expire) = expire_in_window(&expires, entity, grenade.detonate_tick, next) {
            if grenade.end_tick != expire {
                check.fail(format!(
                    "{name} smoke entity {entity} at {} paired outside its window (expire {expire}, next {next:?})",
                    grenade.detonate_tick
                ));
            }
            with_expire += 1;
        } else {
            let outside = expires
                .iter()
                .any(|event| event.entity == entity && event.tick == grenade.end_tick);
            if outside {
                check.fail(format!(
                    "{name} smoke entity {entity} at {} paired with an expire outside its window",
                    grenade.detonate_tick
                ));
            }
            let duration_cap = grenade.detonate_tick.saturating_add(life);
            if grenade.end_tick >= duration_cap {
                check.fail(format!(
                    "{name} smoke entity {entity} {} -> {} landed on the {life}-tick cap {duration_cap}",
                    grenade.detonate_tick, grenade.end_tick
                ));
            }
            let next_open = round_opens
                .iter()
                .copied()
                .find(|tick| *tick > grenade.detonate_tick);
            let at_next_open = next_open.is_some_and(|open| grenade.end_tick == open);
            let at_demo_end = grenade.end_tick == last_tick;
            if !(at_next_open || at_demo_end) {
                check.fail(format!(
                    "{name} smoke entity {entity} {} -> {} is not the next m_nRoundStartCount edge ({next_open:?}) or the last sampled tick {last_tick} (22s cap {duration_cap})",
                    grenade.detonate_tick, grenade.end_tick
                ));
            }
            if at_next_open && !at_demo_end {
                rollup.ended_at_round_open += 1;
            }
            if at_demo_end && !at_next_open {
                rollup.ended_at_demo_end.push((
                    name.to_string(),
                    grenade.detonate_tick,
                    grenade.end_tick,
                ));
            }
            without_expire += 1;
            rollup.missing_expire += 1;
        }
    }
    eprintln!(
        "smoke-end {name} smokes={smokes} with_expire={with_expire} without_expire={without_expire} after_round_end={after_round_end}"
    );
    let Some(expected) = lookup_demo(name) else {
        check.fail(format!("no smoke census for {name}"));
        return;
    };
    if smokes != expected.smokes {
        check.fail(format!(
            "{name} smokes: got {smokes}, expected {}",
            expected.smokes
        ));
    }
    if with_expire != expected.with_expire {
        check.fail(format!(
            "{name} with expire: got {with_expire}, expected {}",
            expected.with_expire
        ));
    }
    if without_expire != expected.without_expire {
        check.fail(format!(
            "{name} without expire: got {without_expire}, expected {}",
            expected.without_expire
        ));
    }
    if after_round_end != expected.after_round_end {
        check.fail(format!(
            "{name} ending after round end: got {after_round_end}, expected {}",
            expected.after_round_end
        ));
    }
}

fn check_demo_end_smoke(check: &mut AssertSink, name: &str, rollup: &SmokeRollup) {
    let got: Vec<(u32, u32)> = rollup
        .ended_at_demo_end
        .iter()
        .filter(|(demo, _, _)| demo == name)
        .map(|(_, detonate, end)| (*detonate, *end))
        .collect();
    let expected: Vec<(u32, u32)> = DEMO_END_SMOKES
        .iter()
        .filter(|row| row.demo == name)
        .map(|row| (row.detonate, row.end))
        .collect();
    if got != expected {
        check.fail(format!(
            "{name} missing-expire smokes that stop on the last sampled tick: got {got:?}, expected {expected:?}"
        ));
    }
}

fn run_global_checks(report: &mut FailureReport, rollup: &SmokeRollup) {
    report.run(ALL_DEMOS, "open-fire-inventory", |check| {
        if OPEN_FIRES.len() != 6 {
            check.fail(format!("open fires: got {}, expected 6", OPEN_FIRES.len()));
        }
        for fire in OPEN_FIRES {
            if lookup_demo(fire.demo).is_none() {
                check.fail(format!(
                    "open fire {} is keyed to {}, which is not a manifest demo name",
                    fire.entity, fire.demo
                ));
            }
        }
    });
    report.run(ALL_DEMOS, "missing-expire-total", |check| {
        if rollup.missing_expire != 69 {
            check.fail(format!(
                "smokes with no in-window expire: got {}, expected 69",
                rollup.missing_expire
            ));
        }
    });
    report.run(ALL_DEMOS, "missing-expire-round-open", |check| {
        if rollup.ended_at_round_open != 67 {
            check.fail(format!(
                "missing-expire smokes that stop on the next m_nRoundStartCount edge: got {}, expected 67",
                rollup.ended_at_round_open
            ));
        }
    });
    report.run(ALL_DEMOS, "missing-expire-demo-end", |check| {
        let mut ended = rollup.ended_at_demo_end.clone();
        ended.sort_unstable();
        let expected = vec![
            (
                "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem".to_string(),
                228_691,
                230_008,
            ),
            ("premier-d2.dem".to_string(), 81_808, 83_030),
        ];
        if ended != expected {
            check.fail(format!(
                "missing-expire smokes that stop on the last sampled tick: got {ended:?}, expected {expected:?}"
            ));
        }
    });
    enforce_check_count(report, ALL_DEMOS, GLOBAL_CHECK_COUNT);
}

/// Last round whose freeze has started at `tick`: `[start_tick, next start)`.
fn round_owning(rounds: &[Round], tick: u32) -> Option<usize> {
    rounds.iter().rposition(|round| round.start_tick <= tick)
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
    /// Last `m_nRoundStartCount`. `None` until the prop exists.
    round_start_count: Option<i32>,
    /// Ticks where `m_nRoundStartCount` changed. The first sighting is not an edge.
    round_opens: Vec<u32>,
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

    /// Same edge as the parser: a change in `m_nRoundStartCount`, not the first
    /// time the prop is visible, and not a fired `round_start` (assets-v1 does
    /// not fire that event).
    #[on_tick_end]
    fn on_tick_end(&mut self, ctx: &Context) -> ObserverResult {
        let tick = ctx.tick();
        if tick == u32::MAX {
            return Ok(());
        }
        let Ok(proxy) = ctx.entities().get_by_class_name("CCSGameRulesProxy") else {
            return Ok(());
        };
        // Same widths as `prop_i32_opt`. Signed32/Unsigned32 alone misses this prop.
        let count = match proxy.get_property("m_pGameRules.m_nRoundStartCount") {
            Ok(FieldValue::Signed32(value)) => *value,
            Ok(FieldValue::Signed16(value)) => i32::from(*value),
            Ok(FieldValue::Signed8(value)) => i32::from(*value),
            Ok(FieldValue::Unsigned32(value)) => *value as i32,
            Ok(FieldValue::Unsigned16(value)) => i32::from(*value),
            Ok(FieldValue::Unsigned8(value)) => i32::from(*value),
            _ => return Ok(()),
        };
        let previous = self.round_start_count.replace(count);
        if previous.is_some_and(|seen| seen != count)
            && self.round_opens.last().is_none_or(|seen| *seen < tick)
        {
            self.round_opens.push(tick);
        }
        Ok(())
    }
}

fn collect_smoke_events(bytes: &[u8]) -> (Vec<SmokeDetonate>, Vec<SmokeExpire>, Vec<u32>) {
    let mut parser = Parser::new(bytes)
        .unwrap_or_else(|err| panic!("could not open demo for smoke events: {err}"));
    let handle = parser.add_observer(SmokeEvents::default());
    parser
        .run_to_end()
        .unwrap_or_else(|err| panic!("could not read smoke events: {err}"));
    let events = handle.borrow();
    (
        events.detonates.clone(),
        events.expires.clone(),
        events.round_opens.clone(),
    )
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

#[test]
fn aggregator_panics_with_exactly_the_failing_line() {
    let mut report = FailureReport::default();
    report.run("premier-d2.dem", CHECK_ROUND_COUNTS, |_| {});
    report.run("premier-d2.dem", CHECK_MOLOTOV, |_| {
        panic!("flames outside the burn window");
    });
    assert_eq!(report.executed("premier-d2.dem"), 2);
    let line = "premier-d2.dem :: molotov-burn-window :: flames outside the burn window";
    assert_eq!(report.lines, vec![line.to_string()]);
    let panicked = catch_unwind(AssertUnwindSafe(|| report.finish()));
    match panicked {
        Ok(()) => panic!("the aggregator must panic when a check failed"),
        Err(payload) => assert_eq!(panic_message(payload), line),
    }
}

#[test]
fn parse_failure_is_reported_and_the_next_demo_still_runs() {
    let mut report = FailureReport::default();
    let panicked: Option<()> = visit_demo(
        &mut report,
        "a.dem",
        || -> Result<(), String> { panic!("parser exploded") },
        |_, _| {},
        1,
    );
    assert!(panicked.is_none());
    let errored: Option<()> = visit_demo(
        &mut report,
        "c.dem",
        || Err("bad header".to_string()),
        |_, _| {},
        2,
    );
    assert!(errored.is_none());
    let mut ran = false;
    let ok = visit_demo(
        &mut report,
        "b.dem",
        || Ok(()),
        |report, _| {
            ran = true;
            report.run("b.dem", CHECK_ROUND_COUNTS, |_| {});
        },
        1,
    );
    assert!(ok.is_some());
    assert!(ran);
    assert_eq!(
        report.lines,
        vec![
            "a.dem :: parse :: parser exploded".to_string(),
            "a.dem :: check-count :: executed 0, expected 1".to_string(),
            "c.dem :: parse :: bad header".to_string(),
            "c.dem :: check-count :: executed 0, expected 2".to_string(),
        ]
    );
}

#[test]
fn missing_demo_fails_every_named_check() {
    let mut report = FailureReport::default();
    let demo = "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem";
    record_missing_demo(&mut report, demo);
    let names = demo_check_names(demo);
    assert!(
        names.iter().any(|name| name == "open-fire-783"),
        "molotov 783 must be a named check on its manifest demo"
    );
    assert!(
        names.iter().any(|name| name == CHECK_DEMO_END),
        "demo-end smoke 230008 must be a named check"
    );
    assert_eq!(report.lines.len(), names.len());
    for (line, check_name) in report.lines.iter().zip(names.iter()) {
        assert_eq!(line, &format!("{demo} :: {check_name} :: {MISSING_DEMO}"));
    }
    assert_eq!(report.executed(demo), expected_check_count(demo));
    assert!(
        !report.lines.iter().any(|line| line.contains(CHECK_COUNT)),
        "a missing demo still runs each named check"
    );
}

#[test]
fn each_demo_has_an_expected_check_count() {
    let cases = [
        ("1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem", 5),
        ("1-898c8041-ac25-4ab8-8a2b-c384318aac1c-1-1.dem", 5),
        ("1-b3ea81e1-103d-4877-83d1-e5bbf1bcb7eb-1-1.dem", 4),
        ("legacy-vs-spirit-m2-ancient.dem", 4),
        ("premier-d2.dem", 4),
        ("spirit-vs-dendele-m1-ancient.dem", 4),
        ("spirit-vs-furia-m1-ancient.dem", 6),
        ("spirit-vs-mouz-m3-ancient.dem", 5),
        ("spirit-vs-mouz-m4-nuke.dem", 5),
    ];
    assert_eq!(cases.len(), DEMO_EXPECTATIONS.len());
    for (name, expected) in cases {
        assert_eq!(expected_check_count(name), expected, "{name}");
        assert_eq!(demo_check_names(name).len(), expected, "{name}");
        assert!(
            DEMO_EXPECTATIONS.iter().any(|row| row.name == name),
            "{name}"
        );
    }
    assert_eq!(OPEN_FIRES.len(), 6);
    assert_eq!(DEMO_END_SMOKES.len(), 2);
    assert_eq!(GLOBAL_CHECK_COUNT, 4);
    let without_expire: usize = DEMO_EXPECTATIONS.iter().map(|row| row.without_expire).sum();
    assert_eq!(without_expire, 69);
    let faceit = DEMO_END_SMOKES
        .iter()
        .find(|row| row.demo == "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem");
    let faceit = faceit.unwrap_or_else(|| panic!("0eb2df7f demo-end smoke missing from the table"));
    assert_eq!(faceit.end, 230_008);
    assert_eq!(faceit.detonate, 228_691);
    let premier = DEMO_END_SMOKES
        .iter()
        .find(|row| row.demo == "premier-d2.dem");
    let premier =
        premier.unwrap_or_else(|| panic!("premier-d2 demo-end smoke missing from the table"));
    assert_eq!(premier.end, 83_030);
    assert_eq!(premier.detonate, 81_808);
    for fire in OPEN_FIRES {
        assert!(
            lookup_demo(fire.demo).is_some(),
            "open fire {} demo {} is not a manifest name",
            fire.entity,
            fire.demo
        );
    }
}
