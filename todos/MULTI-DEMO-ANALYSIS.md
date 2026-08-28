# Multi-demo analysis (habits / series)

Local-first: drop several GOTV `.dem` of the **same map**, pick a **focal team**, and see what they repeat (paths, util, executes). Files never leave the machine.

This is **not** ten radars playing in lockstep, and not a merged fake scoreboard. Playback, HUD, notes, and the FACEIT-style board stay **one demo**. The series layer sits on top: filter rounds across matches, draw them on one radar, jump into a file when something looks interesting.

`LoadedDemo` (`apps/web/src/lib/parse/session.ts`) is already keyed by map + filename. Comments there about freeze-relative overlay are the starting point. `useDemoSession` still owns a single active replay today.

Related README backlog: round-number mismatch (CT pistol as R13 vs R1), ecos that exist in one match and not another, nade sets that match in A/B and differ in C, storage while moving between demos, parse threading, concurrent-demo limit.

## Product: three layers (do not mix)

| Layer | What it is | Clock |
|---|---|---|
| **Playback** | Watch one match (today’s viewer) | Demo ticks |
| **Series / habits** | Counts and lists across tagged rounds (Util, Action) | Round buckets, not `R13` |
| **Overlay** | Trails / nade dots for **one filter** on one radar | Seconds after **freeze** |

Overlaying ten full games is spaghetti. Habits come from **aligned rounds** (same side for the focal team, same buy, optional layout group) plus a way to open one demo.

Example: “all full-buy rounds of team X on CT.”

1. Focal team = X (name from `team_ct` / `team_t`, or a set of Steam IDs).
2. Keep every non-knife round where that team is **CT** at freeze **and** freeze equipment is a **full buy** (not knife / pistol / eco / force — same cutoffs as `KNIFE_ROUND_MAX_EQUIPMENT`, `ECO_MAX_EQUIPMENT`, `FORCE_BUY_MAX_EQUIPMENT`). Overtime rounds are never pistols (see below); they classify from freeze equipment / money like any other round.
3. Across 10 Mirage files that might be ~40–80 rounds.
4. Draw the five CTs from each of those rounds as **freeze-relative trails**, each **Steam ID a stable color** (nicks change; stand-ins get a new color).
5. Time on that radar is **seconds after freeze**, so game A’s CT pistol and game B’s CT pistol line up even if one is R1 and the other is R13.
6. Do **not** draw the whole round: 50 full-length polylines is soup. A window is the product (e.g. freeze → ~20s, or until first death / plant). That is when “they always fade A” shows up.
7. Click a trail → switch the live viewer to that already-parsed `Replay` at that freeze-relative time. Scoreboard / notes are that match only. No re-parse on jump (see storage).

When the stack is thick, keep Steam ID colors and switch fill to a **heatmap** (or fade older demos). Roster rotation means extra colors; a round without that Steam ID omits that trail.

A match with zero CT full buys contributes nothing to that bucket. Counts are **n / rounds in the bucket**, not “they do this every round.”

## Round tags (never round number)

Every competitive round in every file gets a tag. Filters use tags only.

```
RoundTag {
  demoId
  roundNumber          // in that demo only, for jump-back
  startTick, freezeEndTick
  sideForFocal         // T | CT at freeze
  kind                 // pistol | eco | force | full
  isOt
  layoutGroup?         // when Action/Util already know the site
}
```

Knife rounds are excluded from habit buckets (same as playback skipping knife freeze).

**Pistol:** first **regulation** round on that **side for the focal team** (MR12: one T pistol and one CT pistol per match). That is the $800 round, not “first round of a half” in the abstract.

**Overtime has no pistols.** CS2 OT starts each player at **$10,000**. That money is already on the demo (tick `money` at freeze). Do not invent an “OT pistol” tag. OT rounds use the same eco / force / full rules from freeze equipment; with 10k they are almost always **full**. Put `OVERTIME_START_MONEY = 10000` in `constants.ts` / `constants.rs` when this ships, next to `FIRST_OVERTIME_ROUND`.

**Eco / force / full:** freeze equipment vs existing constants. Pistol is not an eco. OT is not a pistol.

**Focal team:** picker. Prefer a shared `header.team_ct` / `team_t` string; fallback “these five Steam IDs.” If a file does not contain that team, skip it with a notice.

**Players:** `Player.steam_id` is the identity. Do not key trails or aggregates by nickname.

## Util sets (the “they always throw X” question)

Hash the first-wave util in a freeze-relative window as a multiset of `(nade kind, layout group)` — same grouping as the Util tab (`group` on layout JSON).

Sort buckets by frequency: “7/10 T full buys: A apps smoke + mid smoke.” Outlier demos are the leftover. No ML.

Series Util / Action reuse `usedUtilPlaces` / `findExecutes` / layout groups; they become counts keyed by `RoundTag` + Steam ID, not a second formula.

## Storage and parse (local-first)

Keep the browser **`File` handles** (not a second copy of the bytes) so a tab refresh can parse again. For a series at the product cap, **keep every parsed `Replay` in RAM**. Overlay trails come from digests; jumping to a demo is `playback.jump` on an object that is already there.

| What | Keep |
|---|---|
| `.dem` `File` | all files (reload / retry only) |
| Digest (tags, util, executes, freeze positions, short trail samples) | all files, RAM |
| Full `Replay` (tick SoA) | **all files in the series** |
| WASM parse workers | **pool of 2–4**, queue the rest |

One 30-round OT `Replay` is on the order of 10–15 MB of ticks. Twelve of those is ~120–180 MB — acceptable for this tool on a desktop. Dropping buffers to save RAM would mean a **full WASM parse on every jump** (same wait as dropping the file the first time). That is the wrong UX; do not evict Replays inside the 12-file cap.

**Product cap:** about **12** files in a series (progress UI, not a physics law).

Do **not** store `.dem` bytes in IndexedDB. Notes stay per demo (`matchKey` / review project), unchanged.

### Jump vs re-parse

Clicking a trail / Action beat must **not** re-parse. The series already paid that cost at drop time. Re-parse only if the `Replay` is missing (failed parse, user re-dropped, or a future eviction path we are not taking at v1).

### Parallel parse (yes)

One `parseDemo` call is **single-threaded**. The `4` in `parseDemo(data, 4, true)` is `tick_stride` (sample every 4 ticks), not four threads. The crate does not use rayon.

Concurrency is **several Web Workers**, each with its own WASM instance, each eating a different `File` from a queue. The main thread only shows progress.

Cap the pool (suggest `min(4, navigator.hardwareConcurrency ?? 2, fileCount)`, and probably **3** in practice). Each worker holds WASM heap plus the demo bytes plus output buffers; **10 at once** is how tabs OOM during parse. Queue the remaining files onto free workers. Analysis of digests stays on the main thread — 10 × 30 rounds is nothing.

WASM cannot share one module across workers in a useful way here; it is N copies, N files in flight.

## UI sketch

1. Splash: drop one `.dem` to watch, or several on the **same map** for habits. Mixed maps: reject or split (do not silently overlay Inferno on Mirage).
2. Series bar: file list, map, focal team, parse progress / errors.
3. Filters: player (Steam ID), side (focal team), round kind, layout group.
4. Habits radar: freeze-relative trails or nade dots for the **current filter only**.
5. Util / Action: series counts; same chips as a single demo.
6. Click trail or beat → live playback of that file at that freeze-relative time.

## Implementation order

One behavior per commit (`AGENTS.md`). Tests on synthetic matches, never `.demos/*.dem`.

1. **Parse pool** — multi-file drop, same-map check, 2–4 workers, `File[]` + **all** parsed `Replay`s kept. Single-demo path unchanged.
2. **Round tags + focal team** — side-for-team; pistol is regulation-only; OT is eco/force/full from freeze (10k start, no OT pistol). Tests: knife, MR12 swap, OT, “CT pistol is not R13.”
3. **Series Util / Action** — aggregate existing helpers keyed by tag + Steam ID.
4. **Filtered overlay** — Steam ID colors, freeze-relative polylines / nade dots for one bucket (the “see habits” moment). Bounded window; heatmap when dense.
5. **Util-set frequency** — first-wave multiset chips.

Do not start with overlay of everything; without tags it is noise.

## Out of scope until the series works

- Lockstep playback of N demos
- Merged K/D scoreboard
- Cross-map series
- IndexedDB of demo bytes
- Evicting Replays and re-parsing on jump
- Aim error (GOTV yaw-only, no pitch)
- 3D replay

## FAQ

**Does OT have pistols?** No. OT starts at $10k per player (demo `money` at freeze). Tag OT as eco / force / full only.

**Wait again when I click a trail?** No, not at the 12-file cap. Jump uses the `Replay` from the drop parse.

**Can parse run in parallel?** Yes: a small worker pool (about 3), not 10 WASM copies at once, and not threads inside a single `parseDemo`.

## Code to start from

| Piece | Where |
|---|---|
| One loaded file | `lib/parse/session.ts`, `useDemoSession.ts` |
| Drop → parse | `lib/state/appState.tsx` `onFile`, `components/app/DropZone.tsx` |
| Knife / eco / force | `lib/shared/constants.ts`, `Round.is_knife`, freeze `equip` |
| Starting sides / swaps | `header.team_ct` / `team_t`, `liveTeams()`, pawn `FLAG_CT` vs `start_side` |
| Util / executes / groups | `lib/match/utility.ts`, `execute.ts`, `lib/radar/layouts.ts` |
| Notes (per demo, leave alone) | `lib/notes/useReviewProject.ts` |
