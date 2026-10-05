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
//! same way. Section hashes cover the payload only, so a mismatch names the
//! events blob or the tick column that moved.
//!
//! `cargo test` skips the demo run. Regenerate with
//! `UPDATE_SNAPSHOT=1 cargo test --release -p cs2analyzer --test output_golden -- --ignored`.

#[path = "common/mod.rs"]
mod common;

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use cs2analyzer::{parse_demo, Match, ParseOptions, TickBuffer};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

const SECTION_ORDER: [&str; 17] = [
    "events",
    "ticks",
    "x",
    "y",
    "z",
    "yaw",
    "health",
    "armor",
    "flags",
    "money",
    "equip",
    "gear",
    "primary",
    "secondary",
    "active",
    "clip",
    "reserve",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct OutputHashes {
    demos: Vec<DemoHash>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct DemoHash {
    name: String,
    sha256: String,
    sections: SectionHashes,
}

/// Payload hashes. Field order is the WASM boundary order.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct SectionHashes {
    events: String,
    ticks: String,
    x: String,
    y: String,
    z: String,
    yaw: String,
    health: String,
    armor: String,
    flags: String,
    money: String,
    equip: String,
    gear: String,
    primary: String,
    secondary: String,
    active: String,
    clip: String,
    reserve: String,
}

impl SectionHashes {
    fn values(&self) -> [(&str, &str); 17] {
        [
            ("events", self.events.as_str()),
            ("ticks", self.ticks.as_str()),
            ("x", self.x.as_str()),
            ("y", self.y.as_str()),
            ("z", self.z.as_str()),
            ("yaw", self.yaw.as_str()),
            ("health", self.health.as_str()),
            ("armor", self.armor.as_str()),
            ("flags", self.flags.as_str()),
            ("money", self.money.as_str()),
            ("equip", self.equip.as_str()),
            ("gear", self.gear.as_str()),
            ("primary", self.primary.as_str()),
            ("secondary", self.secondary.as_str()),
            ("active", self.active.as_str()),
            ("clip", self.clip.as_str()),
            ("reserve", self.reserve.as_str()),
        ]
    }
}

fn hashes_path() -> std::path::PathBuf {
    common::repo_root().join("test-demos/output-hashes.json")
}

fn hex_bytes(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        out.push(HEX[(byte >> 4) as usize] as char);
        out.push(HEX[(byte & 0x0f) as usize] as char);
    }
    out
}

fn finalize_hex(hash: Sha256) -> String {
    hex_bytes(&hash.finalize())
}

fn push_part(buf: &mut Vec<u8>, name: &str, bytes: &[u8]) {
    buf.extend_from_slice(name.as_bytes());
    buf.push(b'\n');
    buf.extend_from_slice(bytes.len().to_string().as_bytes());
    buf.push(b'\n');
    buf.extend_from_slice(bytes);
}

fn push_json(buf: &mut Vec<u8>, name: &str, value: &impl Serialize) {
    let json = serde_json::to_string(value)
        .unwrap_or_else(|err| panic!("could not serialize {name}: {err}"));
    push_part(buf, name, json.as_bytes());
}

/// Non-column WASM getters. `stats` is not one of them.
fn events_payload(parsed: &Match) -> Vec<u8> {
    let mut buf = Vec::new();
    push_json(&mut buf, "headerJson", &parsed.header);
    push_json(&mut buf, "playersJson", &parsed.players);
    push_json(&mut buf, "roundsJson", &parsed.rounds);
    push_json(&mut buf, "grenadesJson", &parsed.grenades);
    push_json(&mut buf, "shotsJson", &parsed.shots);
    push_json(&mut buf, "killsJson", &parsed.kills);
    push_json(&mut buf, "hurtsJson", &parsed.hurts);
    push_json(&mut buf, "blindsJson", &parsed.blinds);
    push_json(&mut buf, "bombEventsJson", &parsed.bomb_events);
    push_json(&mut buf, "buyEventsJson", &parsed.buy_events);
    push_json(&mut buf, "controllerDumpJson", &parsed.controller_dump);
    push_part(
        &mut buf,
        "playerCount",
        parsed.ticks.player_count.to_string().as_bytes(),
    );
    push_part(
        &mut buf,
        "frameCount",
        parsed.ticks.frame_count.to_string().as_bytes(),
    );
    buf
}

fn push_payload(overall: &mut Sha256, name: &str, payload: &[u8]) -> String {
    let mut section = Sha256::new();
    section.update(payload);
    let digest = finalize_hex(section);
    overall.update(name.as_bytes());
    overall.update(b"\n");
    overall.update(payload.len().to_string().as_bytes());
    overall.update(b"\n");
    overall.update(payload);
    digest
}

fn push_encoded<T, const N: usize>(
    overall: &mut Sha256,
    name: &str,
    data: &[T],
    encode: impl Fn(&T) -> [u8; N],
) -> String {
    let byte_len = data
        .len()
        .checked_mul(N)
        .unwrap_or_else(|| panic!("{name} byte length overflows"));
    let mut section = Sha256::new();
    for item in data {
        section.update(encode(item));
    }
    let digest = finalize_hex(section);
    overall.update(name.as_bytes());
    overall.update(b"\n");
    overall.update(byte_len.to_string().as_bytes());
    overall.update(b"\n");
    for item in data {
        overall.update(encode(item));
    }
    digest
}

fn hash_match(parsed: &Match) -> (String, SectionHashes) {
    let mut overall = Sha256::new();
    let events = events_payload(parsed);
    let ticks = &parsed.ticks;
    let sections = SectionHashes {
        events: push_payload(&mut overall, "events", &events),
        ticks: push_encoded(&mut overall, "ticks", &ticks.ticks, |value| {
            value.to_le_bytes()
        }),
        x: push_encoded(&mut overall, "x", &ticks.x, |value| value.to_le_bytes()),
        y: push_encoded(&mut overall, "y", &ticks.y, |value| value.to_le_bytes()),
        z: push_encoded(&mut overall, "z", &ticks.z, |value| value.to_le_bytes()),
        yaw: push_encoded(&mut overall, "yaw", &ticks.yaw, |value| value.to_le_bytes()),
        health: push_payload(&mut overall, "health", &ticks.health),
        armor: push_payload(&mut overall, "armor", &ticks.armor),
        flags: push_payload(&mut overall, "flags", &ticks.flags),
        money: push_encoded(&mut overall, "money", &ticks.money, |value| {
            value.to_le_bytes()
        }),
        equip: push_encoded(&mut overall, "equip", &ticks.equip, |value| {
            value.to_le_bytes()
        }),
        gear: push_encoded(&mut overall, "gear", &ticks.gear, |value| {
            value.to_le_bytes()
        }),
        primary: push_payload(&mut overall, "primary", &ticks.primary),
        secondary: push_payload(&mut overall, "secondary", &ticks.secondary),
        active: push_payload(&mut overall, "active", &ticks.active),
        clip: push_payload(&mut overall, "clip", &ticks.clip),
        reserve: push_encoded(&mut overall, "reserve", &ticks.reserve, |value| {
            value.to_le_bytes()
        }),
    };
    (finalize_hex(overall), sections)
}

fn diff_report(expected: &OutputHashes, actual: &OutputHashes) -> String {
    let mut report = String::new();
    let mut seen = std::collections::BTreeSet::new();
    for demo in &actual.demos {
        seen.insert(demo.name.as_str());
        let Some(prior) = expected.demos.iter().find(|row| row.name == demo.name) else {
            report.push_str(&format!("{}: missing from output-hashes.json\n", demo.name));
            continue;
        };
        let mut sections = String::new();
        for ((name, expected_hash), (_, actual_hash)) in prior
            .sections
            .values()
            .into_iter()
            .zip(demo.sections.values())
        {
            if expected_hash != actual_hash {
                sections.push_str(&format!(
                    "  {name}\n    expected {expected_hash}\n    got {actual_hash}\n"
                ));
            }
        }
        if sections.is_empty() && prior.sha256 != demo.sha256 {
            sections.push_str(&format!(
                "  sha256\n    expected {}\n    got {}\n",
                prior.sha256, demo.sha256
            ));
        }
        if !sections.is_empty() {
            report.push_str(&demo.name);
            report.push('\n');
            report.push_str(&sections);
        }
    }
    for demo in &expected.demos {
        if !seen.contains(demo.name.as_str()) {
            report.push_str(&format!(
                "{}: in output-hashes.json but not parsed\n",
                demo.name
            ));
        }
    }
    report
}

fn vm_rss_kib() -> Option<u64> {
    let text = std::fs::read_to_string("/proc/self/status").ok()?;
    for line in text.lines() {
        let Some(rest) = line.strip_prefix("VmRSS:") else {
            continue;
        };
        let kib = rest.split_whitespace().next()?;
        return kib.parse().ok();
    }
    None
}

/// Samples `VmRSS` while a demo is parsed. Informational; missing `/proc` yields `None`.
struct RssWatch {
    stop: Arc<AtomicBool>,
    peak: Arc<AtomicU64>,
    handle: Option<std::thread::JoinHandle<()>>,
}

impl RssWatch {
    fn start() -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let peak = Arc::new(AtomicU64::new(vm_rss_kib().unwrap_or(0)));
        let stop_bg = Arc::clone(&stop);
        let peak_bg = Arc::clone(&peak);
        let handle = std::thread::spawn(move || {
            while !stop_bg.load(Ordering::Relaxed) {
                if let Some(rss) = vm_rss_kib() {
                    peak_bg.fetch_max(rss, Ordering::Relaxed);
                }
                std::thread::sleep(Duration::from_millis(20));
            }
        });
        Self {
            stop,
            peak,
            handle: Some(handle),
        }
    }

    fn peak_kib(&mut self) -> Option<u64> {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
        if let Some(rss) = vm_rss_kib() {
            self.peak.fetch_max(rss, Ordering::Relaxed);
        }
        let peak = self.peak.load(Ordering::Relaxed);
        if peak == 0 {
            None
        } else {
            Some(peak)
        }
    }
}

impl Drop for RssWatch {
    fn drop(&mut self) {
        let _ = self.peak_kib();
    }
}

fn demo_name(path: &std::path::Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("demo")
        .to_string()
}

fn write_hashes(path: &std::path::Path, hashes: &OutputHashes) {
    let mut text = serde_json::to_string_pretty(hashes)
        .unwrap_or_else(|err| panic!("could not encode {}: {err}", path.display()));
    text.push('\n');
    std::fs::write(path, text)
        .unwrap_or_else(|err| panic!("could not write {}: {err}", path.display()));
}

fn read_hashes(path: &std::path::Path) -> OutputHashes {
    let text = std::fs::read_to_string(path).unwrap_or_else(|err| {
        panic!(
            "could not read {} ({err}); set UPDATE_SNAPSHOT=1 to create it",
            path.display()
        );
    });
    serde_json::from_str(&text)
        .unwrap_or_else(|err| panic!("could not parse {}: {err}", path.display()))
}

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
    assert_ne!(sections.yaw, changed_sections.yaw);
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

fn demo_hash(name: &str, sha256: &str, events: &str, x: &str) -> DemoHash {
    DemoHash {
        name: name.to_string(),
        sha256: sha256.to_string(),
        sections: SectionHashes {
            events: events.to_string(),
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

#[test]
#[ignore = "needs ./scripts/run.sh --fetch-demos"]
fn output_matches_wasm_boundary_hashes() {
    let mut demos = Vec::new();
    for path in common::require_demo_files() {
        let name = demo_name(&path);
        let bytes =
            std::fs::read(&path).unwrap_or_else(|err| panic!("could not read {name}: {err}"));
        let mut watch = RssWatch::start();
        let parsed = parse_demo(&bytes, ParseOptions::default())
            .unwrap_or_else(|err| panic!("{name} failed to parse: {err}"));
        let (sha256, sections) = hash_match(&parsed);
        let rss = watch.peak_kib();
        drop(parsed);
        match rss {
            Some(kib) => eprintln!("output-golden {name} sha256={sha256} rss_kib={kib}"),
            None => eprintln!("output-golden {name} sha256={sha256} rss_kib=n/a"),
        }
        demos.push(DemoHash {
            name,
            sha256,
            sections,
        });
    }
    let actual = OutputHashes { demos };
    let path = hashes_path();
    if std::env::var("UPDATE_SNAPSHOT").ok().as_deref() == Some("1") {
        write_hashes(&path, &actual);
        eprintln!("updated {}", path.display());
        return;
    }
    let expected = read_hashes(&path);
    let report = diff_report(&expected, &actual);
    assert!(
        report.is_empty(),
        "WASM output hash mismatch in {}\n{report}set UPDATE_SNAPSHOT=1 to regenerate",
        path.display()
    );
}
