# Parser extensions — implementation plan

Executable plan derived from [`PARSER-EXTENSIONS.md`](./PARSER-EXTENSIONS.md) conclusions. That file stays the decision log; **this file is the build order**.

One functionality → one commit (AGENTS.md). After any required `types.rs` / payload shape change: update `decode.ts`, `./scripts/build-wasm.sh`, web checks, **re-drop the demo**. Do not commit `.demos/`.

---

## Scope snapshot

| Ship | Skip / defer |
|---|---|
| Kill modifiers: wallbang, noscope, thrusmoke, attackerblind, airborne | revenge, dominated, distance |
| Hurt: hitgroup + armor damage | — |
| Active weapon (per-tick WID) | — |
| Mag / reserve ammo → **spectator HUD only** | timeline / review / habits for ammo (later) |
| Flags: **planting + defusing only** | speed, walking, airborne/jump flags, footsteps |
| Bomb events: pickup, dropped, beginplant, abortplant | — |
| Bomb radar: loose (distinct from planted) + carried in nickname box | ground guns / item pickup/equip |
| Attacker xyz on `Kill` | — |
| Buy timeline (freeze cart / money+equip diffs) | rewrite eco classifier unless tags misbehave |
| Molly/smoke interaction if missing (investigate) | decoy fake-fire enrichment |
| — | bullet_impact, damage matrix, pitch, odds/deep stats, out-of-scope list in extensions doc |

---

## Cross-cutting rules

1. **Probe first** — ask whiskeyo for a specific `.dem` (FACEIT or pro-play). Drop it under `.demos/` (gitignored) or point at an existing file; do not invent field names. Confirm `player_death` keys (`penetrated` vs `penetrated_objects`, `attackerinair`, …), `hitgroup` / `dmg_armor`, bomb event names, active-weapon/ammo props, smoke/inferno extinguish signals. Dump via throwaway observer or CLI; fill **Probe notes** below. Delete / do not merge the probe.
2. **Named constants** in `constants.rs` ↔ `constants.ts` for hitgroup ids, new `FLAG_*` bits, bomb kind strings.
3. **Breaking payload changes are OK** while the site is still in testing (see AGENTS.md). Prefer required fields + `decode.ts` updates + WASM rebuild + **re-drop**; do not add `#[serde(default)]` / dual-path JSON only to keep stale browser caches alive.
4. **Mirror types:** `types.rs` → `replayTypes.ts` → `decode.ts` → fixtures / `makeKill` / `makeHurt` / `makeBombEvent`.
5. **Verification per commit:** Rust (`fmt` / `clippy` / `test`) and/or web (`format:check` / `lint` / `typecheck` / `test`) for every touched app; WASM rebuild when parser/types change.

---

## Phase 0 — Probe (no product commit)

**Goal:** Lock real GOTV field names and whether molly dies under smoke.

**Blocked on demo:** ask whiskeyo which file to use (FACEIT match download or a pro GOTV). Save under `.demos/` — never commit. Prefer one FACEIT + optionally one pro-play if event schemas might differ.

- Temporary probe counting `player_death` keys, `player_hurt` hitgroup/dmg_armor, bomb events, active-weapon props, smoke/inferno expire vs extinguish-style events.
- Note findings under **Probe notes**.
- Delete / do not merge the probe.

---

## Phase 1 — Kill modifiers + hurt hitgroup/armor

**Why first:** Small type changes, high killfeed/review value, no SoA growth.

### 1a. Parser: kill flags

**Commit:** `Add wallbang/noscope/smoke/blind/airborne flags on kills.`

| Area | Work |
|---|---|
| `observer.rs` | On `player_death`, read confirmed bool fields into `RawKill` |
| `types.rs` / `assemble.rs` | `Kill`: `wallbang`, `noscope`, `through_smoke`, `attacker_blind`, `attacker_airborne` (names TBD; snake_case serde) |
| Tests | Synthetic `RawKill` / assemble unit tests; event-key helpers if parsing is non-trivial |

**Do not** add revenge/dominate/distance.

### 1b. Web: killfeed + types

**Commit:** `Surface kill modifiers on the killfeed.`

| Area | Work |
|---|---|
| `replayTypes.ts`, `decode.ts` | Required bools (breaking OK — update shapes) |
| `KillFeed.tsx` | Icons or compact badges next to HS / flash-assist (reuse weapon SVG pattern if assets exist; else text/CSS marks) |
| Fixtures / tests | `makeKill` defaults false; KillFeed tests for each flag |

### 1c. Parser + web: hurt hitgroup + armor

**Commit:** `Record hitgroup and armor damage on hurts.`

| Area | Work |
|---|---|
| `observer.rs` | `hitgroup`, `dmg_armor` (and remaining armor only if reliably present) |
| `types.rs` | `Hurt.hitgroup: u8`, `Hurt.damage_armor: i32` (or `i16`) |
| `analysis.rs` / `stats.ts` | **Do not** change ADR formula unless intentionally using armor; ADR stays enemy HP-capped |
| Web types + decode | Mirror fields |

**Where to place hitgroup in the UI (answer to open Q):**

| Placement | v1? | Notes |
|---|---|---|
| **Spectator card / selected-player strip** | Yes, light | e.g. last hit taken: “−34 chest (12 armor)” when selected |
| **Killfeed** | No | Kill already has HS; hurt spam would clutter |
| **Scoreboard column** | Later | Optional “head dmg %” = head hitgroup damage / total damage — needs design |
| **Review note** | Later | “Tagged in head N times before death” |
| **Derived matrix** | Skip | Can sum hurts later if a round card appears |

v1 UI for hurts: keep data in the replay; show **only on the selected player’s spectator/detail HUD** (same home as ammo). No new sidebar tab yet.

### 1d. Attacker position on kill

**Commit:** `Store attacker world position on each kill.`

| Area | Work |
|---|---|
| `observer.rs` | At `player_death`, sample attacker pawn xyz (same helpers as victim) |
| `types.rs` | `attacker_x`, `attacker_y`, `attacker_z` (or nested; prefer flat for serde parity with victim) |
| `radarFx.ts` `killLineEnds` | Prefer stored attacker xyz when present; fall back to tick sample for old demos |
| Tests | Line uses stored coords when tick sample would differ / missing |

---

## Phase 2 — Bomb lifecycle events

**Commit A:** `Parse bomb pickup, drop, begin-plant, and abort-plant.`

| Area | Work |
|---|---|
| `observer.rs` | Match `bomb_pickup`, `bomb_dropped`, `bomb_beginplant`, `bomb_abortplant` (exact names from probe) |
| `BombKind` | Extend enum + serde rename_all; keep old variants |
| `assemble` / web `BombEvent.kind` | Union type + decode |
| `roundTimeline.ts` / Controls scrubber | Labels like existing planted/defuse |
| HUD | Begin-plant / abort-plant mirrors begin/abort defuse if useful |

**Commit B (radar state from events first):** derive loose bomb pos + carrier **from the event stream** at tick `t` (last pickup/drop/plant before `t`) before investing in entity sampling.

| Area | Work |
|---|---|
| `radarFrame.ts` / `hud.ts` | `bombView`: `planted` \| `loose` \| `carried` \| `none` |
| `paintRadarFrame.ts` / `paintPawns` | See Phase 3 UI |
| Tests | Drop → loose icon; pickup → carrier; plant → planted timer path unchanged |

---

## Phase 3 — Bomb radar UI

Depends on Phase 2 event-derived state (entity sampling only if flicker).

**Commit:** `Show loose and carried C4 on the radar.`

Per whiskeyo conclusion:

| State | Visual |
|---|---|
| **Planted** | Existing planted C4 + timer (unchanged) |
| **Loose** | C4 SVG at world pos — **visually distinct** from planted (e.g. no site ring / different alpha / “pack” scale / no fuse dial). Do not reuse the planted look 1:1 |
| **Carried** | Extend the nickname badge under the pawn: `[C4 SVG] nickname` (same box as names). No separate world icon while carried |

Files: `paintRadarFrame.ts` (name box layout), `draw.ts` / `drawC4` variants or options, CSS unused if canvas-only, `paintRadarFrame.test.ts`.

---

## Phase 4 — Active weapon + ammo (HUD)

**Commit A:** `Sample active weapon id into the tick buffer.`

| Area | Work |
|---|---|
| `inventory.rs` / `observer` tick capture | Resolve `m_hActiveWeapon` → WID (`active: u8` SoA column) |
| WASM + `sample.ts` | Expose on `SampledPlayer` |
| `SpectatorEconomy` / loadout | Highlight held weapon (border/opacity on primary vs knife vs nade) |

**Commit B:** `Sample clip and reserve for the active weapon.`

| Area | Work |
|---|---|
| Tick buffer | `clip: u8`, `reserve: u16` (or both u16) — stride same as other columns |
| Spectator HUD only | Show `clip/reserve` on the selected (or all) player cards |
| No Review / habits / timeline in this commit |

Size: ~3–4 bytes × players × frames — acceptable at current stride; document if probing shows props missing on GOTV.

---

## Phase 5 — Planting / defusing tick flags

**Commit:** `Add planting and defusing pawn flags.`

| Area | Work |
|---|---|
| `lib.rs` / constants | `FLAG_PLANTING`, `FLAG_DEFUSING` (next free bits after `FLAG_CT`) |
| Observer | From pawn props and/or latch between begin/abort plant/defuse events |
| Web `FLAG_*` mirrors | `sample.ts` helpers |
| Radar / HUD | Optional progress cue on pawn when flag set (pairs with bomb events) |

**Do not** add walking, airborne, or speed columns.

---

## Phase 6 — Buy timeline

**Commit:** `Record freeze-time buy / inventory deltas.`

Approach (pick one after probe; prefer cheapest that works on FACEIT GOTV):

1. **Event-based:** `item_purchase` / equip events during `[start_tick, freeze_end_tick]`, or
2. **Diff-based:** money + loadout snapshots each stride in freeze → emit synthetic buy rows when gear/weapon ids appear and money drops.

Shape sketch: `BuyEvent { tick, player, def_index or WID, cost? }` on `Match`.

Web:

- Optional spectator “bought this round” list, or
- Improve `roundTags.ts` only when freeze-equip mis-tags (saved rifle eco, pickup force) — **do not** replace equip averages until diffs prove wrong on real demos.

---

## Phase 7 — Molly ↔ smoke interaction

**Today:** smoke and inferno lifetimes are independent (`end_tick`, fire cell spans, linger caps in `radarFx.ts`). **No** extinguish-when-smoked logic in web or Rust.

**Commit (only if probe finds a signal):**

1. Confirm CS2 GOTV emits something usable (`inferno_extinguish`, early `inferno_expire` when smoke overlaps, or fire cells ending while smoke alive).
2. If yes: shorten fire cell `end_tick` / inferno end when extinguished; add unit tests with synthetic overlaps.
3. If no reliable event: document “GOTV does not expose extinguish; leave visual as-is” in this file’s Probe notes — **do not** invent physics.

Decoy enrichment: **skip**.

---

## Explicitly not in this plan

From extensions doc + conclusions: footsteps/jumps, continuous speed, walking/airborne flags, revenge/dominate/distance, bullet_impact, PostRoundDamageReport matrix, pitch, round-end odds/deep stats, ping/rank/skins/connect/hostage/timeouts/MVP/warmup dump/XP/server info, decoy fake shots, **ground guns / item pickup/equip** (little product gain once C4 carrier + loose pack exist).

---

## Suggested commit sequence (checklist)

- [ ] Phase 0 — whiskeyo provides `.dem`; probe notes filled
- [ ] 1a Kill modifier fields (Rust)
- [ ] 1b Killfeed UI
- [ ] 1c Hurt hitgroup + armor (+ spectator last-hit optional)
- [ ] 1d Attacker xyz on Kill + killLineEnds prefer stored
- [ ] 2a Bomb lifecycle events
- [ ] 2b Event-derived bomb state for radar
- [ ] 3 Loose vs planted vs carried nickname-box C4
- [ ] 4a Active weapon SoA + HUD highlight
- [ ] 4b Ammo SoA + HUD only
- [ ] 5 Planting/defusing flags
- [ ] 6 Buy timeline (events or freeze diffs)
- [ ] 7 Molly/smoke extinguish **if** probe supports it

---

## Hitgroup UI (detail)

Minimum viable surfacing so the field is not dead data:

1. **Parser + types** ship first (1c) even if UI is a one-line spectator subtitle.
2. Selected player card: `Last hit: head −89 (armor −15)` from the latest enemy `Hurt` where `victim === selected` with `tick` in a short window.
3. Later: Review / scoreboard % — separate commits, design then.

---

## Probe notes

**Demo to use:** _(ask whiskeyo — FACEIT or pro-play GOTV; path under `.demos/`)_

<!-- Fill during Phase 0 -->

- Demo file / source:
- `player_death` keys seen:
- `player_hurt` hitgroup / dmg_armor:
- Bomb event names:
- Active weapon / ammo props on GOTV:
- Molly extinguish / early expire under smoke:
- Buy/purchase events present?
