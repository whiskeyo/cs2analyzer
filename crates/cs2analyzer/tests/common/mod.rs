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

/// Every manifest demo on disk, in manifest order.
///
/// A missing or empty download directory is a failed run, not a pass: `cargo test`
/// already skips these tests via `#[ignore]`.
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
            "skip: {} is missing or has none of the manifest demos; run ./scripts/run.sh --fetch-demos",
            dir.display()
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
