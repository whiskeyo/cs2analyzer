# WASM in CI

Plan only. Wire CI later so a crate change cannot merge without regenerating the committed frontend bindings. **No workflow edits in this document’s first PR.**

Today the viewer ships **committed** `wasm-bindgen` output in `apps/web/src/parser/` (not `public/`). Path-aware CI ([#43](https://github.com/whiskeyo/cs2analyzer/pull/43)) stays as-is: Rust-only PRs skip Web and OVH deploy. That is cheap, and it is also how stale WASM reaches `master`.

This plan compares how to close that gap, what local `npm run dev` looks like under each option, and which path fits a private repo with existing filters and FTP publish.

## Problem today

| Step | What happens |
|---|---|
| Author changes `crates/**` (or `types.rs`) | Rust CI is green. Web is **skipped** once #43 lands (no `apps/web/**` in the diff). |
| Author forgets `./scripts/build-wasm.sh` | `apps/web/src/parser/` stays on the last committed glue + `.wasm`. |
| Author forgets `decode.ts` | Worker still shape-checks the **old** JSON; a serde rename can pass typecheck and fail at drop (or worse, go blank if the check was not updated). |
| Merge to `master` | Deploy does not run (Rust-only). The next **web** deploy still bundles the stale `src/parser/` into `dist`. Live site stays on old WASM. |

CI never runs `build-wasm.sh`. Web `npm run build` only copies whatever is already in git. That is the class of bug this plan prevents.

A types change that **does** update `decode.ts` but **not** `src/parser/` is the sharp version: Rust green, Web may run (decode lives under `apps/web`), tests mock WASM, production still parses with the old module.

## Current state (AGENTS.md)

Parser pipeline: `observer.rs` → `assemble.rs` → (CLI) `analysis.rs`. The web UI recomputes live stats in `apps/web/src/lib/stats/stats.ts`. WASM does **not** ship `Match::stats`. After parser changes: rebuild WASM **and re-drop the demo**. UI-only HUD/stats do not need a rebuild.

```
./scripts/build-wasm.sh
# cargo build -p cs2analyzer-wasm --profile wasm-release --target wasm32-unknown-unknown
# wasm-bindgen --target web --out-dir apps/web/src/parser --out-name cs2analyzer_wasm
# optional: wasm-opt -O3 if binaryen is on PATH
```

| Rule | Detail |
|---|---|
| Output dir | `apps/web/src/parser/` — `cs2analyzer_wasm.js`, `.d.ts`, `cs2analyzer_wasm_bg.wasm`, `*_bg.wasm.d.ts`, `README.md` |
| Not here | `apps/web/public/` — the worker loads via `import.meta.url` (`parseWorker.ts`) |
| Hand-edits | **Never.** `eslint` / Prettier / Vitest ignore `src/parser/**` |
| CLI pin | `wasm-bindgen-cli` **0.2.127**, same as the `wasm-bindgen` crate |
| Crate features | `cs2analyzer` with `default-features = false` (no `mimalloc`, no `match-stats`) |
| Profile | `wasm-release`: LTO, `opt-level = 3`, `panic = abort`, `strip` |
| `decode.ts` | Required JSON shapes. A serde rename must update this file in the same change. Prefer breaking required fields over `#[serde(default)]` shims |
| Commit | Generated parser files only together with the crate change that produced them |
| Local helper | `./scripts/run.sh --prepare --build-wasm --dev` |

After a WASM rebuild, tell whiskeyo to **re-drop** the `.dem`. That is a runtime check, not a CI check.

## Failure mode we prevent

**Rust PR green, live site still on old WASM / decode mismatch.**

Concretely:

1. `types.rs` (or observer output) changes.
2. Bindings in `src/parser/` are not regenerated — or `decode.ts` is not updated to match.
3. Path filters skip Web, or Web is green because tests mock `@/parser/cs2analyzer_wasm.js`.
4. `master` deploy (when it next runs) publishes `dist` built from stale glue.

The drift check does **not** replace `decode.ts` or a re-drop. It only proves the committed bindings were produced from the crates in that SHA.

## Options

Compare briefly. All four assume #43 path filters stay. All four keep the pin and the `wasm-release` profile. None of them allow hand-edits to `src/parser/`.

### A — Drift check (human still commits)

On crate / wasm / `src/parser/` changes, CI runs `./scripts/build-wasm.sh` and **fails if `apps/web/src/parser/` is dirty** (`git diff --exit-code`).

- Still require a human commit of the artifacts. Cheapest enforcement.
- Web CI and OVH keep using committed files. `npm run dev` unchanged.
- False dirties if rustc, `wasm-opt`, or bindgen differ from the author’s machine (see Risks).

### B — Bot commit

Same build as A, then CI **commits and pushes** regenerated `src/parser/` back to the PR branch.

- Closes the “I forgot to add the files” loop.
- Needs write permission, a bot identity, and a guard against workflow loops (`[skip ci]` or “paths changed → only parser”).
- Review noise; blame on a bot; still stores binaries in git.

### C — Stop committing artifacts

Gitignore generated parser files (keep `README.md`). Web CI **always** builds WASM from crates before `npm run build`. Artifacts are CI outputs only.

- Single source of truth: crates.
- Local `npm run dev` needs a wasm step **or** a cached artifact download. FE-only clones grow a Rust/`wasm32` toolchain, or a fetch of the last green `web-dist` / wasm artifact.
- #43 must change: crate-only PRs **must** run Web (or a wasm-build job Web depends on). Deploy still needs the module inside `dist`.

### D — Hybrid

Local still commits **or** pulls an artifact. CI **always** rebuilds and verifies a hash (or `git diff`) against what Web would ship.

- Strongest guarantee. Two ways to get a local file (commit vs download) is more moving parts than A.
- Same toolchain-skew risk as A unless the hash is “CI wasm vs CI wasm” only (then local commit is informational).

| | A Drift check | B Bot commit | C CI-only artifacts | D Hybrid |
|---|---|---|---|---|
| Who writes `src/parser/` | Human | Bot (+ human) | Nobody (gitignore) | Human or download |
| Prevents stale merge | Yes | Yes | Yes | Yes |
| Local `npm run dev` | Unchanged | Unchanged (pull after bot) | Must build or fetch | Unchanged if you commit |
| #43 rust-only skips Web | Keep | Keep | **Must run Web/wasm** | Keep if files stay committed |
| Extra CI cost | wasm build on crate PRs | wasm build + push | wasm build on every Web/crate PR | wasm build on crate PRs |
| Extra machinery | None | Token, loop guard | Artifact store or local rust | A + optional download |
| Fits YAGNI / private / OVH | **Best start** | Later if forgets persist | Later if git binaries hurt | Only if A is flaky |

## Recommended path

**Start with A. Optionally graduate to B or C. Do not start at C.**

This repo is private, one owner, already paying for path-aware CI so docs and rust-only work stay cheap. OVH deploy publishes `apps/web/dist` from the Web job; that job already assumes committed bindings. A preserves all of that and only adds a rebuild + dirty check on the paths that can drift.

B is extra policy (permissions, loops) for a problem A already fails closed. Use B only if the dirty check is correct but people still burn a round-trip “CI red → run script → push”.

C is the clean long-term model, and it **breaks** the current local and #43 stories: every Web build needs `wasm32` + bindgen 0.2.127, rust-only PRs can no longer skip the frontend toolchain, and `npm run dev` without a prior wasm step is a blank parser. Not YAGNI until A is boring and the committed `.wasm` is the pain.

D is A plus a second distribution channel. Skip it unless CI vs laptop `wasm-opt` / rustc churn makes A’s `git diff` unusable; then pin the toolchain (below) before inventing downloads.

## Local development impact

What you run day-to-day. FE-only work never needed a wasm rebuild; that stays true under A/B (and under D if you keep committing).

| Option | After a crate / `types.rs` change | FE-only (`npm run dev`) | First clone |
|---|---|---|---|
| **A** | `./scripts/build-wasm.sh` (or `run.sh --build-wasm`), update `decode.ts`, commit `src/parser/` with the crate diff, re-drop the demo | Same as today — committed files | `run.sh --prepare` is enough to view; `--build-wasm` only to regenerate |
| **B** | Same as A if you remember. If you forget, pull the bot commit before you keep editing parser glue | Same; pull if CI pushed | Same as A |
| **C** | No parser commit. Run `build-wasm.sh` locally **or** download the last CI wasm artifact into `src/parser/` (gitignored) | Broken until one of those steps | Must `--prepare --build-wasm` or fetch an artifact; rustc + `wasm32` + bindgen 0.2.127 on every laptop that parses |
| **D** | A’s commands, **or** pull artifact and skip the commit (CI still rebuilds) | Same as A if artifacts stay in git | Same as A or C depending on habit |

Recommendation for the A era: **do not change** `run.sh` / AGENTS.md local flow except to mention “CI will fail the PR if `src/parser/` does not match `build-wasm.sh`”.

`wasm-opt` stays optional locally (script already skips when binaryen is missing). CI must pick one policy and stick to it — see Open questions — or A will flap.

## Interaction with #43 path filters

[#43](https://github.com/whiskeyo/cs2analyzer/pull/43) (draft): workflow `paths-ignore` for todos/docs; `dorny/paths-filter` then:

| Paths | Changes | Rust | Web | Deploy (push `master`/`main`) |
|---|---|---|---|---|
| `todos/**`, `docs/**`, root `*.md`, ISSUE_TEMPLATE | skipped | — | — | — |
| `crates/**`, `Cargo.toml` / `Cargo.lock`, `clippy.toml`, `.cargo/**` | yes | yes | — | — |
| `apps/web/**` (including FAQ markdown) | yes | — | yes | yes |
| `scripts/**`, `.github/workflows/ci.yml` | yes | yes | yes | yes (via Web) |

Deploy needs a successful Web build (`web-dist`). A rust-only master push does **not** publish (viewer bits did not change). Mixed changes still block deploy if Rust fails.

### Where the wasm job sits (A)

The drift check must run when crates can change the module, **even if Web is skipped**. Putting it only on the Web job would miss the failure mode.

Recommended shape (implementation PR, not this one):

- **New job** `wasm` (or a step on Rust): `wasm32-unknown-unknown`, `wasm-bindgen-cli` 0.2.127, `./scripts/build-wasm.sh`, `git diff --exit-code -- apps/web/src/parser/`.
- Path filter **like Rust**, plus `apps/web/src/parser/**` and `scripts/build-wasm.sh` if those are not already covered via `scripts/**`.
- Do **not** add `crates/**` to the Web filter just to “make Web see rust”. That would undo #43’s rust-only skip. A’s job is the cheaper, targeted Web-adjacent work.
- Deploy still publishes whatever Vite emitted from **committed** `src/parser/` into `dist`. A does not upload a different wasm than git.
- If the PR also touches `decode.ts` / worker / viewer, Web still runs (existing `apps/web/**` filter). Typecheck and tests stay on the human-committed bindings.

### Later options vs #43

- **B:** Same filters as A. Bot push touches `apps/web/src/parser/**` → a follow-up Web run is expected; guard the loop.
- **C:** Crate changes must build wasm **and** `npm run build`. Either Web’s filter includes `crates/**`, or Web `needs: wasm` and downloads the artifact. Rust-only “skip Web” goes away for parser-affecting crates (almost all of `crates/cs2analyzer` + `cs2analyzer-wasm`).
- **D:** Filters like A while files remain committed.

`scripts/build-wasm.sh` already sits under `scripts/**`, so editing the script today already runs Rust **and** Web. Keep that: a bindgen/profile change is a full-matrix change.

## Toolchain (do not drift)

Implementation PRs must not “upgrade while we are here”.

| Pin | Why |
|---|---|
| `wasm-bindgen-cli` **0.2.127** | Same as `wasm-bindgen` in `crates/cs2analyzer-wasm`. `build-wasm.sh` and `run.sh` already install this version `--locked` if missing. |
| `wasm-release` profile | LTO, `panic = abort`, strip. Do not use `--release` in CI “because it is faster to type”. |
| `default-features = false` on the wasm crate’s `cs2analyzer` dep | No `mimalloc`, no `match-stats`. |
| No hand-edits to `apps/web/src/parser/` | Including in review. Diff belongs to `build-wasm.sh` only. |
| `decode.ts` + re-drop | Still human. CI A does not parse a `.dem`. |

Optional later (not required for A): pin `rust-toolchain` (channel or date) so laptop vs `dtolnay/rust-toolchain@stable` does not rewrite the `.wasm` bytes. Install or deliberately skip `wasm-opt` in CI so the dirty check matches the script’s “skip if missing” default **or** a documented binaryen install.

## Phased PRs

One concern per PR. This list is implementation **after** this doc is reviewed. **Do not change `.github/workflows/` in the planning PR.**

1. **This PR** — `todos/WASM-CI.md` only.
2. **Land or rebase onto #43** so the wasm job can use the same `changes` outputs (or a third `wasm:` filter). Do not invent a second path-filter scheme.
3. **A — drift job** — toolchain + `build-wasm.sh` + dirty `src/parser/`. Fail with a short message: run the script, commit `apps/web/src/parser/`, update `decode.ts` if shapes changed. No bot push.
4. **Docs in the same A PR or a tiny follow-up** — one AGENTS.md / README sentence that CI checks parser drift. Not a new essay.
5. **Optional B** — only if A is red for “forgot to commit” more than for toolchain skew. Bot commit of `src/parser/` only.
6. **Optional C** — only if we want git to stop holding the `.wasm`. Separate design for local fetch vs `run.sh --build-wasm`; #43 filters must be updated in that PR.

Do not bundle i18n, tutorial, settings, or perf work into these PRs.

## Testing (when A is implemented)

- A crate-only fixture thought-experiment: change a comment in `cs2analyzer-wasm` that does not affect codegen if possible — or accept that most crate edits **will** dirty the wasm and require a commit. The job’s contract is “rebuild matches git”, not “wasm bytes never change”.
- Intentional stale `src/parser/` (or a CI-only dry run) must fail the job.
- Web unit tests stay mocked; they are not the drift check.
- No `.dem` in CI.

## Relation to other todos

- **#43 path-aware CI** — prerequisite shape. This plan does not reopen docs-only skips.
- **PERFORMANCE-PLAN** (`wasm-opt`, bindgen 0.2.127, `wasm-release`) — size/speed later. A should match today’s script (opt optional), not silently turn on binaryen.
- **I18N / TUTORIAL** — separate planning PRs (`todos/I18N.md`, `todos/TUTORIAL.md`). No overlap. Do not implement them here.

## Non-goals (this planning PR and v1 of A)

- Editing `.github/workflows/ci.yml` in the doc-only PR.
- Building WASM on every Web-only PR (FAQ, CSS, playbook).
- Parsing a real demo in Actions.
- Shipping `Match::stats` in WASM.
- Bumping bindgen, enabling `mimalloc` / `match-stats` in wasm, or moving output to `public/`.
- Auto-updating `decode.ts` from Rust types.

## Open questions (whiskeyo)

1. **Job placement:** sibling `wasm` job vs a step on Rust? Sibling keeps Rust logs readable and can cache `wasm32` separately.
2. **`wasm-opt`:** skip in CI (same as a laptop without binaryen) or install pinned binaryen so release wasm is what we publish?
3. **Floating `stable` rustc:** accept rare dirty flakes, or add `rust-toolchain.toml` when A lands?
4. **Which crate paths count:** all of `crates/**` (simple, matches #43 Rust) vs only `cs2analyzer` + `cs2analyzer-wasm` (CLI-only edits would skip wasm)? Prefer **all crates** — CLI and analyzer share types; a “CLI-only” types tweak can still change JSON.
5. **Dirty file set:** whole `src/parser/` including `README.md`, or only `cs2analyzer_wasm*`? Prefer the whole directory minus nothing — the README is tiny and should stay script-owned.
6. **Graduate to B vs C:** revisit only after A has run on a few real parser PRs.

## One-line scope

**WASM CI v1 = keep committed `apps/web/src/parser/` and #43 filters; on crate changes rebuild with `build-wasm.sh` (bindgen 0.2.127, `wasm-release`) and fail if git is dirty; local `npm run dev` unchanged; bot commit or CI-only artifacts are later options, not the first PR.**
