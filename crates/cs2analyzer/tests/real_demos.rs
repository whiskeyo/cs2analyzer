//! Parse every downloaded assets-v1 demo once.
//!
//! `cargo test` skips the demo walk. `cargo test -- --ignored` runs it after
//! `./scripts/run.sh --fetch-demos`.
//!
//! Each demo is parsed once. Every check for that demo runs on that `Match`,
//! then the `Match` is dropped before the next file so the peak is one demo.
//! Smoke checks read `smokegrenade_*` events and `m_nRoundStartCount` edges
//! from a test-only observer on that same parse. The `Match` does not store
//! those events, and the observer does not feed the pairing logic. The output
//! hash, its RSS sample, and `UPDATE_HASHES` use that same `Match`.
//! A missing or unparsable hash file is `<demo> :: hashes :: ...` for that
//! demo; the walk does not panic inside the loop. `HASH_DEMOS` narrows only
//! that check, and is rejected when `CI` is set.
//!
//! A failed check is a line `<demo> :: <check> :: <message>`. The walk keeps
//! going and panics at the end with every line.

#[path = "common/mod.rs"]
mod common;

#[path = "support/output_hash.rs"]
mod output_hash;

use std::collections::{BTreeMap, BTreeSet};
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::path::Path;
use std::time::Instant;

use cs2analyzer::{
    full_parse_passes, parse_demo_with_test_observer, reset_full_parse_passes, BombKind,
    GrenadeKind, GrenadeThrow, Match, ParseOptions, Round, SMOKE_DURATION_SECONDS,
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

const CHECK_RSS: &str = "rss";
const CHECK_ROUND_COUNTS: &str = "round-counts";
const CHECK_MOLOTOV: &str = "molotov-burn-window";
const CHECK_SMOKE: &str = "smoke-end";
const CHECK_DEMO_END: &str = "demo-end-smoke";
const CHECK_HASHES: &str = "hashes";
const CHECK_PARSE_PASSES: &str = "parse-passes";
const CHECK_PARSE: &str = "parse";
const CHECK_READ: &str = "read";
const CHECK_COUNT: &str = "check-count";
/// Cross-demo rollups. Not a file name.
const ALL_DEMOS: &str = "all";
const GLOBAL_CHECK_COUNT: usize = 6;
const MISSING_DEMO: &str = "demo was not in this run";
/// Smokes that hit the +22s cap. Assets-v1 has none.
const EXPECTED_DURATION_CAP: usize = 0;
/// `5` written to `/proc/self/clear_refs` resets `VmHWM` to current `VmRSS`.
const CLEAR_REFS_RESET_PEAK: &str = "5";

/// Round counts from #111 and the smoke census measured on assets-v1.
struct DemoExpect {
    name: &'static str,
    /// Short label for the per-check log. The failure line still uses `name`.
    label: &'static str,
    /// Played rounds, excluding `is_knife`.
    played: usize,
    knife: usize,
    smokes: usize,
    with_expire: usize,
    /// No in-window `smokegrenade_expired`.
    without_expire: usize,
    /// Of `without_expire`, those that end on the next `m_nRoundStartCount` edge.
    ended_at_round_open: usize,
    /// Of `without_expire`, those that end on the last sampled tick.
    ended_at_demo_end: usize,
    after_round_end: usize,
    /// Ceiling for `VmHWM` after `clear_refs`, in KiB. Linux only.
    rss_limit_kib: u64,
}

/// FACEIT keeps the knife round (`is_knife`, number 0). HLTV and Premier have none.
const DEMO_EXPECTATIONS: &[DemoExpect] = &[
    DemoExpect {
        name: "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem",
        label: "0eb2df7f",
        played: 35,
        knife: 1,
        smokes: 160,
        with_expire: 146,
        without_expire: 14,
        ended_at_round_open: 13,
        ended_at_demo_end: 1,
        after_round_end: 25,
        rss_limit_kib: 800_000,
    },
    DemoExpect {
        name: "1-898c8041-ac25-4ab8-8a2b-c384318aac1c-1-1.dem",
        label: "898c8041",
        played: 16,
        knife: 1,
        smokes: 52,
        with_expire: 44,
        without_expire: 8,
        ended_at_round_open: 8,
        ended_at_demo_end: 0,
        after_round_end: 10,
        rss_limit_kib: 800_000,
    },
    DemoExpect {
        name: "1-b3ea81e1-103d-4877-83d1-e5bbf1bcb7eb-1-1.dem",
        label: "b3ea81e1",
        played: 29,
        knife: 1,
        smokes: 124,
        with_expire: 116,
        without_expire: 8,
        ended_at_round_open: 8,
        ended_at_demo_end: 0,
        after_round_end: 20,
        rss_limit_kib: 650_000,
    },
    DemoExpect {
        name: "legacy-vs-spirit-m2-ancient.dem",
        label: "legacy-m2",
        played: 22,
        knife: 0,
        smokes: 149,
        with_expire: 145,
        without_expire: 4,
        ended_at_round_open: 4,
        ended_at_demo_end: 0,
        after_round_end: 8,
        rss_limit_kib: 1_200_000,
    },
    DemoExpect {
        name: "premier-d2.dem",
        label: "premier-d2",
        played: 15,
        knife: 0,
        smokes: 45,
        with_expire: 38,
        without_expire: 7,
        ended_at_round_open: 6,
        ended_at_demo_end: 1,
        after_round_end: 13,
        rss_limit_kib: 850_000,
    },
    DemoExpect {
        name: "spirit-vs-dendele-m1-ancient.dem",
        label: "dendele-m1",
        played: 21,
        knife: 0,
        smokes: 139,
        with_expire: 133,
        without_expire: 6,
        ended_at_round_open: 6,
        ended_at_demo_end: 0,
        after_round_end: 8,
        rss_limit_kib: 700_000,
    },
    DemoExpect {
        name: "spirit-vs-furia-m1-ancient.dem",
        label: "furia-m1",
        played: 23,
        knife: 0,
        smokes: 160,
        with_expire: 152,
        without_expire: 8,
        ended_at_round_open: 8,
        ended_at_demo_end: 0,
        after_round_end: 20,
        rss_limit_kib: 700_000,
    },
    DemoExpect {
        name: "spirit-vs-mouz-m3-ancient.dem",
        label: "mouz-m3",
        played: 22,
        knife: 0,
        smokes: 149,
        with_expire: 143,
        without_expire: 6,
        ended_at_round_open: 6,
        ended_at_demo_end: 0,
        after_round_end: 11,
        rss_limit_kib: 700_000,
    },
    DemoExpect {
        name: "spirit-vs-mouz-m4-nuke.dem",
        label: "mouz-m4",
        played: 23,
        knife: 0,
        smokes: 176,
        with_expire: 168,
        without_expire: 8,
        ended_at_round_open: 8,
        ended_at_demo_end: 0,
        after_round_end: 15,
        rss_limit_kib: 1_250_000,
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

/// Applicable checks for one demo. `rss` is included only on Linux, from
/// `target_os`, not from whether `/proc` could be read. Open fires come from
/// [`OPEN_FIRES`] keyed by the manifest name.
fn expected_check_count(name: &str) -> usize {
    let fires = OPEN_FIRES.iter().filter(|fire| fire.demo == name).count();
    let rss = usize::from(cfg!(target_os = "linux"));
    // round-counts, molotov-burn-window, smoke-end, demo-end-smoke, hashes
    5 + fires + rss
}

fn open_fire_check_name(entity: i32) -> String {
    format!("open-fire-{entity}")
}

fn demo_check_catalog() -> Vec<String> {
    let mut names = vec![
        CHECK_RSS.to_string(),
        CHECK_ROUND_COUNTS.to_string(),
        CHECK_MOLOTOV.to_string(),
    ];
    for fire in OPEN_FIRES {
        names.push(open_fire_check_name(fire.entity));
    }
    names.push(CHECK_SMOKE.to_string());
    names.push(CHECK_DEMO_END.to_string());
    names.push(CHECK_HASHES.to_string());
    names
}

/// Static row: which catalog checks apply to this manifest name.
fn check_applies(demo: &str, check: &str) -> bool {
    if check == CHECK_RSS {
        return cfg!(target_os = "linux");
    }
    if let Some(fire) = OPEN_FIRES
        .iter()
        .find(|fire| open_fire_check_name(fire.entity) == check)
    {
        return fire.demo == demo;
    }
    matches!(
        check,
        CHECK_ROUND_COUNTS | CHECK_MOLOTOV | CHECK_SMOKE | CHECK_DEMO_END | CHECK_HASHES
    )
}

/// `HASH_DEMOS` may drop the hash check for a demo. Every other check stays.
fn check_applies_for_run(demo: &str, check: &str, hash_selected: bool) -> bool {
    if check == CHECK_HASHES && !hash_selected {
        return false;
    }
    check_applies(demo, check)
}

/// `None` hashes every demo. `CI` plus `HASH_DEMOS` is rejected so a CI run
/// cannot drop the hash check. Blank and unknown names are also rejected.
/// This does not filter [`common::require_demo_files`].
fn resolve_hash_demos(
    ci: bool,
    raw: Option<&str>,
    manifest: &[String],
) -> Result<Option<Vec<String>>, String> {
    let Some(raw) = raw else {
        return Ok(None);
    };
    if ci {
        return Err(
            "HASH_DEMOS is set but CI is set; the hash check must cover every demo".to_string(),
        );
    }
    let names: Vec<String> = raw
        .split(',')
        .map(str::trim)
        .filter(|name| !name.is_empty())
        .map(str::to_string)
        .collect();
    if names.is_empty() {
        return Err("HASH_DEMOS is set but names no demos".to_string());
    }
    let unknown: Vec<&str> = names
        .iter()
        .filter(|name| !manifest.iter().any(|demo| demo == *name))
        .map(String::as_str)
        .collect();
    if !unknown.is_empty() {
        return Err(format!(
            "HASH_DEMOS not in test-demos/manifest.json: {}",
            unknown.join(", ")
        ));
    }
    Ok(Some(names))
}

fn hash_check_selected(name: &str, selected: Option<&[String]>) -> bool {
    match selected {
        None => true,
        Some(names) => names.iter().any(|demo| demo == name),
    }
}

fn demo_check_names(demo: &str) -> Vec<String> {
    demo_check_catalog()
        .into_iter()
        .filter(|check| check_applies(demo, check))
        .collect()
}

fn demo_label(name: &str) -> &str {
    DEMO_EXPECTATIONS
        .iter()
        .find(|row| row.name == name)
        .map(|row| row.label)
        .unwrap_or(name)
}

fn lookup_demo(name: &str) -> Option<&'static DemoExpect> {
    DEMO_EXPECTATIONS.iter().find(|row| row.name == name)
}

struct AssertSink {
    failures: Vec<String>,
    detail: String,
}

impl AssertSink {
    fn fail(&mut self, message: impl Into<String>) {
        self.failures.push(message.into());
    }

    fn set_detail(&mut self, detail: impl Into<String>) {
        self.detail = detail.into();
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum CheckStatus {
    Pass,
    Fail,
    Skip,
}

impl CheckStatus {
    fn as_str(self) -> &'static str {
        match self {
            Self::Pass => "PASS",
            Self::Fail => "FAIL",
            Self::Skip => "SKIP",
        }
    }
}

struct CheckLog {
    demo: String,
    check: String,
    status: CheckStatus,
    detail: String,
    duration_ms: Option<u128>,
}

#[derive(Default)]
struct FailureReport {
    lines: Vec<String>,
    executed: BTreeMap<String, usize>,
    logs: Vec<CheckLog>,
}

impl FailureReport {
    fn executed(&self, demo: &str) -> usize {
        self.executed.get(demo).copied().unwrap_or(0)
    }

    /// Counts the check as executed, then records every assert that fails.
    /// A panic inside the check is one more line. Later checks still run.
    fn run(&mut self, demo: &str, check: &str, body: impl FnOnce(&mut AssertSink)) {
        let started = Instant::now();
        *self.executed.entry(demo.to_string()).or_default() += 1;
        let mut sink = AssertSink {
            failures: Vec::new(),
            detail: String::new(),
        };
        let panicked = catch_unwind(AssertUnwindSafe(|| body(&mut sink)));
        let mut failed = false;
        let mut notes = Vec::new();
        if !sink.detail.is_empty() {
            notes.push(sink.detail);
        }
        for message in sink.failures {
            self.lines.push(failure_line(demo, check, &message));
            notes.push(message);
            failed = true;
        }
        if let Err(payload) = panicked {
            let message = panic_message(payload);
            self.lines.push(failure_line(demo, check, &message));
            notes.push(message);
            failed = true;
        }
        let status = if failed {
            CheckStatus::Fail
        } else {
            CheckStatus::Pass
        };
        let detail = if notes.is_empty() {
            "ok".to_string()
        } else if status == CheckStatus::Pass {
            notes[0].clone()
        } else {
            notes.join("; ")
        };
        self.logs.push(CheckLog {
            demo: demo.to_string(),
            check: check.to_string(),
            status,
            detail,
            duration_ms: Some(started.elapsed().as_millis()),
        });
    }

    fn skip(&mut self, demo: &str, check: &str, reason: &str) {
        self.logs.push(CheckLog {
            demo: demo.to_string(),
            check: check.to_string(),
            status: CheckStatus::Skip,
            detail: reason.to_string(),
            duration_ms: None,
        });
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
    expected_checks: Option<usize>,
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
    if let Some(expected) = expected_checks {
        enforce_check_count(report, demo, expected);
    }
    value
}

fn record_missing_demo(report: &mut FailureReport, demo: &str, hash_selected: bool) {
    for check_name in demo_check_catalog() {
        if !check_applies_for_run(demo, &check_name, hash_selected) {
            continue;
        }
        report.run(demo, &check_name, |check| {
            check.set_detail(MISSING_DEMO.to_string());
            check.fail(MISSING_DEMO);
        });
    }
    close_demo(report, demo, None, None, hash_selected);
}

struct ParsedDemo {
    parsed: Match,
    smoke: SmokeEvents,
    parse_ms: u128,
}

#[derive(Default)]
struct SmokeRollup {
    missing_expire: usize,
    ended_at_round_open: usize,
    ended_at_demo_end: Vec<(String, u32, u32)>,
}

enum HashLoad {
    /// `UPDATE_HASHES=1`: record hashes, do not read the file.
    Updating,
    /// Combined `output-hashes.json`, or the error from reading it.
    /// A per-demo file uses [`output_hash::read_demo_hash_file`] inside the check.
    Combined(Result<output_hash::OutputHashes, String>),
    /// One `test-demos/output-hashes/<demo>.json` per demo.
    PerDemo(std::path::PathBuf),
}

struct OutputHashCheck<'a> {
    recorded: &'a mut Vec<output_hash::DemoHash>,
    load: &'a HashLoad,
    /// False when `HASH_DEMOS` names other demos. Other checks still run.
    selected: bool,
    rss_kib: Option<u64>,
}

fn stored_hash(load: &HashLoad, name: &str) -> Result<Option<output_hash::DemoHash>, String> {
    match load {
        HashLoad::Updating => Ok(None),
        HashLoad::Combined(Err(message)) => Err(message.clone()),
        HashLoad::Combined(Ok(all)) => all
            .demos
            .iter()
            .find(|demo| demo.name == name)
            .cloned()
            .map(Some)
            .ok_or_else(|| {
                format!(
                    "missing hash for {name} in {}",
                    output_hash::hashes_path().display()
                )
            }),
        HashLoad::PerDemo(dir) => {
            output_hash::read_demo_hash_file(&dir.join(format!("{name}.json"))).map(Some)
        }
    }
}

/// One ignored test. Each file is read, parsed, checked, and dropped before
/// the next so a failure in one check cannot hide the rest.
#[test]
#[ignore = "needs ./scripts/run.sh --fetch-demos"]
fn parses_each_release_demo_once() {
    let demos = common::require_demo_files();
    let manifest: Vec<String> = demos
        .iter()
        .map(|path| output_hash::demo_name(path))
        .collect();
    let hash_demos = resolve_hash_demos(
        std::env::var_os("CI").is_some(),
        std::env::var("HASH_DEMOS").ok().as_deref(),
        &manifest,
    )
    .unwrap_or_else(|err| panic!("{err}"));
    let update_hashes = std::env::var("UPDATE_HASHES").ok().as_deref() == Some("1");
    let hash_load = if update_hashes {
        HashLoad::Updating
    } else {
        HashLoad::Combined(output_hash::read_hashes(&output_hash::hashes_path()))
    };
    let mut recorded = Vec::new();
    let mut reads = 0usize;
    reset_full_parse_passes();
    let mut report = FailureReport::default();
    let mut rollup = SmokeRollup::default();
    let mut seen = BTreeSet::new();
    for path in demos {
        let name = output_hash::demo_name(&path);
        seen.insert(name.clone());
        let bytes = match std::fs::read(&path) {
            Ok(bytes) => bytes,
            Err(err) => {
                report.fail(&name, CHECK_READ, format!("could not read {name}: {err}"));
                close_demo(
                    &mut report,
                    &name,
                    None,
                    None,
                    hash_check_selected(&name, hash_demos.as_deref()),
                );
                continue;
            }
        };
        // Drop the previous demo before this reset. `VmHWM` only grows, so the
        // peak has to be cleared or this file inherits the last one.
        let reset = if cfg!(target_os = "linux") {
            Some(reset_peak_rss())
        } else {
            None
        };
        reads += 1;
        let hash_selected = hash_check_selected(&name, hash_demos.as_deref());
        let mut header_ms = None;
        let mut header_rss = None;
        let held = visit_demo(
            &mut report,
            &name,
            || {
                let started = Instant::now();
                let result = parse_demo_with_test_observer(
                    &bytes,
                    ParseOptions::default(),
                    SmokeEvents::default(),
                )
                .map_err(|err| err.to_string());
                let parse_ms = started.elapsed().as_millis();
                result.map(|(parsed, smoke)| ParsedDemo {
                    parsed,
                    smoke,
                    parse_ms,
                })
            },
            |report, timed| {
                header_ms = Some(timed.parse_ms);
                let sample = match &reset {
                    None => None,
                    Some(Err(message)) => Some(Err(message.clone())),
                    Some(Ok(())) => Some(read_vm_hwm_kib()),
                };
                if let Some(Ok(kib)) = sample {
                    header_rss = Some(kib);
                }
                let mut hash_check = OutputHashCheck {
                    recorded: &mut recorded,
                    load: &hash_load,
                    selected: hash_selected,
                    rss_kib: header_rss,
                };
                run_demo_checks(
                    report,
                    &name,
                    &timed.parsed,
                    &timed.smoke,
                    timed.parse_ms,
                    &mut rollup,
                    &mut hash_check,
                    sample,
                );
            },
            None,
        );
        drop(held);
        drop(bytes);
        close_demo(&mut report, &name, header_ms, header_rss, hash_selected);
    }
    for row in DEMO_EXPECTATIONS {
        if !seen.contains(row.name) {
            record_missing_demo(
                &mut report,
                row.name,
                hash_check_selected(row.name, hash_demos.as_deref()),
            );
        }
    }
    run_global_checks(&mut report, &rollup, &hash_load, &recorded, &seen, reads);
    if update_hashes && report.lines.is_empty() {
        let path = output_hash::hashes_path();
        output_hash::write_hashes(&path, &output_hash::OutputHashes { demos: recorded });
        eprintln!("updated {}", path.display());
    }
    print_summary(&report, full_parse_passes(), reads);
    report.finish();
}

/// New per-demo checks go in this function, in [`demo_check_names`], and as a
/// literal arm of [`expected_check_count`].
#[allow(clippy::too_many_arguments)]
fn run_demo_checks(
    report: &mut FailureReport,
    name: &str,
    parsed: &Match,
    smoke: &SmokeEvents,
    parse_ms: u128,
    rollup: &mut SmokeRollup,
    hashes: &mut OutputHashCheck<'_>,
    rss_sample: Option<Result<u64, String>>,
) {
    if check_applies(name, CHECK_RSS) {
        report.run(name, CHECK_RSS, |check| {
            check_rss(check, name, rss_sample.clone(), rss_limit_kib(name));
        });
    }
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
        check_smoke_end(check, name, parsed, smoke, rollup);
    });
    report.run(name, CHECK_DEMO_END, |check| {
        check_demo_end_smoke(check, name, rollup);
    });
    if hashes.selected {
        report.run(name, CHECK_HASHES, |check| {
            check_output_hash(check, name, parsed, hashes);
        });
    }
}

fn check_output_hash(
    check: &mut AssertSink,
    name: &str,
    parsed: &Match,
    hashes: &mut OutputHashCheck<'_>,
) {
    let row = output_hash::log_parsed_demo(name, parsed, hashes.rss_kib);
    let stored = stored_hash(hashes.load, name);
    match stored {
        Err(message) => check.fail(message),
        Ok(None) => check.set_detail(format!("sha256={} (will write)", row.sha256)),
        Ok(Some(expected)) => {
            check.set_detail(format!("sha256={} (expected match)", row.sha256));
            let actual = output_hash::OutputHashes {
                demos: vec![row.clone()],
            };
            let only = output_hash::OutputHashes {
                demos: vec![expected],
            };
            let report = output_hash::diff_report(&only, &actual);
            if !report.is_empty() {
                check.fail(report);
            }
        }
    }
    hashes.recorded.push(row);
}

fn check_round_counts(check: &mut AssertSink, name: &str, parsed: &Match, parse_ms: u128) {
    let played = parsed.rounds.iter().filter(|round| !round.is_knife).count();
    let knife = parsed.rounds.iter().filter(|round| round.is_knife).count();
    let begin_defuse = parsed
        .bomb_events
        .iter()
        .filter(|event| event.kind == BombKind::BeginDefuse)
        .count();
    let _ = parse_ms;
    if let Some(expected) = lookup_demo(name) {
        check.set_detail(format!(
            "played={played} knife={knife} bomb_begindefuse={begin_defuse} (expected {}/{})",
            expected.played, expected.knife
        ));
    }
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
    check.set_detail(format!("out_of_window={outside} (expected 0)"));
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
    check.set_detail(format!(
        "startburn={} end={} cells={} (expected {}/{})",
        fire.startburn,
        grenade.end_tick,
        grenade.fires.len(),
        fire.startburn,
        fire.end
    ));
}

fn check_smoke_end(
    check: &mut AssertSink,
    name: &str,
    parsed: &Match,
    events: &SmokeEvents,
    rollup: &mut SmokeRollup,
) {
    let detonates = &events.detonates;
    let expires = &events.expires;
    let round_opens = &events.round_opens;
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
    let mut ended_at_round_open = 0usize;
    let mut ended_at_demo_end = 0usize;
    let mut duration_cap_hits = 0usize;
    for grenade in parsed
        .grenades
        .iter()
        .filter(|grenade| grenade.kind == GrenadeKind::Smoke)
    {
        smokes += 1;
        let Some(index) = claim_detonate(grenade, detonates, &mut used) else {
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
        let next = next_smoke_detonate(detonates, entity, grenade.detonate_tick);
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
        if let Some(expire) = expire_in_window(expires, entity, grenade.detonate_tick, next) {
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
                duration_cap_hits += 1;
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
                ended_at_round_open += 1;
                rollup.ended_at_round_open += 1;
            }
            if at_demo_end && !at_next_open {
                ended_at_demo_end += 1;
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
    if ended_at_round_open != expected.ended_at_round_open {
        check.fail(format!(
            "{name} missing-expire smokes that stop on the next round-open edge: got {ended_at_round_open}, expected {}",
            expected.ended_at_round_open
        ));
    }
    if ended_at_demo_end != expected.ended_at_demo_end {
        check.fail(format!(
            "{name} missing-expire smokes that stop on the last sampled tick: got {ended_at_demo_end}, expected {}",
            expected.ended_at_demo_end
        ));
    }
    if duration_cap_hits != EXPECTED_DURATION_CAP {
        check.fail(format!(
            "{name} smokes that landed on the 22s cap: got {duration_cap_hits}, expected {EXPECTED_DURATION_CAP}"
        ));
    }
    if ended_at_round_open + ended_at_demo_end != without_expire {
        check.fail(format!(
            "{name} missing-expire split {ended_at_round_open}+{ended_at_demo_end} != without_expire {without_expire}"
        ));
    }
    check.set_detail(format!(
        "smokes={smokes} with_expire={with_expire} without_expire={without_expire} ended_at_round_open={ended_at_round_open} ended_at_demo_end={ended_at_demo_end} duration_cap={duration_cap_hits} (expected {}/{}/{}/{}/{}/{})",
        expected.smokes,
        expected.with_expire,
        expected.without_expire,
        expected.ended_at_round_open,
        expected.ended_at_demo_end,
        EXPECTED_DURATION_CAP
    ));
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
    check.set_detail(format!("got {got:?} (expected {expected:?})"));
    if got != expected {
        check.fail(format!(
            "{name} missing-expire smokes that stop on the last sampled tick: got {got:?}, expected {expected:?}"
        ));
    }
}

fn run_global_checks(
    report: &mut FailureReport,
    rollup: &SmokeRollup,
    hash_load: &HashLoad,
    recorded: &[output_hash::DemoHash],
    seen: &BTreeSet<String>,
    reads: usize,
) {
    report.run(ALL_DEMOS, "open-fire-inventory", |check| {
        check.set_detail(format!("open_fires={} (expected 6)", OPEN_FIRES.len()));
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
        check.set_detail(format!(
            "without_expire={} (expected 69)",
            rollup.missing_expire
        ));
        if rollup.missing_expire != 69 {
            check.fail(format!(
                "smokes with no in-window expire: got {}, expected 69",
                rollup.missing_expire
            ));
        }
    });
    report.run(ALL_DEMOS, "missing-expire-round-open", |check| {
        check.set_detail(format!(
            "ended_at_round_open={} (expected 67)",
            rollup.ended_at_round_open
        ));
        if rollup.ended_at_round_open != 67 {
            check.fail(format!(
                "missing-expire smokes that stop on the next m_nRoundStartCount edge: got {}, expected 67",
                rollup.ended_at_round_open
            ));
        }
    });
    report.run(ALL_DEMOS, "missing-expire-demo-end", |check| {
        check.set_detail(format!(
            "ended_at_demo_end={} (expected 2)",
            rollup.ended_at_demo_end.len()
        ));
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
    report.run(ALL_DEMOS, "output-hash-roster", |check| match hash_load {
        HashLoad::Combined(Ok(expected)) => {
            for demo in &expected.demos {
                if !recorded.iter().any(|row| row.name == demo.name) {
                    check.fail(format!(
                        "{}: in output-hashes.json but not parsed",
                        demo.name
                    ));
                }
            }
            check.set_detail(format!(
                "recorded={} expected={}",
                recorded.len(),
                expected.demos.len()
            ));
        }
        HashLoad::Updating => {
            for name in seen {
                if !recorded.iter().any(|row| row.name == *name) {
                    check.fail(format!(
                        "{name}: not hashed, so UPDATE_HASHES will not write"
                    ));
                }
            }
            check.set_detail(format!("recorded={}", recorded.len()));
        }
        HashLoad::Combined(Err(message)) => {
            check.set_detail(format!("hash file unreadable: {message}"));
        }
        HashLoad::PerDemo(dir) => {
            check.set_detail(format!("per-demo hash files in {}", dir.display()));
        }
    });
    report.run(ALL_DEMOS, CHECK_PARSE_PASSES, |check| {
        let passes = full_parse_passes();
        let per_demo = if reads == 0 {
            0.0
        } else {
            passes as f64 / reads as f64
        };
        check.set_detail(format!(
            "full_parse_passes={passes} demos={reads} ({per_demo:.1} per demo)"
        ));
        if passes != reads as u64 {
            check.fail(format!(
                "full parse passes {passes}, demos read {reads} (expected 1.0 per demo)"
            ));
        }
    });
    enforce_check_count(report, ALL_DEMOS, GLOBAL_CHECK_COUNT);
    print_global_log(report);
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

#[derive(Clone, Default)]
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
        Some(1),
    );
    assert!(panicked.is_none());
    let errored: Option<()> = visit_demo(
        &mut report,
        "c.dem",
        || Err("bad header".to_string()),
        |_, _| {},
        Some(2),
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
        Some(1),
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
    record_missing_demo(&mut report, demo, true);
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
        ("1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem", 6),
        ("1-898c8041-ac25-4ab8-8a2b-c384318aac1c-1-1.dem", 6),
        ("1-b3ea81e1-103d-4877-83d1-e5bbf1bcb7eb-1-1.dem", 5),
        ("legacy-vs-spirit-m2-ancient.dem", 5),
        ("premier-d2.dem", 5),
        ("spirit-vs-dendele-m1-ancient.dem", 5),
        ("spirit-vs-furia-m1-ancient.dem", 7),
        ("spirit-vs-mouz-m3-ancient.dem", 6),
        ("spirit-vs-mouz-m4-nuke.dem", 6),
    ];
    assert_eq!(cases.len(), DEMO_EXPECTATIONS.len());
    let rss = usize::from(cfg!(target_os = "linux"));
    for (name, expected) in cases {
        assert_eq!(expected_check_count(name), expected + rss, "{name}");
        assert_eq!(demo_check_names(name).len(), expected + rss, "{name}");
        assert!(
            DEMO_EXPECTATIONS.iter().any(|row| row.name == name),
            "{name}"
        );
    }
    assert_eq!(OPEN_FIRES.len(), 6);
    assert_eq!(DEMO_END_SMOKES.len(), 2);
    assert_eq!(GLOBAL_CHECK_COUNT, 6);
    let without_expire: usize = DEMO_EXPECTATIONS.iter().map(|row| row.without_expire).sum();
    assert_eq!(without_expire, 69);
    let round_open: usize = DEMO_EXPECTATIONS
        .iter()
        .map(|row| row.ended_at_round_open)
        .sum();
    let demo_end: usize = DEMO_EXPECTATIONS
        .iter()
        .map(|row| row.ended_at_demo_end)
        .sum();
    assert_eq!(round_open, 67);
    assert_eq!(demo_end, 2);
    for row in DEMO_EXPECTATIONS {
        assert_eq!(
            row.ended_at_round_open + row.ended_at_demo_end,
            row.without_expire,
            "{}",
            row.label
        );
    }
    if cfg!(target_os = "linux") {
        assert_eq!(
            expected_check_count("premier-d2.dem"),
            6,
            "premier-d2 has no open fire; rss applies on linux"
        );
        assert_eq!(
            expected_check_count("spirit-vs-furia-m1-ancient.dem"),
            8,
            "furia has two open fires"
        );
        assert_eq!(
            expected_check_count("1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem"),
            7
        );
    }
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

#[derive(Debug, PartialEq, Eq)]
enum RssDisposition {
    Skip,
    Pass { kib: u64 },
    Fail { message: String },
}

/// Linux always measures. Other targets skip from `target_os` alone: a failed
/// read must not turn the check into a skip, and a successful read must not
/// turn a non-Linux run into a measurement.
fn classify_rss(linux: bool, sample: Result<u64, String>, limit_kib: u64) -> RssDisposition {
    if !linux {
        return RssDisposition::Skip;
    }
    match sample {
        Err(message) => RssDisposition::Fail { message },
        Ok(kib) if kib > limit_kib => RssDisposition::Fail {
            message: format!("VmHWM {kib} KiB exceeds limit {limit_kib} KiB"),
        },
        Ok(kib) => RssDisposition::Pass { kib },
    }
}

fn reset_peak_rss() -> Result<(), String> {
    std::fs::write("/proc/self/clear_refs", CLEAR_REFS_RESET_PEAK)
        .map_err(|err| format!("could not reset VmHWM via /proc/self/clear_refs: {err}"))
}

fn read_vm_hwm_kib() -> Result<u64, String> {
    let text = std::fs::read_to_string("/proc/self/status")
        .map_err(|err| format!("could not read /proc/self/status: {err}"))?;
    for line in text.lines() {
        let Some(rest) = line.strip_prefix("VmHWM:") else {
            continue;
        };
        let Some(kib) = rest.split_whitespace().next() else {
            return Err("VmHWM line has no value".to_string());
        };
        return kib
            .parse()
            .map_err(|err| format!("could not parse VmHWM {kib}: {err}"));
    }
    Err("VmHWM missing from /proc/self/status".to_string())
}

fn rss_limit_kib(name: &str) -> u64 {
    lookup_demo(name).map(|row| row.rss_limit_kib).unwrap_or(0)
}

fn check_rss(
    check: &mut AssertSink,
    name: &str,
    sample: Option<Result<u64, String>>,
    limit_kib: u64,
) {
    let Some(sample) = sample else {
        check.fail(format!("{name} rss sample missing on linux"));
        return;
    };
    match classify_rss(true, sample, limit_kib) {
        RssDisposition::Pass { kib } => {
            check.set_detail(format!("VmHWM={kib} KiB (limit {limit_kib} KiB)"));
        }
        RssDisposition::Fail { message } => check.fail(message),
        RssDisposition::Skip => check.fail(format!("{name} rss skip is not valid on linux")),
    }
}

struct Tally {
    pass: usize,
    fail: usize,
    skip: usize,
}

fn tally(report: &FailureReport, demo: &str) -> Tally {
    let mut tally = Tally {
        pass: 0,
        fail: 0,
        skip: 0,
    };
    for row in report.logs.iter().filter(|row| row.demo == demo) {
        match row.status {
            CheckStatus::Pass => tally.pass += 1,
            CheckStatus::Fail => tally.fail += 1,
            CheckStatus::Skip => tally.skip += 1,
        }
    }
    tally
}

fn duration_suffix(duration_ms: Option<u128>) -> String {
    match duration_ms {
        Some(ms) if ms >= 1 => format!(" ({ms}ms)"),
        _ => String::new(),
    }
}

/// Fill SKIP from the static table, FAIL any applicable check that never ran,
/// then assert PASS+FAIL and SKIP against that table.
fn close_demo(
    report: &mut FailureReport,
    demo: &str,
    parse_ms: Option<u128>,
    rss_kib: Option<u64>,
    hash_selected: bool,
) {
    let catalog = demo_check_catalog();
    for check in &catalog {
        if report
            .logs
            .iter()
            .any(|row| row.demo == demo && row.check == *check)
        {
            continue;
        }
        if check_applies_for_run(demo, check, hash_selected) {
            let message = "check did not run";
            report.fail(demo, check, message);
            report.logs.push(CheckLog {
                demo: demo.to_string(),
                check: check.clone(),
                status: CheckStatus::Fail,
                detail: message.to_string(),
                duration_ms: None,
            });
        } else {
            let reason = if check == CHECK_RSS {
                "target_os is not linux"
            } else if check == CHECK_HASHES {
                "not selected by HASH_DEMOS"
            } else {
                "not this demo"
            };
            report.skip(demo, check, reason);
        }
    }
    let tally = tally(report, demo);
    let applicable = catalog
        .iter()
        .filter(|check| check_applies_for_run(demo, check, hash_selected))
        .count();
    let non_applicable = catalog.len() - applicable;
    if tally.pass + tally.fail != applicable || tally.skip != non_applicable {
        report.fail(
            demo,
            CHECK_COUNT,
            format!(
                "pass={} fail={} skip={}, applicable={applicable}, non_applicable={non_applicable}",
                tally.pass, tally.fail, tally.skip
            ),
        );
    }
    print_demo(report, demo, parse_ms, rss_kib);
}

fn print_demo(report: &FailureReport, demo: &str, parse_ms: Option<u128>, rss_kib: Option<u64>) {
    let label = demo_label(demo);
    let parse = parse_ms
        .map(|ms| ms.to_string())
        .unwrap_or_else(|| "n/a".to_string());
    let rss = if cfg!(target_os = "linux") {
        rss_kib
            .map(|kib| kib.to_string())
            .unwrap_or_else(|| "n/a".to_string())
    } else {
        "unavailable".to_string()
    };
    eprintln!("[{label}] parse_ms={parse} rss_kib={rss}");
    for check in demo_check_catalog() {
        let Some(row) = report
            .logs
            .iter()
            .find(|row| row.demo == demo && row.check == check)
        else {
            eprintln!("[{label}] FAIL {check}: missing log row");
            continue;
        };
        eprintln!(
            "[{label}] {} {check}: {}{}",
            row.status.as_str(),
            row.detail,
            duration_suffix(row.duration_ms)
        );
    }
}

fn print_global_log(report: &FailureReport) {
    for row in report.logs.iter().filter(|row| row.demo == ALL_DEMOS) {
        eprintln!(
            "[all] {} {}: {}{}",
            row.status.as_str(),
            row.check,
            row.detail,
            duration_suffix(row.duration_ms)
        );
    }
}

fn print_summary(report: &FailureReport, passes: u64, reads: usize) {
    let catalog = demo_check_catalog();
    let mut plain = String::from("summary\n");
    plain.push_str(&format!("demo\t{}\n", catalog.join("\t")));
    let mut markdown = String::from("### Real demos\n\n");
    markdown.push_str("| demo |");
    for check in &catalog {
        markdown.push_str(&format!(" {check} |"));
    }
    markdown.push('\n');
    markdown.push_str("| --- |");
    for _ in &catalog {
        markdown.push_str(" --- |");
    }
    markdown.push('\n');
    let mut totals = vec![(0usize, 0usize, 0usize); catalog.len()];
    for row in DEMO_EXPECTATIONS {
        plain.push_str(row.label);
        markdown.push_str(&format!("| {} |", row.label));
        for (index, check) in catalog.iter().enumerate() {
            let status = report
                .logs
                .iter()
                .find(|log| log.demo == row.name && log.check == *check)
                .map(|log| log.status.as_str())
                .unwrap_or("-");
            plain.push('\t');
            plain.push_str(status);
            markdown.push_str(&format!(" {status} |"));
            match status {
                "PASS" => totals[index].0 += 1,
                "FAIL" => totals[index].1 += 1,
                "SKIP" => totals[index].2 += 1,
                _ => {}
            }
        }
        plain.push('\n');
        markdown.push('\n');
    }
    plain.push_str("TOTAL");
    markdown.push_str("| TOTAL |");
    for (pass, fail, skip) in &totals {
        let cell = format!("{pass}/{fail}/{skip}");
        plain.push('\t');
        plain.push_str(&cell);
        markdown.push_str(&format!(" {cell} |"));
    }
    plain.push('\n');
    markdown.push('\n');
    let per_demo = if reads == 0 {
        0.0
    } else {
        passes as f64 / reads as f64
    };
    let footer = format!("full_parse_passes={passes} demos={reads} ({per_demo:.1} per demo)\n");
    plain.push_str(&footer);
    markdown.push('\n');
    markdown.push_str(&footer);
    markdown.push_str("\n### Global\n\n| check | result | detail |\n| --- | --- | --- |\n");
    for row in report.logs.iter().filter(|row| row.demo == ALL_DEMOS) {
        let detail = row.detail.replace('|', "/");
        markdown.push_str(&format!(
            "| {} | {} | {detail} |\n",
            row.check,
            row.status.as_str()
        ));
        plain.push_str(&format!(
            "[all]\t{}\t{}\t{detail}\n",
            row.check,
            row.status.as_str()
        ));
    }
    eprint!("{plain}");
    append_step_summary(&markdown);
}

fn append_step_summary(markdown: &str) {
    let Ok(path) = std::env::var("GITHUB_STEP_SUMMARY") else {
        return;
    };
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .unwrap_or_else(|err| panic!("could not append {path}: {err}"));
    use std::io::Write;
    write!(file, "{markdown}").unwrap_or_else(|err| panic!("could not write {path}: {err}"));
}

#[test]
fn hash_file_errors_fail_that_demo_and_the_loop_continues() {
    let dir = std::env::temp_dir().join(format!("cs2-hash-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap_or_else(|err| panic!("could not create temp dir: {err}"));
    let missing = output_hash::read_demo_hash_file(&dir.join("premier-d2.dem.json"));
    let missing = match missing {
        Err(message) => message,
        Ok(_) => panic!("a missing hash file must be an error, not a parsed hash"),
    };
    assert!(
        missing.contains("premier-d2.dem.json"),
        "missing-file message names the demo: {missing}"
    );
    let corrupt_path = dir.join("legacy-vs-spirit-m2-ancient.dem.json");
    std::fs::write(&corrupt_path, b"{not json")
        .unwrap_or_else(|err| panic!("could not write corrupt hash: {err}"));
    let corrupt = output_hash::read_demo_hash_file(&corrupt_path);
    let corrupt = match corrupt {
        Err(message) => message,
        Ok(_) => panic!("corrupt JSON must be an error, not a parsed hash"),
    };
    assert!(
        corrupt.contains("could not parse"),
        "unparsable file message: {corrupt}"
    );

    let mut report = FailureReport::default();
    let loads: [(&str, Result<(), String>); 2] = [
        ("premier-d2.dem", Err(missing)),
        ("legacy-vs-spirit-m2-ancient.dem", Err(corrupt)),
    ];
    for (demo, stored) in loads {
        report.run(demo, CHECK_HASHES, |check| {
            if let Err(message) = stored {
                check.fail(message);
            }
        });
        report.run(demo, CHECK_ROUND_COUNTS, |check| {
            check.set_detail("ran");
        });
    }
    assert_eq!(report.lines.len(), 2, "{:?}", report.lines);
    assert!(
        report.lines[0].starts_with("premier-d2.dem :: hashes :: "),
        "{}",
        report.lines[0]
    );
    assert!(
        report.lines[1].starts_with("legacy-vs-spirit-m2-ancient.dem :: hashes :: "),
        "{}",
        report.lines[1]
    );
    assert_eq!(report.executed("premier-d2.dem"), 2);
    assert_eq!(report.executed("legacy-vs-spirit-m2-ancient.dem"), 2);
    assert!(report.logs.iter().any(|row| {
        row.demo == "legacy-vs-spirit-m2-ancient.dem"
            && row.check == CHECK_ROUND_COUNTS
            && row.status == CheckStatus::Pass
    }));
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn per_demo_hash_file_round_trip_and_combined_file_errors_do_not_panic() {
    let dir = std::env::temp_dir().join(format!("cs2-hash-round-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap_or_else(|err| panic!("could not create temp dir: {err}"));
    let sections = serde_json::from_str::<output_hash::SectionHashes>(
        r#"{
            "events":"e","header":"h","players":"p","rounds":"r","grenades":"g",
            "shots":"s","kills":"k","hurts":"hu","blinds":"b","bomb_events":"be",
            "buy_events":"bu","controller_dump":"c","player_count":"pc","frame_count":"f",
            "ticks":"t","x":"x","y":"y","z":"z","yaw":"ya","health":"he","armor":"a",
            "flags":"fl","money":"m","equip":"eq","gear":"ge","primary":"pr",
            "secondary":"se","active":"ac","clip":"cl","reserve":"re"
        }"#,
    )
    .unwrap_or_else(|err| panic!("sample sections: {err}"));
    let demo = output_hash::DemoHash {
        name: "premier-d2.dem".to_string(),
        sha256: "abc".to_string(),
        sections,
    };
    let path = dir.join("premier-d2.dem.json");
    output_hash::write_hashes(
        &dir.join("output-hashes.json"),
        &output_hash::OutputHashes {
            demos: vec![demo.clone()],
        },
    );
    let text = serde_json::to_string_pretty(&demo)
        .unwrap_or_else(|err| panic!("could not encode sample hash: {err}"));
    std::fs::write(&path, text).unwrap_or_else(|err| panic!("could not write sample hash: {err}"));
    let loaded = output_hash::read_demo_hash_file(&path)
        .unwrap_or_else(|err| panic!("readable hash file must not fail: {err}"));
    assert_eq!(loaded.name, "premier-d2.dem");
    let combined = output_hash::read_hashes(&dir.join("output-hashes.json"))
        .unwrap_or_else(|err| panic!("readable combined file must not fail: {err}"));
    assert_eq!(combined.demos.len(), 1);
    let missing = output_hash::read_hashes(&dir.join("nope.json"));
    assert!(missing.is_err(), "a missing combined file is an error");
    std::fs::write(dir.join("bad.json"), b"[]")
        .unwrap_or_else(|err| panic!("could not write bad hash: {err}"));
    let bad = output_hash::read_hashes(&dir.join("bad.json"));
    assert!(bad.is_err(), "unparsable combined JSON is an error");
    let per_demo = stored_hash(&HashLoad::PerDemo(dir.clone()), "premier-d2.dem")
        .unwrap_or_else(|err| panic!("per-demo load: {err}"));
    assert!(per_demo.is_some());
    let gone = stored_hash(&HashLoad::PerDemo(dir.clone()), "missing.dem");
    let gone = match gone {
        Err(message) => message,
        Ok(_) => panic!("missing per-demo file must fail the hash check"),
    };
    assert!(gone.contains("missing.dem.json"), "{gone}");
    let mut report = FailureReport::default();
    let load = HashLoad::PerDemo(dir.clone());
    report.run("missing.dem", CHECK_HASHES, |check| {
        if let Err(message) = stored_hash(&load, "missing.dem") {
            check.fail(message);
        }
    });
    report.run("premier-d2.dem", CHECK_ROUND_COUNTS, |check| {
        check.set_detail("ran");
    });
    assert_eq!(
        report.lines,
        vec![format!("missing.dem :: hashes :: {gone}")]
    );
    assert_eq!(report.executed("premier-d2.dem"), 1);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn hash_demos_narrows_only_the_hash_check_and_ci_rejects_it() {
    let manifest: Vec<String> = DEMO_EXPECTATIONS
        .iter()
        .map(|row| row.name.to_string())
        .collect();
    let rejected = resolve_hash_demos(true, Some("premier-d2.dem"), &manifest);
    let rejected = match rejected {
        Err(message) => message,
        Ok(_) => panic!("HASH_DEMOS under CI must be rejected"),
    };
    assert!(rejected.contains("CI"), "{rejected}");
    assert!(rejected.contains("HASH_DEMOS"), "{rejected}");
    let blank = resolve_hash_demos(false, Some(" , "), &manifest);
    assert!(blank.is_err(), "blank HASH_DEMOS must be rejected");
    let unknown = resolve_hash_demos(false, Some("nope.dem"), &manifest);
    let unknown = match unknown {
        Err(message) => message,
        Ok(_) => panic!("unknown HASH_DEMOS names must be rejected"),
    };
    assert!(
        unknown.contains("nope.dem"),
        "unknown name stays in the message: {unknown}"
    );
    assert!(resolve_hash_demos(false, None, &manifest)
        .unwrap_or_else(|err| panic!("{err}"))
        .is_none());
    let selected = resolve_hash_demos(false, Some("premier-d2.dem"), &manifest)
        .unwrap_or_else(|err| panic!("{err}"));
    let excluded = "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem";
    assert!(!hash_check_selected(excluded, selected.as_deref()));
    assert!(hash_check_selected("premier-d2.dem", selected.as_deref()));
    assert!(!check_applies_for_run(excluded, CHECK_HASHES, false));
    assert!(check_applies_for_run(excluded, CHECK_ROUND_COUNTS, false));
    assert!(check_applies_for_run(excluded, CHECK_SMOKE, false));
    assert!(check_applies_for_run(excluded, CHECK_MOLOTOV, false));
    assert!(check_applies_for_run(excluded, CHECK_DEMO_END, false));
    assert!(check_applies_for_run(excluded, "open-fire-783", false));
    assert!(check_applies_for_run("premier-d2.dem", CHECK_HASHES, true));
}

#[test]
fn rss_failure_is_linux_only_and_skip_is_not_a_runtime_fallback() {
    let boom = Err("could not reset VmHWM".to_string());
    assert_eq!(
        classify_rss(false, boom.clone(), 1),
        RssDisposition::Skip,
        "a non-linux target skips even when the sample failed"
    );
    assert_eq!(
        classify_rss(false, Ok(999), 1),
        RssDisposition::Skip,
        "a non-linux target skips even when a sample exists"
    );
    match classify_rss(true, boom, 1) {
        RssDisposition::Fail { message } => assert!(
            message.contains("reset"),
            "linux reports the reset or read error: {message}"
        ),
        other => panic!("linux reset failure must FAIL, got {other:?}"),
    }
    match classify_rss(true, Ok(10), 5) {
        RssDisposition::Fail { message } => {
            assert!(message.contains("10"), "{message}");
            assert!(message.contains("5"), "{message}");
        }
        other => panic!("over the limit must FAIL, got {other:?}"),
    }
    assert_eq!(
        classify_rss(true, Ok(5), 5),
        RssDisposition::Pass { kib: 5 }
    );
    assert_eq!(
        classify_rss(true, Ok(4), 5),
        RssDisposition::Pass { kib: 4 }
    );
}

#[test]
fn skip_count_matches_the_static_table() {
    let mut report = FailureReport::default();
    let demo = "premier-d2.dem";
    close_demo(&mut report, demo, None, None, true);
    let catalog = demo_check_catalog();
    let applicable = catalog
        .iter()
        .filter(|check| check_applies(demo, check))
        .count();
    let logs: Vec<_> = report.logs.iter().filter(|row| row.demo == demo).collect();
    let pass = logs
        .iter()
        .filter(|row| row.status == CheckStatus::Pass)
        .count();
    let fail = logs
        .iter()
        .filter(|row| row.status == CheckStatus::Fail)
        .count();
    let skip = logs
        .iter()
        .filter(|row| row.status == CheckStatus::Skip)
        .count();
    assert_eq!(pass + fail, applicable);
    assert_eq!(skip, catalog.len() - applicable);
    assert!(logs.iter().any(|row| {
        row.check == "open-fire-783"
            && row.status == CheckStatus::Skip
            && row.detail == "not this demo"
    }));
    assert!(logs
        .iter()
        .any(|row| row.check == CHECK_SMOKE && row.status == CheckStatus::Fail));
    if cfg!(target_os = "linux") {
        assert!(logs
            .iter()
            .any(|row| row.check == CHECK_RSS && row.status == CheckStatus::Fail));
        assert_eq!(skip, OPEN_FIRES.len());
    } else {
        assert!(logs.iter().any(|row| {
            row.check == CHECK_RSS
                && row.status == CheckStatus::Skip
                && row.detail == "target_os is not linux"
        }));
    }
}

/// Writing `5` to `/proc/self/clear_refs` resets `VmHWM` to current `VmRSS`.
/// Documented here because the real-demo limit uses that reset: without it the
/// peak only grows and every later demo inherits the earlier max.
#[test]
#[cfg(target_os = "linux")]
fn clear_refs_resets_vm_hwm() {
    // Anonymous mmap, not the process allocator: mimalloc keeps freed heap
    // pages resident, so `VmHWM` would not fall after `drop`.
    const MAP_BYTES: usize = 64 * 1024 * 1024;
    const PROT_READ_WRITE: i32 = 1 | 2;
    const MAP_PRIVATE_ANONYMOUS: i32 = 0x02 | 0x20;
    unsafe extern "C" {
        fn mmap(addr: *mut u8, len: usize, prot: i32, flags: i32, fd: i32, offset: i64) -> *mut u8;
        fn munmap(addr: *mut u8, len: usize) -> i32;
    }
    reset_peak_rss().unwrap_or_else(|err| panic!("{err}"));
    let baseline = read_vm_hwm_kib().unwrap_or_else(|err| panic!("{err}"));
    let ptr = unsafe {
        mmap(
            std::ptr::null_mut(),
            MAP_BYTES,
            PROT_READ_WRITE,
            MAP_PRIVATE_ANONYMOUS,
            -1,
            0,
        )
    };
    assert!(!ptr.is_null() && ptr != (-1isize as *mut u8), "mmap failed");
    for offset in (0..MAP_BYTES).step_by(4096) {
        unsafe {
            std::ptr::write_volatile(ptr.add(offset), 1);
        }
    }
    let high = read_vm_hwm_kib().unwrap_or_else(|err| panic!("{err}"));
    assert!(
        high > baseline + 32_000,
        "touching 64 MiB should raise VmHWM: baseline={baseline} high={high}"
    );
    let unmapped = unsafe { munmap(ptr, MAP_BYTES) };
    assert_eq!(unmapped, 0, "munmap failed");
    reset_peak_rss().unwrap_or_else(|err| panic!("{err}"));
    let low = read_vm_hwm_kib().unwrap_or_else(|err| panic!("{err}"));
    assert!(
        low + 32_000 < high,
        "VmHWM should drop after clear_refs once the mapping is gone: high={high} low={low}"
    );
}
