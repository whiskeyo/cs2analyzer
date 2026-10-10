# Round-phase detection status

Internal note of how plant, execute, retake, and push tagging works **today**. No detector was changed for this writeup. A later tag pass should start here.

There is no round-phase state machine. The parser records bomb events and per-frame plant/defuse flags. The Action tab then clusters utility, a coarse T pack, the first completed plant, and kill bursts into beats labeled execute, plant, retake, or fight. "T push" is a title on an execute beat, not its own kind. Nothing tags a save.

## Where plant, bomb, and defuse are detected

### Parser (events)

`crates/cs2analyzer/src/observer.rs` (`on_game_event`) records these GOTV events into `BombEvent`:

| Game event | `BombKind` |
|---|---|
| `bomb_beginplant` | `BeginPlant` |
| `bomb_planted` | `Planted` |
| `bomb_begindefuse` | `BeginDefuse` |
| `bomb_abortdefuse` | `AbortDefuse` |
| `bomb_defused` | `Defused` |
| `bomb_exploded` | `Exploded` |
| `bomb_pickup` | `Pickup` |
| `bomb_dropped` | `Dropped` |

Each row stores tick, player (steam → slot in `assemble.rs`), xyz, `haskit`, and `site`. `site` is filled only on `bomb_planted`, from the event's `site` field (`0` = A, `1` = B). `haskit` comes from the event bool/int. Dropped bombs take xyz from `entindex`; other kinds use the pawn. If xyz is still `0,0`, `fill_missing_bomb_positions` copies the player's tick-buffer position.

Two sampled flags ride the tick buffer (`FLAG_PLANTING` `1<<5`, `FLAG_DEFUSING` `1<<6`), stride default 4 (~16 Hz):

- Planting: C4 entity `m_bStartedArming` whose owner is this pawn. Planted-C4 entities are skipped (`c4_arming_steams` in `inventory.rs`).
- Defusing: pawn `m_bIsDefusing`.

Carrier vs loose pack is separate: gear bit `GEAR_C4` on the sampled player, plus pickup/drop events (`bombView` in `apps/web/src/lib/stats/hud.ts`).

Round end prefers the tick `m_iRoundWinStatus` flips (`synth_ends`), with `m_eRoundWinReason`. `round_officially_ended` is often the next freeze, so it is not the round `end_tick`.

### HUD clocks (not tags)

`apps/web/src/lib/stats/hud.ts` drives the radar timers. Constants live in `apps/web/src/lib/shared/constants.ts` (`BOMB_SECONDS` 40, `PLANT_SECONDS` 3.2, defuse 5 with kit / 10 without).

- **Plant clock.** Latest `begin_plant` in the round until `planted` or `dropped`. If GOTV never sent `begin_plant`, the clock starts at the trailing `FLAG_PLANTING` sample. Hidden once the planter is dead or the 3.2s arm overruns by more than 0.25s.
- **Bomb clock.** From `planted` until defuse, explode, 40s elapsed, the round's `end_tick`, the next round's `start_tick`, or every present CT is dead.
- **Defuse clock.** `begin_defuse` after a plant, cancelled by `abort_defuse`, defuse, or explode. Same flag fallback as planting, using `FLAG_DEFUSING` and `GEAR_DEFUSER` when the event omits `haskit`.

### Stats and other surfaces

- Plants and defuses on the scoreboard count completed `planted` / `defused` events only (`analysis.rs` and `apps/web/src/lib/stats/computeStats.ts`). Begin, abort, pickup, drop, and explode do not increment them. Rating weighs a plant at 0.8 and a defuse at 1.2.
- Round scrubber marks (`roundScrubEventMarks`) draw planted, defused, and exploded only.
- Rounds sidebar (`eventsForRound`) lists begin-plant, plant, begin-defuse, defuse, and explode. Pickup, drop, and abort are skipped.
- `BombEvent.site` is stored and optional in `decode.ts`. **No Action, site, or HUD path reads it.** A/B labels come from layout polygons.

## Execute, retake, push, fight

All of this is TypeScript in `apps/web/src/lib/match/execute.ts` (`findExecutes`). Knife rounds are skipped. The Action tab (`components/sidebar/Action.tsx`) lists these beats under the round story and filters by kind: Execute, Plant, Retake, Fight. Series habits reuse the same beats and count titles (`seriesAnalysis.ts`). Hotkeys `e` / `E` jump the lead-in tick.

`ExecuteKind` is `"execute" | "retake" | "plant" | "fight"`.

### Pulses inside one round

Live window is freeze end through `end_tick`.

1. **Utility dumps.** Smokes, molotovs, incendiaries, flashes, and HEs whose throw starts in the round and whose detonate is after freeze. Decoys are ignored. Side is the thrower's side at detonate. Nades are clustered if detonations are within **4s**, then split when landings are more than `NADE_SITE_SEPARATION` (2000 world units) apart. A cluster is a dump when it has **2+ smokes**, or **1 smoke and 1 fire nade**, or **4+ grenades**. One pulse per dump: `t-util` or `ct-util`, tick = first detonate, xy = landing centroid.
2. **T push.** `tPushTick` samples alive Ts. It needs at least `T_PUSH_MIN_PLAYERS` (3) at freeze, then scans from freeze + `T_PUSH_DELAY_SECONDS` (8s) to round end in `T_PUSH_STEP_SECONDS` (2s) steps. A sample counts when 3+ Ts are still alive, mean distance from their centroid is under `T_PUSH_MAX_SPREAD` (1100), the centroid has moved more than `T_PUSH_MIN_MOVED` (750) from the freeze centroid, and `siteAt` is **A or B**. First such tick only. Mid, spawn, and "no layout" never produce this pulse, because `siteAt` is null without callout polygons and Mid is not A/B.
3. **Plant.** The first `kind === "planted"` event with `start_tick <= tick <= end_tick`. Position is the event xyz, or the planter's sampled position when xyz is `0,0` (`plantedBombPos`).
4. **Kills.** Enemy kills after freeze, grouped within **5s**. A group becomes a `kills` pulse only when it has **2+** kills. Position is the victim centroid.

### Merging pulses into beats

Pulses sort by tick. A pulse joins the open window when it is within **12s** of the previous pulse and not farther than `PULSE_SITE_SEPARATION` (2400) from every positioned pulse already in the window. A pulse more than **1s after the plant**, while the window started at or before the plant, starts a new window. That split is what lets a T execute and a later CT retake be two beats.

A window is dropped when it has no T pulse, no plant, no post-plant CT dump, and fewer than 3 kills. Pre-plant CT utility alone (site defaults) produces nothing. A 2k alone produces nothing. A 3k burst is kept.

### Labels

| Condition | `kind` | `side` | Title stem |
|---|---|---|---|
| Window starts after the plant and contains a CT dump | `retake` | CT | CT retake |
| T dump or T push, or a plant with no CT dump | `plant` if the plant is the only T signal, otherwise `execute` | T | T execute if a T dump is in the window (plant mentioned in the detail line); Plant if the plant has no T dump/push; T push if the only T signal is the pack pulse |
| CT dump and 3+ kills, not after a plant | `execute` | CT | CT take |
| Plant that did not match the rows above | `plant` | T | Plant |
| Anything else that survived the filter (typically a 3k, including post-plant without a CT dump) | `fight` | — | Post-plant if the window starts after the plant, otherwise Fight |

Site text is appended from layout callouts (`sites.ts`), in this order: majority vote of T nade landings, then T+CT landings, then `plantPlace` on the bomb (A/B even just outside the site polygon, via nearer bombsite centroid), then the window centroid. Without a layout, `site` and `location` stay null and the title has no A/B suffix. `BombEvent.site` is not consulted.

`tick` on the beat is the action minus **2s**, not earlier than freeze end. `actionTick` is the first pulse. The round strip highlight stays up for **8s** after `actionTick`.

## Nearby heuristics that are not phase tags

- **Round story** (`roundStory.ts`), shown above the beats. One line per competitive round: average equipment at freeze (`eco` under 2000, `force` under 3700, else `full`), first enemy kill as the opener, a boolean if any plant landed in the round, ace if one player has 5 enemy kills, and an ending from `win_reason` (bomb 1, defuse 7, CT elim 8, T elim 9, time 12, plus draw/surrender labels). The planted flag does not change the defuse ending string.
- **Series buy tags** (`roundTags.ts`): pistol / eco / force / full for habits filters. Same equipment thresholds. Not a round phase.
- **Entry** is the round's first kill and first death. It is not a site entry or a push.
- **Clutches** (`clutches.ts` and the live HUD banner) are 1vX alive-counts after kills.
- **Eco win** in Review is "this player won a non-pistol round while their own equipment was under 2000."
- **Save.** No round-phase or weapon-save detector. Search hits for "save" are notes, settings, canvas, and PDF.

## Events and ticks available to extend

Already on `Replay`, unused or only partly used by the tagger:

- Full `bombEvents`: begin plant, plant, begin/abort defuse, defuse, explode, pickup, drop, with player, xyz, `haskit`, and bombsite index on plants.
- Per-frame `FLAG_PLANTING` / `FLAG_DEFUSING`, `GEAR_C4`, `GEAR_DEFUSER`, alive/side, xyz, yaw, health, equipment, money, primary/secondary/active, clip/reserve. Sampled at tick stride (default every 4th tick); `samplePlayers` interpolates positions between frames.
- Round bounds: `start_tick` (freeze start), `freeze_end_tick`, `end_tick` (win status), `playback_end_tick` (`cs_pre_restart`), `winner`, `win_reason`.
- Grenade throws with kind, thrower, start/detonate/end, trajectory points, and fire cells.
- Kills (victim and attacker xyz, headshot, flash assist, wallbang, noscope, through smoke, attacker blind/airborne), hurts, blinds.
- `weapon_fire` shots as look-direction tracers (x, y, yaw). `bullet_impact` is explicitly not stored.
- Freeze buy events inferred from money and loadout changes (`item_purchase` is not on GOTV).

Win reasons already distinguish bomb, defuse, elimination, and time. Post-plant success is therefore available without a new parser field.

## Gaps versus a full phase tagger

What a coach usually wants (default, contact, split, execute, plant, post-plant, retake, save, and whether it worked) is only partly approximated:

- Beats are sparse highlights, not a partition of the round. Quiet time, mid control, and lurks are unlabeled.
- **Push** requires a tight 3-man T pack already on an A or B polygon, at most once per round, sampled every 2s, and only after 8s. No layout means no push. Splits, contacts in mid, and late re-hits do not match. The word "push" never appears as `ExecuteKind`; the filter chip is Execute.
- **Execute** is a grenade-count dump (2 smokes, smoke+molly, or 4 nades inside 4s and 2000 units). A one-smoke site hit, a flash-and-go, or utility thrown more than 4s apart is missed. Decoys never count. A plant that shares a window with a T dump is titled "T execute" and is not also a Plant chip.
- **Plant** tags the first completed plant only. Failed arms (`begin_plant` with no `planted`), bomb drops, and the event's A/B index are ignored. A second plant in the same round is ignored.
- **Retake** requires a plant and a later CT dump in a window that starts more than 1s after that plant. A retake fought with rifles and one smoke, or a 3k after the plant, becomes "Post-plant" / fight or is dropped. Win/loss, time left, and kit are not part of the label.
- **CT take** (pre-plant CT dump plus a 3k) is kind `execute`, so it shows up under the Execute filter beside T executes.
- **Save** is absent: no "Ts leaving with guns", no "CTs saving after the plant", no exit-from-site check.
- Thresholds are fixed world units, not scaled per map. The push test uses x/y only, so vertical separation (Nuke) does not split a pack.
- A 12s merge can glue a push, a plant, and a fight into one beat when they are spatially close.
- Tags are round-level. They do not say which player executed or who was late.
- GOTV limits still apply: bomb xyz is often the planter, pitch is not stored, impacts are not stored, and planting/defusing flags are stride-sampled.
