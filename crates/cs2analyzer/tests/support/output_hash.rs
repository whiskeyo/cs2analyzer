//! SHA-256 of the parser output the WASM boundary exposes.
//!
//! Moved out of `output_golden.rs` so the real-demo walk can hash the same
//! parse. One pretty-printed file per manifest demo under
//! `test-demos/output-hashes/<demo name>.json`. Stored files hold section
//! hashes only; `events` and the demo `sha256` are derived from those sections.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;

use cs2analyzer::Match;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const HASHES_DIR: &str = "test-demos/output-hashes";

#[allow(dead_code)]
pub const SECTION_ORDER: [&str; 29] = [
    "header",
    "players",
    "rounds",
    "grenades",
    "shots",
    "kills",
    "hurts",
    "blinds",
    "bomb_events",
    "buy_events",
    "controller_dump",
    "player_count",
    "frame_count",
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
#[serde(deny_unknown_fields)]
pub struct DemoHash {
    pub name: String,
    pub sections: SectionHashes,
}

/// Stored payload hashes. Field order is the file key order.
///
/// `events` and the demo `sha256` are computed for tests and the log line.
/// They are not fields here: see the module comment.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(deny_unknown_fields)]
pub struct SectionHashes {
    pub header: String,
    pub players: String,
    pub rounds: String,
    pub grenades: String,
    pub shots: String,
    pub kills: String,
    pub hurts: String,
    pub blinds: String,
    pub bomb_events: String,
    pub buy_events: String,
    pub controller_dump: String,
    pub player_count: String,
    pub frame_count: String,
    pub ticks: String,
    pub x: String,
    pub y: String,
    pub z: String,
    pub yaw: String,
    pub health: String,
    pub armor: String,
    pub flags: String,
    pub money: String,
    pub equip: String,
    pub gear: String,
    pub primary: String,
    pub secondary: String,
    pub active: String,
    pub clip: String,
    pub reserve: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ComputedOutput {
    /// Frames the events blob plus the tick columns. Not stored.
    pub sha256: String,
    /// Hash of the events blob. Not stored.
    pub events: String,
    pub sections: SectionHashes,
}

impl SectionHashes {
    pub fn values(&self) -> [(&str, &str); 29] {
        [
            ("header", self.header.as_str()),
            ("players", self.players.as_str()),
            ("rounds", self.rounds.as_str()),
            ("grenades", self.grenades.as_str()),
            ("shots", self.shots.as_str()),
            ("kills", self.kills.as_str()),
            ("hurts", self.hurts.as_str()),
            ("blinds", self.blinds.as_str()),
            ("bomb_events", self.bomb_events.as_str()),
            ("buy_events", self.buy_events.as_str()),
            ("controller_dump", self.controller_dump.as_str()),
            ("player_count", self.player_count.as_str()),
            ("frame_count", self.frame_count.as_str()),
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

pub fn hashes_dir() -> std::path::PathBuf {
    crate::common::repo_root().join(HASHES_DIR)
}

pub fn hash_file_name(demo_name: &str) -> String {
    format!("{demo_name}.json")
}

pub fn hash_file_path(demo_name: &str) -> std::path::PathBuf {
    hashes_dir().join(hash_file_name(demo_name))
}

pub fn demo_name_from_hash_file(file_name: &str) -> Option<&str> {
    let name = file_name.strip_suffix(".json")?;
    if name.is_empty() || name.contains('/') || name.contains('\\') {
        return None;
    }
    Some(name)
}

pub fn section_diff(demo_name: &str, expected: &SectionHashes, actual: &SectionHashes) -> String {
    let mut sections = String::new();
    for ((name, expected_hash), (_, actual_hash)) in
        expected.values().into_iter().zip(actual.values())
    {
        if expected_hash != actual_hash {
            sections.push_str(&format!(
                "  {name}\n    expected {expected_hash}\n    got {actual_hash}\n"
            ));
        }
    }
    if sections.is_empty() {
        return String::new();
    }
    let mut report = String::new();
    report.push_str(demo_name);
    report.push('\n');
    report.push_str(&sections);
    report
}

/// Missing files are demos we parsed. Orphans are hash files whose name is not
/// a manifest demo. `report_orphans` is off when `HASH_DEMOS` limits the check.
pub fn coverage_report(
    manifest: &[String],
    parsed: &[String],
    hash_files: &[String],
    report_orphans: bool,
) -> String {
    let mut report = String::new();
    for name in parsed {
        if !hash_files.iter().any(|file| file == name) {
            report.push_str(&format!(
                "{name}: missing hash file {HASHES_DIR}/{}\n",
                hash_file_name(name)
            ));
        }
    }
    if report_orphans {
        for name in hash_files {
            if !manifest.iter().any(|demo| demo == name) {
                report.push_str(&format!(
                    "{name}: orphan hash file {HASHES_DIR}/{} has no manifest demo\n",
                    hash_file_name(name)
                ));
            }
        }
    }
    report
}

pub fn hex_bytes(bytes: &[u8]) -> String {
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

fn digest_bytes(bytes: &[u8]) -> String {
    let mut section = Sha256::new();
    section.update(bytes);
    finalize_hex(section)
}

fn push_json(buf: &mut Vec<u8>, name: &str, value: &impl Serialize) -> String {
    let json = serde_json::to_string(value)
        .unwrap_or_else(|err| panic!("could not serialize {name}: {err}"));
    push_part(buf, name, json.as_bytes());
    digest_bytes(json.as_bytes())
}

fn push_text(buf: &mut Vec<u8>, name: &str, text: &str) -> String {
    push_part(buf, name, text.as_bytes());
    digest_bytes(text.as_bytes())
}

struct EventPieces {
    payload: Vec<u8>,
    header: String,
    players: String,
    rounds: String,
    grenades: String,
    shots: String,
    kills: String,
    hurts: String,
    blinds: String,
    bomb_events: String,
    buy_events: String,
    controller_dump: String,
    player_count: String,
    frame_count: String,
}

fn event_pieces(parsed: &Match) -> EventPieces {
    let mut buf = Vec::new();
    let header = push_json(&mut buf, "headerJson", &parsed.header);
    let players = push_json(&mut buf, "playersJson", &parsed.players);
    let rounds = push_json(&mut buf, "roundsJson", &parsed.rounds);
    let grenades = push_json(&mut buf, "grenadesJson", &parsed.grenades);
    let shots = push_json(&mut buf, "shotsJson", &parsed.shots);
    let kills = push_json(&mut buf, "killsJson", &parsed.kills);
    let hurts = push_json(&mut buf, "hurtsJson", &parsed.hurts);
    let blinds = push_json(&mut buf, "blindsJson", &parsed.blinds);
    let bomb_events = push_json(&mut buf, "bombEventsJson", &parsed.bomb_events);
    let buy_events = push_json(&mut buf, "buyEventsJson", &parsed.buy_events);
    let controller_dump = push_json(&mut buf, "controllerDumpJson", &parsed.controller_dump);
    let player_count = push_text(
        &mut buf,
        "playerCount",
        &parsed.ticks.player_count.to_string(),
    );
    let frame_count = push_text(
        &mut buf,
        "frameCount",
        &parsed.ticks.frame_count.to_string(),
    );
    EventPieces {
        payload: buf,
        header,
        players,
        rounds,
        grenades,
        shots,
        kills,
        hurts,
        blinds,
        bomb_events,
        buy_events,
        controller_dump,
        player_count,
        frame_count,
    }
}

#[allow(dead_code)]
pub fn events_payload(parsed: &Match) -> Vec<u8> {
    event_pieces(parsed).payload
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

pub fn hash_match(parsed: &Match) -> ComputedOutput {
    let mut overall = Sha256::new();
    let pieces = event_pieces(parsed);
    let ticks = &parsed.ticks;
    let events = push_payload(&mut overall, "events", &pieces.payload);
    let sections = SectionHashes {
        header: pieces.header,
        players: pieces.players,
        rounds: pieces.rounds,
        grenades: pieces.grenades,
        shots: pieces.shots,
        kills: pieces.kills,
        hurts: pieces.hurts,
        blinds: pieces.blinds,
        bomb_events: pieces.bomb_events,
        buy_events: pieces.buy_events,
        controller_dump: pieces.controller_dump,
        player_count: pieces.player_count,
        frame_count: pieces.frame_count,
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
    ComputedOutput {
        sha256: finalize_hex(overall),
        events,
        sections,
    }
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
///
/// The real-demo walk no longer uses this. Per-demo RSS is `VmHWM` after
/// writing `5` to `/proc/self/clear_refs`, because this peak only grows.
#[allow(dead_code)]
pub struct RssWatch {
    stop: Arc<AtomicBool>,
    peak: Arc<AtomicU64>,
    handle: Option<std::thread::JoinHandle<()>>,
}

#[allow(dead_code)]
impl RssWatch {
    pub fn start() -> Self {
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

    pub fn peak_kib(&mut self) -> Option<u64> {
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

pub fn demo_name(path: &std::path::Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("demo")
        .to_string()
}

fn encode_hash_file(demo: &DemoHash) -> String {
    let mut text = serde_json::to_string_pretty(demo)
        .unwrap_or_else(|err| panic!("could not encode hash file: {err}"));
    text.push('\n');
    text
}

pub fn write_demo_hash(demo: &DemoHash) {
    let path = hash_file_path(&demo.name);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .unwrap_or_else(|err| panic!("could not create {}: {err}", parent.display()));
    }
    std::fs::write(&path, encode_hash_file(demo))
        .unwrap_or_else(|err| panic!("could not write {}: {err}", path.display()));
}

/// Read one `test-demos/output-hashes/<demo>.json`.
///
/// A missing, unreadable, or unparsable file is `Err` with the path in the
/// message. Callers record that string and keep walking the other demos.
pub fn read_demo_hash_file(path: &std::path::Path) -> Result<DemoHash, String> {
    let text = std::fs::read_to_string(path)
        .map_err(|err| format!("missing hash file {} ({err})", path.display()))?;
    serde_json::from_str(&text).map_err(|err| format!("could not parse {}: {err}", path.display()))
}

pub fn list_hash_file_demos(dir: &std::path::Path) -> Vec<String> {
    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Vec::new(),
        Err(err) => panic!("could not read {}: {err}", dir.display()),
    };
    let mut names = Vec::new();
    for entry in entries {
        let entry = entry.unwrap_or_else(|err| panic!("could not read {}: {err}", dir.display()));
        let file_type = entry
            .file_type()
            .unwrap_or_else(|err| panic!("could not stat {}: {err}", entry.path().display()));
        if !file_type.is_file() {
            continue;
        }
        let file_name = entry.file_name();
        let Some(file_name) = file_name.to_str() else {
            continue;
        };
        let Some(demo_name) = demo_name_from_hash_file(file_name) else {
            continue;
        };
        names.push(demo_name.to_string());
    }
    names.sort();
    names
}

pub fn delete_orphan_hash_files(dir: &std::path::Path, manifest: &[String]) {
    for demo_name in list_hash_file_demos(dir) {
        if manifest.iter().any(|name| name == &demo_name) {
            continue;
        }
        let path = dir.join(hash_file_name(&demo_name));
        std::fs::remove_file(&path)
            .unwrap_or_else(|err| panic!("could not remove {}: {err}", path.display()));
        eprintln!("removed orphan {}", path.display());
    }
}

/// Hash one parsed demo. The real-demo log prints the sha256 on the `output-hash` line.
pub fn log_parsed_demo(parsed: &Match, _rss_kib: Option<u64>) -> ComputedOutput {
    hash_match(parsed)
}
