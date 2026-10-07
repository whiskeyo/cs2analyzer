//! Paths for ignored tests that read `test-demos/`.

use serde::Deserialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Deserialize)]
struct Manifest {
    files: Vec<ManifestFile>,
}

#[derive(Debug, Deserialize)]
struct ManifestFile {
    name: String,
}

pub fn repo_root() -> PathBuf {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../..");
    root.canonicalize()
        .unwrap_or_else(|err| panic!("could not resolve {}: {err}", root.display()))
}

fn manifest_names(root: &Path) -> Vec<String> {
    let path = root.join("test-demos/manifest.json");
    let text = std::fs::read_to_string(&path)
        .unwrap_or_else(|err| panic!("could not read {}: {err}", path.display()));
    let manifest: Manifest = serde_json::from_str(&text)
        .unwrap_or_else(|err| panic!("could not parse {}: {err}", path.display()));
    if manifest.files.is_empty() {
        panic!("{} has no files", path.display());
    }
    manifest.files.into_iter().map(|file| file.name).collect()
}

/// True when this test process was started with `--ignored` or `--include-ignored`.
pub fn running_ignored_tests() -> bool {
    std::env::args().any(|arg| arg == "--ignored" || arg == "--include-ignored")
}

/// `cargo test` without `--ignored` never reaches the download. That path stays
/// a skip. `--ignored` with no files is a failed run: the message must not
/// start with `skip:`, or CI treats a missing download as a pass.
pub fn demos_unavailable_message(dir: &Path, running_ignored: bool) -> String {
    if running_ignored {
        format!(
            "release demos are missing: {} has none of the manifest files. Run ./scripts/run.sh --fetch-demos before cargo test -- --ignored",
            dir.display()
        )
    } else {
        format!(
            "skip: {} is missing or has none of the manifest demos; run ./scripts/run.sh --fetch-demos",
            dir.display()
        )
    }
}

/// Every manifest demo on disk, in manifest order.
///
/// A missing or empty download directory fails a `--ignored` run. Plain
/// `cargo test` skips these tests via `#[ignore]` before this is called.
/// `HASH_DEMOS` is not read here: it may narrow only the hash check, and the
/// real-demo walk rejects it when `CI` is set.
pub fn require_demo_files() -> Vec<PathBuf> {
    let root = repo_root();
    let dir = root.join("test-demos/files");
    let names = manifest_names(&root);
    let present: Vec<&String> = names
        .iter()
        .filter(|name| dir.join(name).is_file())
        .collect();
    if present.is_empty() {
        panic!(
            "{}",
            demos_unavailable_message(&dir, running_ignored_tests())
        );
    }
    let missing: Vec<&str> = names
        .iter()
        .filter(|name| !dir.join(name).is_file())
        .map(String::as_str)
        .collect();
    if !missing.is_empty() {
        panic!(
            "test-demos/files is missing {}; run ./scripts/run.sh --fetch-demos",
            missing.join(", ")
        );
    }
    names.into_iter().map(|name| dir.join(name)).collect()
}
