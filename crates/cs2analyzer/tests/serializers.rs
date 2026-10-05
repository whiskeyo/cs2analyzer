//! Snapshot flattened serializer fields from the release demos.
//!
//! `Serializer` and `Field` in source2-demo 0.5.8 are `pub(crate)`, and
//! `Context::game_build()` only parses Dota/Deadlock directory prefixes, so a
//! CS2 replay reports build 0. The public protobuf types still carry the
//! metadata: `CDemoFileHeader::{build_num, patch_version}` and
//! `ProtoFlattenedSerializerFieldT` (`var_type`, `bit_count`, `var_encoder`,
//! `low_value`, `high_value`, `encode_flags`). `DemSendTables` wraps that
//! message in a varint length prefix, which is the framing the parser uses.

#[path = "common/mod.rs"]
mod common;

use std::collections::{BTreeMap, BTreeSet};
use std::fs::File;
use std::path::Path;

use source2_demo::prelude::*;
use source2_demo::proto::{CDemoFileHeader, CDemoSendTables, CSvcMsgFlattenedSerializer, Message};

const SNAPSHOT_HEADER: &str = "\
# Flattened serializer fields for the demos in test-demos/manifest.json.
# demo <name> build_num=<CDemoFileHeader.build_num> patch_version=<CDemoFileHeader.patch_version>
# field <class> <field> <var_type> <bit_count> <encoder> <low_value> <high_value> <encode_flags>
# \"-\" means the protobuf omitted that value. Context::game_build() is 0 on the cs2 feature.
# Regenerate: UPDATE_SNAPSHOT=1 cargo test -p cs2analyzer --test serializers -- --ignored
";

#[derive(Default)]
struct Capture {
    saw_header: bool,
    build: Option<i32>,
    patch: Option<i32>,
    lines: BTreeSet<String>,
    error: Option<String>,
}

impl Observer for Capture {
    fn interests(&self) -> Interests {
        Interests::DEMO_MESSAGE
    }

    fn on_demo_command(
        &mut self,
        _ctx: &Context,
        msg_type: EDemoCommands,
        msg: &[u8],
    ) -> ObserverResult {
        if let Err(err) = self.ingest(msg_type, msg) {
            self.error = Some(err);
        }
        Ok(())
    }
}

impl Capture {
    fn ingest(&mut self, msg_type: EDemoCommands, msg: &[u8]) -> Result<(), String> {
        if msg_type == EDemoCommands::DemFileHeader {
            let header = CDemoFileHeader::decode(msg).map_err(|err| err.to_string())?;
            self.saw_header = true;
            self.build = header.build_num;
            self.patch = header.patch_version;
        }
        if msg_type == EDemoCommands::DemSendTables {
            let tables = CDemoSendTables::decode(msg).map_err(|err| err.to_string())?;
            let flattened = decode_flattened_serializer(&tables)?;
            self.lines.extend(field_lines(&flattened)?);
        }
        Ok(())
    }
}

fn read_var_u32(data: &[u8]) -> Result<(u32, usize), String> {
    let mut value: u32 = 0;
    let mut shift: u32 = 0;
    for (index, byte) in data.iter().copied().enumerate() {
        value |= u32::from(byte & 0x7F) << shift;
        shift += 7;
        if byte & 0x80 == 0 || shift == 35 {
            return Ok((value, index + 1));
        }
    }
    Err("truncated varint length".to_string())
}

fn decode_flattened_serializer(
    tables: &CDemoSendTables,
) -> Result<CSvcMsgFlattenedSerializer, String> {
    let data = tables.data.as_deref().unwrap_or_default();
    let (len, offset) = read_var_u32(data)?;
    let len = usize::try_from(len).map_err(|_| "serializer length does not fit".to_string())?;
    let rest = data
        .get(offset..)
        .ok_or_else(|| "serializer length prefix overruns the buffer".to_string())?;
    if rest.len() < len {
        return Err(format!(
            "serializer payload is {len} bytes but only {} remain",
            rest.len()
        ));
    }
    CSvcMsgFlattenedSerializer::decode(&rest[..len]).map_err(|err| err.to_string())
}

fn field_lines(flattened: &CSvcMsgFlattenedSerializer) -> Result<BTreeSet<String>, String> {
    let symbols = &flattened.symbols;
    let mut lines = BTreeSet::new();
    for serializer in &flattened.serializers {
        let class_name = required_symbol(symbols, serializer.serializer_name_sym, "serializer")?;
        for index in &serializer.fields_index {
            let index = usize::try_from(*index)
                .map_err(|_| format!("{class_name} field index is negative"))?;
            let field = flattened
                .fields
                .get(index)
                .ok_or_else(|| format!("{class_name} field index {index} is out of range"))?;
            let var_name = required_symbol(symbols, field.var_name_sym, "field")?;
            let var_type = required_symbol(symbols, field.var_type_sym, "var type")?;
            let send_node = optional_symbol(symbols, field.send_node_sym)?;
            let encoder = optional_symbol(symbols, field.var_encoder_sym)?;
            let field_name = qualified_field_name(&send_node, &var_name);
            lines.insert(format!(
                "field\t{class_name}\t{field_name}\t{}\t{}\t{}\t{}\t{}\t{}",
                cell(&var_type),
                opt_i32(field.bit_count),
                cell(&encoder),
                opt_f32(field.low_value),
                opt_f32(field.high_value),
                opt_i32(field.encode_flags),
            ));
        }
    }
    Ok(lines)
}

fn required_symbol(symbols: &[String], index: Option<i32>, what: &str) -> Result<String, String> {
    let Some(index) = index else {
        return Err(format!("{what} symbol is missing"));
    };
    let index = usize::try_from(index).map_err(|_| format!("{what} symbol index is negative"))?;
    symbols
        .get(index)
        .filter(|symbol| !symbol.is_empty())
        .cloned()
        .ok_or_else(|| format!("{what} symbol {index} is missing"))
}

fn optional_symbol(symbols: &[String], index: Option<i32>) -> Result<String, String> {
    let Some(index) = index else {
        return Ok(String::new());
    };
    let index = usize::try_from(index).map_err(|_| "symbol index is negative".to_string())?;
    symbols
        .get(index)
        .cloned()
        .ok_or_else(|| format!("symbol {index} is out of range"))
}

fn qualified_field_name(send_node: &str, var_name: &str) -> String {
    if send_node.is_empty() || send_node == "(root)" {
        var_name.to_string()
    } else {
        format!("{send_node}.{var_name}")
    }
}

fn cell(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        "-".to_string()
    } else {
        trimmed.replace(['\t', '\n', '\r'], " ")
    }
}

fn opt_i32(value: Option<i32>) -> String {
    value.map_or_else(|| "-".to_string(), |value| value.to_string())
}

fn opt_f32(value: Option<f32>) -> String {
    value.map_or_else(|| "-".to_string(), format_f32)
}

fn format_f32(value: f32) -> String {
    if value.is_nan() {
        return "nan".to_string();
    }
    if value.is_infinite() {
        return if value.is_sign_negative() {
            "-inf".to_string()
        } else {
            "inf".to_string()
        };
    }
    if value == 0.0 {
        return "0".to_string();
    }
    format!("{value}")
}

fn number_cell(value: Option<i32>) -> String {
    opt_i32(value)
}

struct DemoDump {
    name: String,
    build: String,
    patch: String,
    lines: BTreeSet<String>,
}

fn dump_demo(path: &Path) -> DemoDump {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("demo")
        .to_string();
    let file = File::open(path).unwrap_or_else(|err| panic!("could not open {name}: {err}"));
    let mut parser =
        Parser::from_reader(file).unwrap_or_else(|err| panic!("{name} is not a demo file: {err}"));
    let capture = parser.add_observer(Capture::default());
    parser
        .run_to_tick(0)
        .unwrap_or_else(|err| panic!("{name} failed while reading serializers: {err}"));
    let capture = capture.borrow();
    if let Some(err) = &capture.error {
        panic!("{name}: {err}");
    }
    if !capture.saw_header {
        panic!("{name}: DemFileHeader was not in the demo prologue");
    }
    if capture.lines.is_empty() {
        panic!("{name}: DemSendTables had no serializer fields");
    }
    DemoDump {
        name,
        build: number_cell(capture.build),
        patch: number_cell(capture.patch),
        lines: capture.lines.clone(),
    }
}

fn snapshot_text(demos: &[DemoDump]) -> String {
    let mut text = String::from(SNAPSHOT_HEADER);
    for demo in demos {
        text.push_str(&format!(
            "demo\t{}\tbuild_num={}\tpatch_version={}\n",
            demo.name, demo.build, demo.patch
        ));
    }
    let mut fields = BTreeSet::new();
    for demo in demos {
        fields.extend(demo.lines.iter().cloned());
    }
    for line in fields {
        text.push_str(&line);
        text.push('\n');
    }
    text
}

fn introduced_by(demos: &[DemoDump]) -> BTreeMap<String, String> {
    let mut owners: BTreeMap<String, BTreeSet<String>> = BTreeMap::new();
    for demo in demos {
        let label = format!(
            "build_num {} patch_version {} ({})",
            demo.build, demo.patch, demo.name
        );
        for line in &demo.lines {
            owners
                .entry(line.clone())
                .or_default()
                .insert(label.clone());
        }
    }
    owners
        .into_iter()
        .map(|(line, labels)| (line, labels.into_iter().collect::<Vec<_>>().join(", ")))
        .collect()
}

fn field_key(line: &str) -> Option<(&str, &str)> {
    let mut parts = line.split('\t');
    if parts.next() != Some("field") {
        return None;
    }
    Some((parts.next()?, parts.next()?))
}

fn compare_snapshot(expected: &str, actual: &str, owners: &BTreeMap<String, String>) -> String {
    let expected_fields = lines_with_prefix(expected, "field\t");
    let actual_fields = lines_with_prefix(actual, "field\t");
    let expected_demos = lines_with_prefix(expected, "demo\t");
    let actual_demos = lines_with_prefix(actual, "demo\t");

    let mut report = String::new();
    append_demo_diff(&mut report, &expected_demos, &actual_demos);
    append_field_diff(&mut report, &expected_fields, &actual_fields, owners);
    report
}

fn lines_with_prefix(text: &str, prefix: &str) -> BTreeSet<String> {
    text.lines()
        .filter(|line| line.starts_with(prefix))
        .map(ToOwned::to_owned)
        .collect()
}

fn append_demo_diff(report: &mut String, expected: &BTreeSet<String>, actual: &BTreeSet<String>) {
    for line in expected.difference(actual) {
        report.push_str(&format!("- {line}\n"));
    }
    for line in actual.difference(expected) {
        report.push_str(&format!("+ {line}\n"));
    }
}

fn append_field_diff(
    report: &mut String,
    expected: &BTreeSet<String>,
    actual: &BTreeSet<String>,
    owners: &BTreeMap<String, String>,
) {
    let mut expected_by_key: BTreeMap<(&str, &str), Vec<&str>> = BTreeMap::new();
    let mut actual_by_key: BTreeMap<(&str, &str), Vec<&str>> = BTreeMap::new();
    for line in expected {
        if let Some(key) = field_key(line) {
            expected_by_key.entry(key).or_default().push(line);
        }
    }
    for line in actual {
        if let Some(key) = field_key(line) {
            actual_by_key.entry(key).or_default().push(line);
        }
    }
    let keys: BTreeSet<_> = expected_by_key
        .keys()
        .chain(actual_by_key.keys())
        .copied()
        .collect();
    for key in keys {
        let old = expected_by_key.get(&key).map(Vec::as_slice).unwrap_or(&[]);
        let new = actual_by_key.get(&key).map(Vec::as_slice).unwrap_or(&[]);
        if old == new {
            continue;
        }
        let (class_name, field_name) = key;
        let kind = if old.is_empty() {
            "new combination"
        } else if new.is_empty() {
            "removed combination"
        } else {
            "changed combination"
        };
        let builds = new
            .iter()
            .filter_map(|line| owners.get(*line))
            .cloned()
            .collect::<BTreeSet<_>>()
            .into_iter()
            .collect::<Vec<_>>()
            .join("; ");
        if builds.is_empty() {
            report.push_str(&format!("{kind} {class_name}.{field_name}\n"));
        } else {
            report.push_str(&format!(
                "{kind} {class_name}.{field_name} introduced by {builds}\n"
            ));
        }
        for line in old {
            report.push_str(&format!("- {line}\n"));
        }
        for line in new {
            report.push_str(&format!("+ {line}\n"));
        }
    }
}

fn snapshot_path() -> std::path::PathBuf {
    common::repo_root().join("test-demos/serializers.snap.txt")
}

#[test]
fn snapshot_diff_names_the_build_that_changed_a_field() {
    let expected = "\
demo\told.dem\tbuild_num=1\tpatch_version=2
field\tPlayer\tm_iHealth\tint32\t-\t-\t-\t-\t-
";
    let actual = "\
demo\told.dem\tbuild_num=9\tpatch_version=10
field\tPlayer\tm_iHealth\tint32\t8\t-\t-\t-\t-
";
    let mut owners = BTreeMap::new();
    owners.insert(
        "field\tPlayer\tm_iHealth\tint32\t8\t-\t-\t-\t-".to_string(),
        "build_num 9 patch_version 10 (old.dem)".to_string(),
    );
    let report = compare_snapshot(expected, actual, &owners);
    assert!(
        report.contains("changed combination Player.m_iHealth introduced by build_num 9 patch_version 10 (old.dem)"),
        "{report}"
    );
    assert!(
        report.contains("- field\tPlayer\tm_iHealth\tint32\t-\t-\t-\t-\t-"),
        "{report}"
    );
    assert!(
        report.contains("+ field\tPlayer\tm_iHealth\tint32\t8\t-\t-\t-\t-"),
        "{report}"
    );
    assert!(
        report.contains("- demo\told.dem\tbuild_num=1\tpatch_version=2"),
        "{report}"
    );
    assert!(
        report.contains("+ demo\told.dem\tbuild_num=9\tpatch_version=10"),
        "{report}"
    );
}

#[test]
fn read_var_u32_matches_the_send_table_length_prefix() {
    assert_eq!(read_var_u32(&[0x00]).unwrap(), (0, 1));
    assert_eq!(read_var_u32(&[0x7f]).unwrap(), (127, 1));
    assert_eq!(read_var_u32(&[0x80, 0x01]).unwrap(), (128, 2));
    assert!(read_var_u32(&[0x80]).is_err());
}

#[test]
#[ignore = "needs ./scripts/run.sh --fetch-demos"]
fn serializers_match_snapshot() {
    let demos: Vec<DemoDump> = common::require_demo_files()
        .iter()
        .map(|path| dump_demo(path))
        .collect();
    let actual = snapshot_text(&demos);
    let path = snapshot_path();
    if std::env::var("UPDATE_SNAPSHOT").ok().as_deref() == Some("1") {
        std::fs::write(&path, &actual)
            .unwrap_or_else(|err| panic!("could not write {}: {err}", path.display()));
        eprintln!("updated {}", path.display());
        return;
    }
    let expected = std::fs::read_to_string(&path).unwrap_or_else(|err| {
        panic!(
            "could not read {} ({err}); set UPDATE_SNAPSHOT=1 to create it",
            path.display()
        );
    });
    let report = compare_snapshot(&expected, &actual, &introduced_by(&demos));
    assert!(
        report.is_empty(),
        "serializer snapshot mismatch in {}\n{report}set UPDATE_SNAPSHOT=1 to regenerate",
        path.display()
    );
}
