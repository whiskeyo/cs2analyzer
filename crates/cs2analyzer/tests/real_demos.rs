//! Parse every downloaded release demo once.
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
    counted_scoreboard_round, full_parse_passes, is_bot_steam_id, note_scoreboard_presence,
    parse_demo_with_test_observer, read_scoreboard_controllers, reset_full_parse_passes,
    scoreboard_players, BombKind, GrenadeKind, GrenadeThrow, Match, ParseOptions, Round,
    RoundScoreboardPlayer, ScoreboardController, SMOKE_DURATION_SECONDS,
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
const CHECK_PLAYBACK_GAP: &str = "playback-no-gap";
const CHECK_MOLOTOV: &str = "molotov-burn-window";
const CHECK_SMOKE: &str = "smoke-end";
const CHECK_DEMO_END: &str = "demo-end-smoke";
const CHECK_HASHES: &str = "hashes";
const CHECK_UTF8: &str = "lossy-utf8";
const CHECK_ROUND_SCOREBOARD: &str = "round-scoreboard";
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
/// Assets-v2 rows only fill the fields a reference exists for.
struct DemoExpect {
    name: &'static str,
    /// Short label for the per-check log. The failure line still uses `name`.
    label: &'static str,
    /// Played rounds, excluding `is_knife`.
    played: usize,
    knife: usize,
    /// `None` is a static SKIP for `smoke-end` and `demo-end-smoke`.
    smoke: Option<SmokeCensus>,
    /// `None` is a static SKIP for `rss`, including on Linux.
    rss_limit_kib: Option<u64>,
    /// `None` is a static SKIP for `lossy-utf8`.
    lossy_utf8: Option<&'static [LossyUtf8]>,
    /// Bot controller entities must not be scoreboard rows.
    /// Mirage 22–20 (assets-v2) and Inferno FACEIT fruju-vs-rooster.
    no_bot_rows: bool,
}

struct SmokeCensus {
    smokes: usize,
    with_expire: usize,
    /// No in-window `smokegrenade_expired`.
    without_expire: usize,
    /// Of `without_expire`, those that end on the next `m_nRoundStartCount` edge.
    ended_at_round_open: usize,
    /// Of `without_expire`, those that end on the last sampled tick.
    ended_at_demo_end: usize,
    /// Set for assets-v1. Unset means this count is not part of the census.
    after_round_end: Option<usize>,
}

/// One game-event string that was not valid UTF-8 and was decoded lossily.
struct LossyUtf8 {
    event: &'static str,
    key: &'static str,
    text: &'static str,
}

/// FACEIT keeps the knife round (`is_knife`, number 0). HLTV and Premier have none.
const fn v1_smoke(
    smokes: usize,
    with_expire: usize,
    without_expire: usize,
    ended_at_round_open: usize,
    ended_at_demo_end: usize,
    after_round_end: usize,
) -> SmokeCensus {
    SmokeCensus {
        smokes,
        with_expire,
        without_expire,
        ended_at_round_open,
        ended_at_demo_end,
        after_round_end: Some(after_round_end),
    }
}

const DEMO_EXPECTATIONS: &[DemoExpect] = &[
    DemoExpect {
        name: "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem",
        label: "0eb2df7f",
        played: 35,
        knife: 1,
        smoke: Some(v1_smoke(160, 146, 14, 13, 1, 25)),
        rss_limit_kib: Some(800_000),
        lossy_utf8: None,
        no_bot_rows: false,
    },
    DemoExpect {
        name: "1-898c8041-ac25-4ab8-8a2b-c384318aac1c-1-1.dem",
        label: "898c8041",
        played: 16,
        knife: 1,
        smoke: Some(v1_smoke(52, 44, 8, 8, 0, 10)),
        rss_limit_kib: Some(800_000),
        lossy_utf8: None,
        no_bot_rows: false,
    },
    DemoExpect {
        name: "1-b3ea81e1-103d-4877-83d1-e5bbf1bcb7eb-1-1.dem",
        label: "b3ea81e1",
        played: 29,
        knife: 1,
        smoke: Some(v1_smoke(124, 116, 8, 8, 0, 20)),
        rss_limit_kib: Some(650_000),
        lossy_utf8: None,
        no_bot_rows: false,
    },
    DemoExpect {
        name: "legacy-vs-spirit-m2-ancient.dem",
        label: "legacy-m2",
        played: 22,
        knife: 0,
        smoke: Some(v1_smoke(149, 145, 4, 4, 0, 8)),
        rss_limit_kib: Some(1_200_000),
        lossy_utf8: None,
        no_bot_rows: false,
    },
    DemoExpect {
        name: "premier-d2.dem",
        label: "premier-d2",
        played: 15,
        knife: 0,
        smoke: Some(v1_smoke(45, 38, 7, 6, 1, 13)),
        rss_limit_kib: Some(850_000),
        lossy_utf8: None,
        no_bot_rows: false,
    },
    DemoExpect {
        name: "spirit-vs-dendele-m1-ancient.dem",
        label: "dendele-m1",
        played: 21,
        knife: 0,
        smoke: Some(v1_smoke(139, 133, 6, 6, 0, 8)),
        rss_limit_kib: Some(700_000),
        lossy_utf8: None,
        no_bot_rows: false,
    },
    DemoExpect {
        name: "spirit-vs-furia-m1-ancient.dem",
        label: "furia-m1",
        played: 23,
        knife: 0,
        smoke: Some(v1_smoke(160, 152, 8, 8, 0, 20)),
        rss_limit_kib: Some(700_000),
        lossy_utf8: None,
        no_bot_rows: false,
    },
    DemoExpect {
        name: "spirit-vs-mouz-m3-ancient.dem",
        label: "mouz-m3",
        played: 22,
        knife: 0,
        smoke: Some(v1_smoke(149, 143, 6, 6, 0, 11)),
        rss_limit_kib: Some(700_000),
        lossy_utf8: None,
        no_bot_rows: false,
    },
    DemoExpect {
        name: "spirit-vs-mouz-m4-nuke.dem",
        label: "mouz-m4",
        played: 23,
        knife: 0,
        smoke: Some(v1_smoke(176, 168, 8, 8, 0, 15)),
        rss_limit_kib: Some(1_250_000),
        lossy_utf8: None,
        no_bot_rows: false,
    },
    // Mirage FACEIT (20–22, knife, OT). #118: non-UTF-8 game-event strings.
    // Smoke census from demoinfocs-golang v5.2.0. The demo-end cloud detonates
    // at 265459 and ends on this parse's last tick (reference 266675).
    DemoExpect {
        name: MIRAGE_LOSSY_UTF8_DEMO,
        label: "b5045d4d",
        played: 42,
        knife: 1,
        smoke: Some(SmokeCensus {
            smokes: 160,
            with_expire: 152,
            without_expire: 8,
            ended_at_round_open: 7,
            ended_at_demo_end: 1,
            after_round_end: None,
        }),
        rss_limit_kib: None,
        lossy_utf8: Some(MIRAGE_LOSSY_UTF8),
        no_bot_rows: true,
    },
    DemoExpect {
        name: "bushido-wildcats-vs-illyrians-m1-anubis.dem",
        label: "bushido-m1",
        played: 30,
        knife: 0,
        smoke: Some(SmokeCensus {
            smokes: 175,
            with_expire: 156,
            without_expire: 19,
            ended_at_round_open: 19,
            ended_at_demo_end: 0,
            after_round_end: None,
        }),
        rss_limit_kib: None,
        lossy_utf8: None,
        no_bot_rows: false,
    },
    DemoExpect {
        name: "fruju-vs-rooster-m1-inferno.dem",
        label: "fruju-m1",
        played: 16,
        knife: 1,
        smoke: Some(SmokeCensus {
            smokes: 92,
            with_expire: 82,
            without_expire: 10,
            ended_at_round_open: 9,
            ended_at_demo_end: 1,
            after_round_end: None,
        }),
        rss_limit_kib: None,
        lossy_utf8: None,
        no_bot_rows: true,
    },
];

const MIRAGE_LOSSY_UTF8_DEMO: &str = "1-b5045d4d-daaf-4ab6-82de-3c345a0e6930-1-1.dem";

/// `player_disconnect.networkid` on the Mirage FACEIT demo is not UTF-8.
/// #118 / source2-demo 0.5.10 keeps the parse and decodes `val_string` with
/// `String::from_utf8_lossy`: U+FFFD, then the bytes that were already valid
/// (`5#!` and the two trailing control bytes).
const MIRAGE_LOSSY_UTF8: &[LossyUtf8] = &[LossyUtf8 {
    event: "player_disconnect",
    key: "networkid",
    text: "\u{FFFD}5#!\u{0004}\u{0002}",
}];

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
    /// `None` means this parse's last sampled tick. Assets-v2 Inferno's
    /// reference ends at 152468 and Mirage's at 266675; our sample is one
    /// tick earlier in both cases.
    end: Option<u32>,
}

/// 228691 and 81808 are the detonate ticks. Both clouds stop on the last
/// sampled tick (a couple of ticks before playback_ticks), not on +22s.
/// 151283 is the Inferno demo-end smoke and 265459 is the Mirage one; each
/// ends on this parse's last sample.
const DEMO_END_SMOKES: &[DemoEndSmoke] = &[
    DemoEndSmoke {
        demo: "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem",
        detonate: 228_691,
        end: Some(230_008),
    },
    DemoEndSmoke {
        demo: "premier-d2.dem",
        detonate: 81_808,
        end: Some(83_030),
    },
    DemoEndSmoke {
        demo: "fruju-vs-rooster-m1-inferno.dem",
        detonate: 151_283,
        end: None,
    },
    DemoEndSmoke {
        demo: MIRAGE_LOSSY_UTF8_DEMO,
        detonate: 265_459,
        end: None,
    },
];

/// Applicable checks for one demo. `rss` is included only on Linux, and only
/// when the static table has a limit. Open fires come from [`OPEN_FIRES`]
/// keyed by the manifest name. A check with no row data is a static SKIP.
fn expected_check_count(name: &str) -> usize {
    demo_check_catalog()
        .into_iter()
        .filter(|check| check_applies(name, check))
        .count()
}

fn open_fire_check_name(entity: i32) -> String {
    format!("open-fire-{entity}")
}

fn demo_check_catalog() -> Vec<String> {
    let mut names = vec![
        CHECK_RSS.to_string(),
        CHECK_ROUND_COUNTS.to_string(),
        CHECK_PLAYBACK_GAP.to_string(),
        CHECK_MOLOTOV.to_string(),
    ];
    for fire in OPEN_FIRES {
        names.push(open_fire_check_name(fire.entity));
    }
    names.push(CHECK_SMOKE.to_string());
    names.push(CHECK_DEMO_END.to_string());
    names.push(CHECK_HASHES.to_string());
    names.push(CHECK_UTF8.to_string());
    names.push(CHECK_ROUND_SCOREBOARD.to_string());
    names
}

/// Static row: which catalog checks apply to this manifest name.
/// A missing census is a SKIP here, not something decided after the parse.
fn check_applies(demo: &str, check: &str) -> bool {
    let Some(row) = lookup_demo(demo) else {
        return false;
    };
    if check == CHECK_RSS {
        return cfg!(target_os = "linux") && row.rss_limit_kib.is_some();
    }
    if let Some(fire) = OPEN_FIRES
        .iter()
        .find(|fire| open_fire_check_name(fire.entity) == check)
    {
        return fire.demo == demo;
    }
    match check {
        CHECK_ROUND_COUNTS
        | CHECK_PLAYBACK_GAP
        | CHECK_MOLOTOV
        | CHECK_HASHES
        | CHECK_ROUND_SCOREBOARD => true,
        CHECK_SMOKE | CHECK_DEMO_END => row.smoke.is_some(),
        CHECK_UTF8 => row.lossy_utf8.is_some(),
        _ => false,
    }
}

fn skip_reason(check: &str) -> &'static str {
    if check == CHECK_RSS {
        if !cfg!(target_os = "linux") {
            return "target_os is not linux";
        }
        return "no rss limit in the static table";
    }
    if check == CHECK_HASHES {
        return "not selected by HASH_DEMOS";
    }
    if check == CHECK_SMOKE || check == CHECK_DEMO_END {
        return "no smoke census in the static table";
    }
    if check == CHECK_UTF8 {
        return "no lossy-utf8 expectation in the static table";
    }
    "not this demo"
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

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
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
    /// Last sampled tick for demos whose smoke check ran.
    last_tick: BTreeMap<String, u32>,
}

enum HashLoad {
    /// `UPDATE_HASHES=1`: record hashes, do not read the file.
    Updating,
    /// One `<dir>/<demo>.json` per demo (`test-demos/output-hashes` in CI).
    Checking(std::path::PathBuf),
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
        HashLoad::Checking(dir) => {
            output_hash::read_demo_hash_file(&dir.join(output_hash::hash_file_name(name))).map(Some)
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
        HashLoad::Checking(output_hash::hashes_dir())
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
    run_global_checks(
        &mut report,
        &rollup,
        &hash_load,
        &recorded,
        &seen,
        reads,
        &manifest,
        hash_demos.as_deref(),
    );
    if update_hashes && report.lines.is_empty() {
        let dir = output_hash::hashes_dir();
        for demo in &recorded {
            output_hash::write_demo_hash(demo);
            eprintln!(
                "updated {}",
                output_hash::hash_file_path(&demo.name).display()
            );
        }
        if hash_demos.is_none() {
            output_hash::delete_orphan_hash_files(&dir, &manifest);
        }
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
    report.run(name, CHECK_PLAYBACK_GAP, |check| {
        check_playback_no_gap(check, name, parsed);
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
    if check_applies(name, CHECK_SMOKE) {
        report.run(name, CHECK_SMOKE, |check| {
            check_smoke_end(check, name, parsed, smoke, rollup);
        });
        report.run(name, CHECK_DEMO_END, |check| {
            check_demo_end_smoke(check, name, rollup);
        });
    } else {
        let account = account_smokes(name, parsed, smoke);
        report.skip(
            name,
            CHECK_SMOKE,
            &format!(
                "{}; measured smokes={} with_expire={} without_expire={} ended_at_round_open={} ended_at_demo_end={}",
                skip_reason(CHECK_SMOKE),
                account.smokes,
                account.with_expire,
                account.without_expire,
                account.ended_at_round_open,
                account.ended_at_demo_end
            ),
        );
        report.skip(name, CHECK_DEMO_END, skip_reason(CHECK_DEMO_END));
    }
    if hashes.selected {
        report.run(name, CHECK_HASHES, |check| {
            check_output_hash(check, name, parsed, hashes);
        });
    }
    if check_applies(name, CHECK_UTF8) {
        report.run(name, CHECK_UTF8, |check| {
            check_lossy_utf8(check, name, parsed, smoke);
        });
    }
    report.run(name, CHECK_ROUND_SCOREBOARD, |check| {
        check_round_scoreboard(check, name, parsed, smoke);
    });
}

fn check_output_hash(
    check: &mut AssertSink,
    name: &str,
    parsed: &Match,
    hashes: &mut OutputHashCheck<'_>,
) {
    let computed = output_hash::log_parsed_demo(parsed, hashes.rss_kib);
    let stored = stored_hash(hashes.load, name);
    match stored {
        Err(message) => check.fail(message),
        Ok(None) => check.set_detail(format!("sha256={} (will write)", computed.sha256)),
        Ok(Some(expected)) => {
            check.set_detail(format!("sha256={} (expected match)", computed.sha256));
            if expected.name != name {
                check.fail(format!("{name}: hash file name field is {}", expected.name));
            }
            let report = output_hash::section_diff(name, &expected.sections, &computed.sections);
            if !report.is_empty() {
                check.fail(report);
            }
        }
    }
    hashes.recorded.push(output_hash::DemoHash {
        name: name.to_string(),
        sections: computed.sections,
    });
}

fn check_round_scoreboard(check: &mut AssertSink, name: &str, parsed: &Match, smoke: &SmokeEvents) {
    let Some(expected) = lookup_demo(name) else {
        check.fail(format!("no scoreboard expectation for {name}"));
        return;
    };
    let begin = smoke.begin_new_match.last().copied();
    let counted: Vec<u32> = parsed
        .rounds
        .iter()
        .filter(|round| counted_scoreboard_round(round, begin))
        .map(|round| round.number)
        .collect();
    let got: Vec<u32> = parsed
        .round_scoreboard
        .iter()
        .map(|round| round.round)
        .collect();
    if got != counted {
        check.fail(format!(
            "{name} scoreboard rounds {got:?}, counted rounds {counted:?} (begin_new_match={begin:?})"
        ));
    }
    let Some(last) = parsed.round_scoreboard.last() else {
        check.fail(format!("{name} scoreboard is empty"));
        return;
    };
    if last.round != *counted.last().unwrap_or(&0) {
        check.fail(format!(
            "{name} last scoreboard round is {}, counted last is {:?}",
            last.round,
            counted.last()
        ));
    }
    let roster = parsed.players.len();
    let mut seen: BTreeMap<(u64, u32), &RoundScoreboardPlayer> = BTreeMap::new();
    let mut row_counts = Vec::with_capacity(parsed.round_scoreboard.len());
    for round in &parsed.round_scoreboard {
        row_counts.push(round.players.len());
        if round.players.len() > roster {
            check.fail(format!(
                "{name} round {} has {} scoreboard rows, roster has {roster} players on teams",
                round.round,
                round.players.len()
            ));
        }
        let mut keys = BTreeSet::new();
        for player in &round.players {
            if !scoreboard_row_on_roster(parsed, player) {
                check.fail(format!(
                    "{name} round {} row {} slot={} steam={} was never on T/CT",
                    round.round, player.name, player.slot, player.steam_id
                ));
            }
            let key = scoreboard_row_key(player);
            keys.insert(key);
            if let Some(previous) = seen.get(&key) {
                if scoreboard_counters_dropped(previous, player) {
                    check.fail(format!(
                        "{name} round {} {} counters dropped (was k={} d={} a={} dmg={}, now k={} d={} a={} dmg={})",
                        round.round,
                        player.name,
                        previous.kills,
                        previous.deaths,
                        previous.assists,
                        previous.damage,
                        player.kills,
                        player.deaths,
                        player.assists,
                        player.damage
                    ));
                }
            }
            seen.insert(key, player);
        }
        for (key, previous) in &seen {
            if keys.contains(key) {
                continue;
            }
            check.fail(format!(
                "{name} round {} dropped {} after they had a scoreboard row",
                round.round, previous.name
            ));
        }
    }
    let mut last_on_team: BTreeMap<(u64, u32), RoundScoreboardPlayer> = BTreeMap::new();
    for round in &parsed.round_scoreboard {
        let Some(index) = parsed
            .rounds
            .iter()
            .position(|candidate| candidate.number == round.round)
        else {
            check.fail(format!(
                "{name} scoreboard round {} is not in rounds",
                round.round
            ));
            continue;
        };
        let parsed_round = &parsed.rounds[index];
        let next_start = parsed
            .rounds
            .get(index + 1)
            .map(|next| next.start_tick)
            .unwrap_or(u32::MAX);
        let Some(controllers) =
            controllers_at_round_end(&smoke.scoreboard_closes, parsed_round, next_start)
        else {
            check.fail(format!(
                "{name} round {} has no controller snapshot at close",
                round.round
            ));
            continue;
        };
        let live = scoreboard_players(controllers);
        for player in &round.players {
            let key = scoreboard_row_key(player);
            if let Some(now) = live.iter().find(|row| scoreboard_row_key(row) == key) {
                if !scoreboard_counters_match(player, now) {
                    check.fail(format!(
                        "{name} round {} {} is on T/CT but counters != controller\n  snapshot: {}\n  controller: {}",
                        round.round,
                        player.name,
                        format_scoreboard_players(std::slice::from_ref(player)),
                        format_scoreboard_players(std::slice::from_ref(now))
                    ));
                }
            } else if let Some(previous) = last_on_team.get(&key) {
                if !scoreboard_counters_match(player, previous) {
                    check.fail(format!(
                        "{name} round {} {} carried counters != last on-team close\n  snapshot: {}\n  last on team: {}",
                        round.round,
                        player.name,
                        format_scoreboard_players(std::slice::from_ref(player)),
                        format_scoreboard_players(std::slice::from_ref(previous))
                    ));
                }
            } else {
                check.fail(format!(
                    "{name} round {} {} was never on T/CT at a round close",
                    round.round, player.name
                ));
            }
        }
        for player in live {
            last_on_team.insert(scoreboard_row_key(&player), player);
        }
    }
    let kills: i32 = last.players.iter().map(|player| player.kills).sum();
    let damage: i32 = last.players.iter().map(|player| player.damage).sum();
    if kills <= 0 || damage <= 0 {
        check.fail(format!(
            "{name} last round action-tracking totals are kills={kills} damage={damage} (property path missed)"
        ));
    }
    if expected.no_bot_rows {
        let mut bots = Vec::new();
        for round in &parsed.round_scoreboard {
            for player in &round.players {
                if scoreboard_row_is_bot(player, &smoke.bot_rows) {
                    bots.push(format!(
                        "R{} slot={} steam={} name={}",
                        round.round, player.slot, player.steam_id, player.name
                    ));
                }
            }
        }
        if !bots.is_empty() {
            check.fail(format!(
                "{name} bot controllers are separate scoreboard rows: {}",
                bots.join("; ")
            ));
        }
    }
    check.set_detail(format!(
        "rounds={} rows={row_counts:?} roster={roster} last_players={} kills={kills} damage={damage} bots_hidden={}",
        got.len(),
        last.players.len(),
        expected.no_bot_rows
    ));
}

fn scoreboard_row_key(player: &RoundScoreboardPlayer) -> (u64, u32) {
    if player.steam_id == 0 {
        (0, player.slot)
    } else {
        (player.steam_id, 0)
    }
}

fn scoreboard_row_on_roster(parsed: &Match, player: &RoundScoreboardPlayer) -> bool {
    if player.steam_id == 0 {
        return parsed.players.iter().any(|roster| roster.is_bot);
    }
    parsed
        .players
        .iter()
        .any(|roster| !roster.is_bot && roster.steam_id == player.steam_id)
}

fn scoreboard_counters_match(left: &RoundScoreboardPlayer, right: &RoundScoreboardPlayer) -> bool {
    left.kills == right.kills
        && left.deaths == right.deaths
        && left.assists == right.assists
        && left.damage == right.damage
        && left.headshot_kills == right.headshot_kills
        && left.utility_damage == right.utility_damage
        && left.enemies_flashed == right.enemies_flashed
}

fn controllers_at_round_end<'a>(
    snaps: &'a [(u32, Vec<ScoreboardController>)],
    round: &Round,
    next_start: u32,
) -> Option<&'a [ScoreboardController]> {
    if let Some((_, rows)) = snaps
        .iter()
        .rev()
        .find(|(tick, _)| *tick >= round.end_tick && *tick < next_start)
    {
        return Some(rows.as_slice());
    }
    snaps
        .iter()
        .rev()
        .find(|(tick, _)| *tick >= round.start_tick && *tick <= round.end_tick)
        .map(|(_, rows)| rows.as_slice())
}

fn scoreboard_counters_dropped(
    previous: &RoundScoreboardPlayer,
    current: &RoundScoreboardPlayer,
) -> bool {
    current.kills < previous.kills
        || current.deaths < previous.deaths
        || current.assists < previous.assists
        || current.damage < previous.damage
        || current.headshot_kills < previous.headshot_kills
        || current.utility_damage < previous.utility_damage
        || current.enemies_flashed < previous.enemies_flashed
}

fn format_scoreboard_players(players: &[RoundScoreboardPlayer]) -> String {
    if players.is_empty() {
        return "(none)".to_string();
    }
    players
        .iter()
        .map(|player| {
            format!(
                "{} slot={} steam={} k={} d={} a={} dmg={} hs={} util={} flash={}",
                player.name,
                player.slot,
                player.steam_id,
                player.kills,
                player.deaths,
                player.assists,
                player.damage,
                player.headshot_kills,
                player.utility_damage,
                player.enemies_flashed
            )
        })
        .collect::<Vec<_>>()
        .join(" | ")
}

fn scoreboard_row_is_bot(player: &RoundScoreboardPlayer, bot_rows: &BTreeSet<(u32, u64)>) -> bool {
    player.steam_id == 0
        || is_bot_steam_id(player.steam_id)
        || bot_rows.contains(&(player.slot, player.steam_id))
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

/// No round's playback window may contain two samples more than `tick_stride`
/// apart. That hole is a skipped warmup: the viewer blends across it.
fn check_playback_no_gap(check: &mut AssertSink, name: &str, parsed: &Match) {
    let stride = parsed.header.tick_stride.max(1);
    let ticks = &parsed.ticks.ticks;
    let mut gaps = Vec::new();
    for (index, round) in parsed.rounds.iter().enumerate() {
        let next = parsed.rounds.get(index + 1).map(|round| round.start_tick);
        let (start, end) = playback_window(round, next);
        for pair in ticks.windows(2) {
            let (left, right) = (pair[0], pair[1]);
            let delta = right.saturating_sub(left);
            if delta <= stride || left < start || right > end {
                continue;
            }
            gaps.push(format!(
                "R{} {start}..={end} contains {left}->{right} (delta {delta}, stride {stride})",
                round.number
            ));
        }
    }
    if gaps.is_empty() {
        check.set_detail(format!("gaps=0 stride={stride}"));
        return;
    }
    check.set_detail(gaps.join("; "));
    check.fail(format!(
        "{name} playback window crosses a frame gap: {}",
        gaps.join("; ")
    ));
}

/// Inclusive playback span. `playback_end_tick` wins when it is past the win;
/// otherwise the span stops on `end_tick`. The next round's freeze is excluded.
fn playback_window(round: &Round, next_start: Option<u32>) -> (u32, u32) {
    let mut end = if round.playback_end_tick > round.end_tick {
        round.playback_end_tick
    } else {
        round.end_tick
    };
    if let Some(next) = next_start {
        if next > 0 {
            end = end.min(next.saturating_sub(1));
        }
    }
    if end < round.start_tick {
        end = round.start_tick;
    }
    (round.start_tick, end)
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

struct SmokeAccount {
    smokes: usize,
    with_expire: usize,
    without_expire: usize,
    after_round_end: usize,
    ended_at_round_open: usize,
    ended_at_demo_end: usize,
    duration_cap_hits: usize,
    last_tick: u32,
    demo_end: Vec<(u32, u32)>,
    errors: Vec<String>,
}

fn account_smokes(name: &str, parsed: &Match, events: &SmokeEvents) -> SmokeAccount {
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
    let mut account = SmokeAccount {
        smokes: 0,
        with_expire: 0,
        without_expire: 0,
        after_round_end: 0,
        ended_at_round_open: 0,
        ended_at_demo_end: 0,
        duration_cap_hits: 0,
        last_tick,
        demo_end: Vec::new(),
        errors: Vec::new(),
    };
    for grenade in parsed
        .grenades
        .iter()
        .filter(|grenade| grenade.kind == GrenadeKind::Smoke)
    {
        account.smokes += 1;
        let Some(index) = claim_detonate(grenade, detonates, &mut used) else {
            let same_tick = detonates
                .iter()
                .filter(|detonate| detonate.tick == grenade.detonate_tick)
                .count();
            let land = grenade.points.last();
            account.errors.push(format!(
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
            account.errors.push(format!(
                "{name} smoke at {} is before every round",
                grenade.detonate_tick
            ));
            continue;
        };
        let owner = &parsed.rounds[owner_index];
        let bound = next_round_start(&parsed.rounds, owner).unwrap_or(last_tick);
        let horizon = bound.min(last_tick);
        if !(grenade.detonate_tick <= grenade.end_tick && grenade.end_tick <= horizon) {
            account.errors.push(format!(
                "{name} smoke entity {entity} {} -> {} outside detonate..={horizon} (round {} ends {})",
                grenade.detonate_tick, grenade.end_tick, owner.number, owner.end_tick
            ));
        }
        if grenade.end_tick > owner.end_tick {
            account.after_round_end += 1;
        }
        if let Some(expire) = expire_in_window(expires, entity, grenade.detonate_tick, next) {
            if grenade.end_tick != expire {
                account.errors.push(format!(
                    "{name} smoke entity {entity} at {} paired outside its window (expire {expire}, next {next:?})",
                    grenade.detonate_tick
                ));
            }
            account.with_expire += 1;
        } else {
            let outside = expires
                .iter()
                .any(|event| event.entity == entity && event.tick == grenade.end_tick);
            if outside {
                account.errors.push(format!(
                    "{name} smoke entity {entity} at {} paired with an expire outside its window",
                    grenade.detonate_tick
                ));
            }
            let duration_cap = grenade.detonate_tick.saturating_add(life);
            if grenade.end_tick >= duration_cap {
                account.duration_cap_hits += 1;
                account.errors.push(format!(
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
                account.errors.push(format!(
                    "{name} smoke entity {entity} {} -> {} is not the next m_nRoundStartCount edge ({next_open:?}) or the last sampled tick {last_tick} (22s cap {duration_cap})",
                    grenade.detonate_tick, grenade.end_tick
                ));
            }
            if at_next_open && !at_demo_end {
                account.ended_at_round_open += 1;
            }
            if at_demo_end && !at_next_open {
                account.ended_at_demo_end += 1;
                account
                    .demo_end
                    .push((grenade.detonate_tick, grenade.end_tick));
            }
            account.without_expire += 1;
        }
    }
    account
}

fn check_smoke_end(
    check: &mut AssertSink,
    name: &str,
    parsed: &Match,
    events: &SmokeEvents,
    rollup: &mut SmokeRollup,
) {
    let account = account_smokes(name, parsed, events);
    rollup.last_tick.insert(name.to_string(), account.last_tick);
    rollup.missing_expire += account.without_expire;
    rollup.ended_at_round_open += account.ended_at_round_open;
    for (detonate, end) in &account.demo_end {
        rollup
            .ended_at_demo_end
            .push((name.to_string(), *detonate, *end));
    }
    for message in account.errors {
        check.fail(message);
    }
    let Some(expected) = lookup_demo(name).and_then(|row| row.smoke.as_ref()) else {
        check.fail(format!("no smoke census for {name}"));
        return;
    };
    let smokes = account.smokes;
    let with_expire = account.with_expire;
    let without_expire = account.without_expire;
    let after_round_end = account.after_round_end;
    let ended_at_round_open = account.ended_at_round_open;
    let ended_at_demo_end = account.ended_at_demo_end;
    let duration_cap_hits = account.duration_cap_hits;
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
    if let Some(expected_after) = expected.after_round_end {
        if after_round_end != expected_after {
            check.fail(format!(
                "{name} ending after round end: got {after_round_end}, expected {expected_after}"
            ));
        }
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
    let after_label = expected
        .after_round_end
        .map(|count| count.to_string())
        .unwrap_or_else(|| "unset".to_string());
    check.set_detail(format!(
        "smokes={smokes} with_expire={with_expire} without_expire={without_expire} ended_at_round_open={ended_at_round_open} ended_at_demo_end={ended_at_demo_end} after_round_end={after_round_end} duration_cap={duration_cap_hits} (expected {}/{}/{}/{}/{}/{after_label}/{cap})",
        expected.smokes,
        expected.with_expire,
        expected.without_expire,
        expected.ended_at_round_open,
        expected.ended_at_demo_end,
        cap = EXPECTED_DURATION_CAP
    ));
}

fn census_total(pick: fn(&SmokeCensus) -> usize) -> usize {
    DEMO_EXPECTATIONS
        .iter()
        .filter_map(|row| row.smoke.as_ref())
        .map(pick)
        .sum()
}

fn expected_demo_end_rows(
    last_tick: &BTreeMap<String, u32>,
) -> Result<Vec<(String, u32, u32)>, String> {
    let mut rows = Vec::new();
    for row in DEMO_END_SMOKES {
        let end = demo_end_tick(row, last_tick.get(row.demo).copied())?;
        rows.push((row.demo.to_string(), row.detonate, end));
    }
    rows.sort_unstable();
    Ok(rows)
}

fn check_lossy_utf8(check: &mut AssertSink, name: &str, parsed: &Match, events: &SmokeEvents) {
    let Some(expected) = lookup_demo(name).and_then(|row| row.lossy_utf8) else {
        check.fail(format!("no lossy-utf8 expectation for {name}"));
        return;
    };
    if expected.is_empty() {
        check.fail(format!("{name} lossy-utf8 table is empty"));
    }
    if name == MIRAGE_LOSSY_UTF8_DEMO && parsed.header.map_name != "de_mirage" {
        check.fail(format!(
            "{name} map: got {}, expected de_mirage",
            parsed.header.map_name
        ));
    }
    let got: Vec<String> = events
        .lossy
        .iter()
        .map(|row| format!("{} {} {}", row.event, row.key, row.text))
        .collect();
    let want: Vec<String> = expected
        .iter()
        .map(|row| format!("{} {} {}", row.event, row.key, row.text))
        .collect();
    check.set_detail(format!(
        "lossy={} map={}",
        got.len(),
        parsed.header.map_name
    ));
    if got != want {
        check.fail(format!(
            "{name} lossy strings: got {got:?}, expected {want:?}"
        ));
    }
}

fn demo_end_tick(row: &DemoEndSmoke, last_tick: Option<u32>) -> Result<u32, String> {
    match row.end {
        Some(tick) => Ok(tick),
        None => last_tick.ok_or_else(|| format!("{} last sampled tick missing", row.demo)),
    }
}

fn check_demo_end_smoke(check: &mut AssertSink, name: &str, rollup: &SmokeRollup) {
    let got: Vec<(u32, u32)> = rollup
        .ended_at_demo_end
        .iter()
        .filter(|(demo, _, _)| demo == name)
        .map(|(_, detonate, end)| (*detonate, *end))
        .collect();
    let last_tick = rollup.last_tick.get(name).copied();
    let mut expected = Vec::new();
    for row in DEMO_END_SMOKES.iter().filter(|row| row.demo == name) {
        match demo_end_tick(row, last_tick) {
            Ok(tick) => expected.push((row.detonate, tick)),
            Err(message) => check.fail(message),
        }
    }
    check.set_detail(format!("got {got:?} (expected {expected:?})"));
    if got != expected {
        check.fail(format!(
            "{name} missing-expire smokes that stop on the last sampled tick: got {got:?}, expected {expected:?}"
        ));
    }
}

#[allow(clippy::too_many_arguments)]
fn run_global_checks(
    report: &mut FailureReport,
    rollup: &SmokeRollup,
    hash_load: &HashLoad,
    recorded: &[output_hash::DemoHash],
    seen: &BTreeSet<String>,
    reads: usize,
    manifest: &[String],
    hash_demos: Option<&[String]>,
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
        let expected = census_total(|row| row.without_expire);
        check.set_detail(format!(
            "without_expire={} (expected {expected})",
            rollup.missing_expire
        ));
        if rollup.missing_expire != expected {
            check.fail(format!(
                "smokes with no in-window expire: got {}, expected {expected}",
                rollup.missing_expire
            ));
        }
    });
    report.run(ALL_DEMOS, "missing-expire-round-open", |check| {
        let expected = census_total(|row| row.ended_at_round_open);
        check.set_detail(format!(
            "ended_at_round_open={} (expected {expected})",
            rollup.ended_at_round_open
        ));
        if rollup.ended_at_round_open != expected {
            check.fail(format!(
                "missing-expire smokes that stop on the next m_nRoundStartCount edge: got {}, expected {expected}",
                rollup.ended_at_round_open
            ));
        }
    });
    report.run(ALL_DEMOS, "missing-expire-demo-end", |check| {
        let mut ended = rollup.ended_at_demo_end.clone();
        ended.sort_unstable();
        let expected = match expected_demo_end_rows(&rollup.last_tick) {
            Ok(rows) => rows,
            Err(message) => {
                check.fail(message);
                return;
            }
        };
        check.set_detail(format!(
            "ended_at_demo_end={} (expected {})",
            ended.len(),
            expected.len()
        ));
        if ended != expected {
            check.fail(format!(
                "missing-expire smokes that stop on the last sampled tick: got {ended:?}, expected {expected:?}"
            ));
        }
    });
    report.run(ALL_DEMOS, "output-hash-roster", |check| match hash_load {
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
        HashLoad::Checking(dir) => {
            let parsed_names: Vec<String> = recorded.iter().map(|row| row.name.clone()).collect();
            let files = output_hash::list_hash_file_demos(dir);
            let coverage =
                output_hash::coverage_report(manifest, &parsed_names, &files, hash_demos.is_none());
            if !coverage.is_empty() {
                check.fail(coverage);
            }
            check.set_detail(format!(
                "recorded={} hash_files={}",
                recorded.len(),
                files.len()
            ));
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

#[derive(Clone)]
struct LossyEventString {
    event: String,
    key: String,
    text: String,
}

#[derive(Clone, Default)]
struct SmokeEvents {
    detonates: Vec<SmokeDetonate>,
    expires: Vec<SmokeExpire>,
    /// Last `m_nRoundStartCount`. `None` until the prop exists.
    round_start_count: Option<i32>,
    /// Ticks where `m_nRoundStartCount` changed. The first sighting is not an edge.
    round_opens: Vec<u32>,
    /// Game-event strings that contained invalid UTF-8 (`U+FFFD` after lossy decode).
    lossy: Vec<LossyEventString>,
    /// `begin_new_match` ticks, including warmup. The last one matches the parser.
    begin_new_match: Vec<u32>,
    /// Controller reads at the ticks the parser closes a round, plus demo stop.
    scoreboard_closes: Vec<(u32, Vec<ScoreboardController>)>,
    /// Previous `m_iRoundWinStatus`, read on tick start like the parser.
    prev_win_status: i32,
    /// Tick of a `round_officially_ended` seen this parse. The close is read
    /// on tick end so the entity state matches the parser.
    official_end_tick: Option<u32>,
    /// Tick whose win-status edge was seen on tick start. Closed on tick end.
    synth_close_tick: Option<u32>,
    /// `(slot, steam id)` of controllers classified as bots at any tick.
    bot_rows: BTreeSet<(u32, u64)>,
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

fn gamerules_i32(ctx: &Context, name: &str) -> Option<i32> {
    let proxy = ctx.entities().get_by_class_name("CCSGameRulesProxy").ok()?;
    match proxy.get_property(name) {
        Ok(FieldValue::Signed32(value)) => Some(*value),
        Ok(FieldValue::Signed16(value)) => Some(i32::from(*value)),
        Ok(FieldValue::Signed8(value)) => Some(i32::from(*value)),
        Ok(FieldValue::Unsigned32(value)) => Some(*value as i32),
        Ok(FieldValue::Unsigned16(value)) => Some(i32::from(*value)),
        Ok(FieldValue::Unsigned8(value)) => Some(i32::from(*value)),
        _ => None,
    }
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
        if ge.name() == "begin_new_match" {
            let tick = ctx.tick();
            if self.begin_new_match.last().is_none_or(|seen| *seen != tick) {
                self.begin_new_match.push(tick);
            }
        }
        for (key, value) in ge.iter() {
            let Ok(text) = TryInto::<String>::try_into(value) else {
                continue;
            };
            if text.contains('\u{FFFD}') {
                self.lossy.push(LossyEventString {
                    event: ge.name().to_string(),
                    key: key.to_string(),
                    text,
                });
            }
        }
        if warmup_period(ctx) {
            return Ok(());
        }
        if ge.name() == "round_officially_ended" {
            self.official_end_tick = Some(ctx.tick());
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

    /// Same win-status edge as the parser: `on_tick_start` still sees the
    /// previous tick's rules, and the scoreboard is read on tick end.
    #[on_tick_start]
    fn on_tick_start(&mut self, ctx: &Context) -> ObserverResult {
        let tick = ctx.tick();
        if tick == u32::MAX || warmup_period(ctx) {
            return Ok(());
        }
        let win = gamerules_i32(ctx, "m_pGameRules.m_iRoundWinStatus").unwrap_or(0);
        if win != 0 && self.prev_win_status == 0 {
            self.synth_close_tick = Some(tick);
        }
        self.prev_win_status = win;
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
        note_scoreboard_presence(ctx, &mut self.bot_rows);
        if !warmup_period(ctx)
            && (self.synth_close_tick == Some(tick) || self.official_end_tick == Some(tick))
        {
            self.push_scoreboard_close(ctx, tick);
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

    /// Same entity state the parser reads in `Collector::on_stop`.
    #[on_stop]
    fn on_stop(&mut self, ctx: &Context) -> ObserverResult {
        let tick = ctx.tick();
        if tick == u32::MAX {
            return Ok(());
        }
        self.push_scoreboard_close(ctx, tick);
        if let Some((_, controllers)) = self.scoreboard_closes.last() {
            for controller in controllers {
                if controller.is_bot {
                    self.bot_rows.insert((controller.slot, controller.steam_id));
                }
            }
        }
        Ok(())
    }

    fn push_scoreboard_close(&mut self, ctx: &Context, tick: u32) {
        if tick == u32::MAX {
            return;
        }
        if self
            .scoreboard_closes
            .last()
            .is_some_and(|(seen, _)| *seen == tick)
        {
            return;
        }
        self.scoreboard_closes
            .push((tick, read_scoreboard_controllers(ctx)));
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
        ("1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem", 8, true),
        ("1-898c8041-ac25-4ab8-8a2b-c384318aac1c-1-1.dem", 8, true),
        ("1-b3ea81e1-103d-4877-83d1-e5bbf1bcb7eb-1-1.dem", 7, true),
        ("legacy-vs-spirit-m2-ancient.dem", 7, true),
        ("premier-d2.dem", 7, true),
        ("spirit-vs-dendele-m1-ancient.dem", 7, true),
        ("spirit-vs-furia-m1-ancient.dem", 9, true),
        ("spirit-vs-mouz-m3-ancient.dem", 8, true),
        ("spirit-vs-mouz-m4-nuke.dem", 8, true),
        ("1-b5045d4d-daaf-4ab6-82de-3c345a0e6930-1-1.dem", 8, false),
        ("bushido-wildcats-vs-illyrians-m1-anubis.dem", 7, false),
        ("fruju-vs-rooster-m1-inferno.dem", 7, false),
    ];
    assert_eq!(cases.len(), DEMO_EXPECTATIONS.len());
    let rss = usize::from(cfg!(target_os = "linux"));
    for (name, expected, rss_applies) in cases {
        let extra = if rss_applies { rss } else { 0 };
        assert_eq!(expected_check_count(name), expected + extra, "{name}");
        assert_eq!(demo_check_names(name).len(), expected + extra, "{name}");
        assert!(
            DEMO_EXPECTATIONS.iter().any(|row| row.name == name),
            "{name}"
        );
        assert_eq!(
            check_applies(name, CHECK_RSS),
            rss_applies && cfg!(target_os = "linux"),
            "{name} rss"
        );
    }
    assert_eq!(OPEN_FIRES.len(), 6);
    assert_eq!(DEMO_END_SMOKES.len(), 4);
    assert_eq!(GLOBAL_CHECK_COUNT, 6);
    assert_eq!(census_total(|row| row.without_expire), 106);
    assert_eq!(census_total(|row| row.ended_at_round_open), 102);
    assert_eq!(census_total(|row| row.ended_at_demo_end), 4);
    for row in DEMO_EXPECTATIONS {
        let Some(smoke) = row.smoke.as_ref() else {
            continue;
        };
        assert_eq!(
            smoke.ended_at_round_open + smoke.ended_at_demo_end,
            smoke.without_expire,
            "{}",
            row.label
        );
    }
    if cfg!(target_os = "linux") {
        assert_eq!(
            expected_check_count("premier-d2.dem"),
            8,
            "premier-d2 has no open fire; rss applies on linux"
        );
        assert_eq!(
            expected_check_count("spirit-vs-furia-m1-ancient.dem"),
            10,
            "furia has two open fires"
        );
        assert_eq!(
            expected_check_count("1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem"),
            9
        );
    }
    let faceit = DEMO_END_SMOKES
        .iter()
        .find(|row| row.demo == "1-0eb2df7f-68ad-4bae-b7c2-f123b8445559-1-1.dem");
    let faceit = faceit.unwrap_or_else(|| panic!("0eb2df7f demo-end smoke missing from the table"));
    assert_eq!(faceit.end, Some(230_008));
    assert_eq!(faceit.detonate, 228_691);
    let premier = DEMO_END_SMOKES
        .iter()
        .find(|row| row.demo == "premier-d2.dem");
    let premier =
        premier.unwrap_or_else(|| panic!("premier-d2 demo-end smoke missing from the table"));
    assert_eq!(premier.end, Some(83_030));
    assert_eq!(premier.detonate, 81_808);
    let inferno = DEMO_END_SMOKES
        .iter()
        .find(|row| row.demo == "fruju-vs-rooster-m1-inferno.dem");
    let inferno =
        inferno.unwrap_or_else(|| panic!("fruju inferno demo-end smoke missing from the table"));
    assert_eq!(inferno.detonate, 151_283);
    assert_eq!(inferno.end, None);
    let mirage = "1-b5045d4d-daaf-4ab6-82de-3c345a0e6930-1-1.dem";
    let mirage_end = DEMO_END_SMOKES.iter().find(|row| row.demo == mirage);
    let mirage_end =
        mirage_end.unwrap_or_else(|| panic!("mirage demo-end smoke missing from the table"));
    assert_eq!(mirage_end.detonate, 265_459);
    assert_eq!(mirage_end.end, None);
    let mirage_smoke = lookup_demo(mirage).and_then(|row| row.smoke.as_ref());
    let mirage_smoke = mirage_smoke.unwrap_or_else(|| panic!("mirage smoke census missing"));
    assert_eq!(mirage_smoke.smokes, 160);
    assert_eq!(mirage_smoke.with_expire, 152);
    assert_eq!(mirage_smoke.without_expire, 8);
    assert_eq!(mirage_smoke.ended_at_round_open, 7);
    assert_eq!(mirage_smoke.ended_at_demo_end, 1);
    assert!(check_applies(mirage, CHECK_SMOKE));
    assert!(check_applies(mirage, CHECK_DEMO_END));
    assert!(check_applies(mirage, CHECK_UTF8));
    assert!(check_applies(mirage, CHECK_ROUND_SCOREBOARD));
    assert!(
        lookup_demo(mirage).is_some_and(|row| row.no_bot_rows),
        "mirage 22-20 must reject separate bot scoreboard rows"
    );
    assert!(
        lookup_demo("fruju-vs-rooster-m1-inferno.dem").is_some_and(|row| row.no_bot_rows),
        "inferno FACEIT fruju-vs-rooster must reject separate bot scoreboard rows"
    );
    assert_eq!(
        DEMO_EXPECTATIONS
            .iter()
            .filter(|row| row.no_bot_rows)
            .count(),
        2
    );
    assert!(
        !MIRAGE_LOSSY_UTF8.is_empty(),
        "mirage lossy strings must be listed"
    );
    assert!(check_applies(
        "bushido-wildcats-vs-illyrians-m1-anubis.dem",
        CHECK_SMOKE
    ));
    assert!(check_applies(
        "fruju-vs-rooster-m1-inferno.dem",
        CHECK_SMOKE
    ));
    for fire in OPEN_FIRES {
        assert!(
            lookup_demo(fire.demo).is_some(),
            "open fire {} demo {} is not a manifest name",
            fire.entity,
            fire.demo
        );
    }
}

#[test]
fn assets_v2_checks_without_data_are_static_skips() {
    let mut report = FailureReport::default();
    close_demo(&mut report, MIRAGE_LOSSY_UTF8_DEMO, None, None, true);
    let smoke = report
        .logs
        .iter()
        .find(|row| row.demo == MIRAGE_LOSSY_UTF8_DEMO && row.check == CHECK_SMOKE)
        .unwrap_or_else(|| panic!("mirage smoke row missing"));
    assert_eq!(smoke.status, CheckStatus::Fail);
    assert_eq!(smoke.detail, "check did not run");
    let demo_end = report
        .logs
        .iter()
        .find(|row| row.demo == MIRAGE_LOSSY_UTF8_DEMO && row.check == CHECK_DEMO_END)
        .unwrap_or_else(|| panic!("mirage demo-end row missing"));
    assert_eq!(demo_end.status, CheckStatus::Fail);
    assert_eq!(demo_end.detail, "check did not run");
    if cfg!(target_os = "linux") {
        let rss = report
            .logs
            .iter()
            .find(|row| row.demo == MIRAGE_LOSSY_UTF8_DEMO && row.check == CHECK_RSS)
            .unwrap_or_else(|| panic!("mirage rss row missing"));
        assert_eq!(rss.status, CheckStatus::Skip);
        assert_eq!(rss.detail, "no rss limit in the static table");
    }
    let mut bushido = FailureReport::default();
    close_demo(
        &mut bushido,
        "bushido-wildcats-vs-illyrians-m1-anubis.dem",
        None,
        None,
        true,
    );
    let smoke = bushido
        .logs
        .iter()
        .find(|row| row.check == CHECK_SMOKE)
        .unwrap_or_else(|| panic!("bushido smoke row missing"));
    assert_eq!(smoke.status, CheckStatus::Fail);
    assert_eq!(smoke.detail, "check did not run");
}

#[test]
fn expectation_table_follows_manifest_order() {
    let path = common::repo_root().join("test-demos/manifest.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|err| panic!("could not read {}: {err}", path.display()));
    let manifest: serde_json::Value = serde_json::from_str(&text)
        .unwrap_or_else(|err| panic!("could not parse {}: {err}", path.display()));
    let files = manifest["files"]
        .as_array()
        .unwrap_or_else(|| panic!("manifest files is not a list"));
    let names: Vec<&str> = files
        .iter()
        .map(|file| {
            file["name"]
                .as_str()
                .unwrap_or_else(|| panic!("manifest name is not a string"))
        })
        .collect();
    let table: Vec<&str> = DEMO_EXPECTATIONS.iter().map(|row| row.name).collect();
    assert_eq!(names, table);
    for file in files {
        let tag = file["release_tag"].as_str().unwrap_or("");
        let name = file["name"].as_str().unwrap_or("");
        if name == MIRAGE_LOSSY_UTF8_DEMO
            || name == "bushido-wildcats-vs-illyrians-m1-anubis.dem"
            || name == "fruju-vs-rooster-m1-inferno.dem"
        {
            assert_eq!(tag, "assets-v2", "{name}");
        } else {
            assert_eq!(tag, "assets-v1", "{name}");
        }
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
    lookup_demo(name)
        .and_then(|row| row.rss_limit_kib)
        .unwrap_or(0)
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
            report.skip(demo, check, skip_reason(check));
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
fn per_demo_hash_file_round_trip_errors_do_not_panic() {
    let dir = std::env::temp_dir().join(format!("cs2-hash-round-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap_or_else(|err| panic!("could not create temp dir: {err}"));
    let sections = serde_json::from_str::<output_hash::SectionHashes>(
        r#"{
            "header":"h","players":"p","rounds":"r","grenades":"g",
            "shots":"s","kills":"k","hurts":"hu","blinds":"b","bomb_events":"be",
            "buy_events":"bu","controller_dump":"c","round_scoreboard":"rs","player_count":"pc","frame_count":"f",
            "ticks":"t","x":"x","y":"y","z":"z","yaw":"ya","health":"he","armor":"a",
            "flags":"fl","money":"m","equip":"eq","gear":"ge","primary":"pr",
            "secondary":"se","active":"ac","clip":"cl","reserve":"re"
        }"#,
    )
    .unwrap_or_else(|err| panic!("sample sections: {err}"));
    let demo = output_hash::DemoHash {
        name: "premier-d2.dem".to_string(),
        sections,
    };
    let path = dir.join("premier-d2.dem.json");
    let text = serde_json::to_string_pretty(&demo)
        .unwrap_or_else(|err| panic!("could not encode sample hash: {err}"));
    std::fs::write(&path, text).unwrap_or_else(|err| panic!("could not write sample hash: {err}"));
    let loaded = output_hash::read_demo_hash_file(&path)
        .unwrap_or_else(|err| panic!("readable hash file must not fail: {err}"));
    assert_eq!(loaded.name, "premier-d2.dem");
    let missing = output_hash::read_demo_hash_file(&dir.join("nope.json"));
    assert!(missing.is_err(), "a missing per-demo file is an error");
    std::fs::write(dir.join("bad.json"), b"[]")
        .unwrap_or_else(|err| panic!("could not write bad hash: {err}"));
    let bad = output_hash::read_demo_hash_file(&dir.join("bad.json"));
    assert!(bad.is_err(), "unparsable per-demo JSON is an error");
    let per_demo = stored_hash(&HashLoad::Checking(dir.clone()), "premier-d2.dem")
        .unwrap_or_else(|err| panic!("per-demo load: {err}"));
    assert!(per_demo.is_some());
    let gone = stored_hash(&HashLoad::Checking(dir.clone()), "missing.dem");
    let gone = match gone {
        Err(message) => message,
        Ok(_) => panic!("missing per-demo file must fail the hash check"),
    };
    assert!(gone.contains("missing.dem.json"), "{gone}");
    let mut report = FailureReport::default();
    let load = HashLoad::Checking(dir.clone());
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
        assert_eq!(skip, OPEN_FIRES.len() + 1, "open fires plus lossy-utf8");
        assert!(logs.iter().any(|row| {
            row.check == CHECK_UTF8
                && row.status == CheckStatus::Skip
                && row.detail == "no lossy-utf8 expectation in the static table"
        }));
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
