//! Turn the streaming collector into a compact [`Match`].

#[cfg(feature = "match-stats")]
use crate::analysis::compute_stats;
use crate::analysis::starting_team_scores;
use crate::constants::{
    DEFAULT_TICK_RATE, FLASH_POP_SECONDS, FREEZE_START_AFTER_PRE_RESTART_TICKS,
    GRENADE_DET_LATE_STRIDES, GRENADE_DET_LEAD_TICKS, HE_DECOY_SECONDS, INCENDIARY_BURN_TICKS,
    KNIFE_ROUND_MAX_EQUIPMENT, KNIFE_ROUND_RESET_MAX_EQUIPMENT, MOLOTOV_BURN_TICKS,
    MOLOTOV_SECONDS, SMOKE_SECONDS,
};
use crate::inventory::{
    weapon_buy_cost, GEAR_DECOY, GEAR_DEFUSER, GEAR_FLASH, GEAR_FLASH2, GEAR_HE, GEAR_HELMET,
    GEAR_INC, GEAR_KEVLAR, GEAR_MOLLY, GEAR_SMOKE, GEAR_ZEUS, WID_DECOY, WID_DEFUSER, WID_FLASH,
    WID_HE, WID_HELMET, WID_INC, WID_KEVLAR, WID_MOLLY, WID_SMOKE, WID_TASER,
};
use crate::observer::{Collector, GrenadeDetSource};
use crate::types::*;
use crate::{FLAG_PRESENT, MAX_PLAYERS};
use std::collections::{BTreeMap, HashMap};

pub(crate) fn assemble(c: &mut Collector, playback_ticks: i32, playback_time: f32) -> Match {
    let mut steam_to_idx: HashMap<u64, u8> = HashMap::new();
    let mut players = Vec::with_capacity(c.meta_order.len().min(MAX_PLAYERS));
    for steam in c.meta_order.iter().take(MAX_PLAYERS) {
        let Some(meta) = c.meta.get(steam) else {
            continue;
        };
        let i = players.len() as u8;
        steam_to_idx.insert(*steam, i);
        players.push(Player {
            index: i,
            steam_id: meta.steam_id,
            name: meta.name.clone(),
            start_side: meta.start_side,
            is_bot: meta.is_bot,
        });
    }
    let player_count = players.len();

    let idx_of = |steam: Option<u64>| -> i8 {
        steam
            .and_then(|s| steam_to_idx.get(&s).copied())
            .map(|v| v as i8)
            .unwrap_or(-1)
    };

    let ticks = build_ticks(c, player_count, &steam_to_idx);
    let rounds = build_rounds(c);
    apply_match_start_sides(&mut players, &ticks, &rounds);
    c.finish_infernos(c.last_cap);
    let grenades = build_grenades(c, &idx_of, tick_rate(c), &rounds);
    let shots: Vec<Shot> = c
        .shots
        .iter()
        .map(|(tick, steam, x, y, yaw)| Shot {
            tick: *tick,
            player: idx_of(*steam),
            x: *x,
            y: *y,
            yaw: *yaw,
        })
        .collect();
    let kills: Vec<Kill> = c
        .kills
        .iter()
        .map(|k| Kill {
            tick: k.tick,
            attacker: idx_of(k.attacker),
            victim: idx_of(k.victim),
            assister: idx_of(k.assister),
            weapon: k.weapon.clone(),
            headshot: k.headshot,
            assisted_flash: k.assisted_flash,
            wallbang: k.wallbang,
            noscope: k.noscope,
            through_smoke: k.through_smoke,
            attacker_blind: k.attacker_blind,
            attacker_airborne: k.attacker_airborne,
            x: k.x,
            y: k.y,
            z: k.z,
            attacker_x: k.attacker_x,
            attacker_y: k.attacker_y,
            attacker_z: k.attacker_z,
        })
        .collect();
    let hurts: Vec<Hurt> = c
        .hurts
        .iter()
        .map(|h| Hurt {
            tick: h.tick,
            attacker: idx_of(h.attacker),
            victim: idx_of(h.victim),
            damage: h.damage,
            damage_armor: h.damage_armor,
            hitgroup: h.hitgroup,
            health: h.health,
            armor: h.armor,
            weapon: h.weapon.clone(),
        })
        .collect();
    let blinds: Vec<Blind> = c
        .blinds
        .iter()
        .map(|(tick, victim, dur, attacker)| Blind {
            tick: *tick,
            attacker: idx_of(*attacker),
            victim: idx_of(*victim),
            duration: *dur,
        })
        .collect();
    let mut bomb_events: Vec<BombEvent> = c
        .bomb_events
        .iter()
        .map(|(tick, kind, player, x, y, z, haskit, site)| BombEvent {
            tick: *tick,
            kind: *kind,
            player: idx_of(*player),
            x: *x,
            y: *y,
            z: *z,
            haskit: *haskit,
            site: *site,
        })
        .collect();
    fill_missing_bomb_positions(&mut bomb_events, &ticks);

    let (team_ct, team_t) = start_team_names(c, &rounds);

    let header = MatchHeader {
        map_name: c.map_name.clone(),
        tick_rate: tick_rate(c),
        tick_stride: c.opts.tick_stride,
        duration_s: if playback_time > 0.0 {
            playback_time
        } else {
            playback_ticks.max(0) as f32 / tick_rate(c).max(1.0)
        },
        playback_ticks: playback_ticks.max(0) as u32,
        team_ct,
        team_t,
        score_ct: 0,
        score_t: 0,
    };

    let buy_events = freeze_buys(&ticks, &rounds);
    let mut controller_dump: Vec<ControllerDump> = c.controller_last.values().cloned().collect();
    controller_dump.sort_by_key(|row| row.slot);
    controller_dump.extend(c.controller_freeze.iter().cloned());
    let mut m = Match {
        header,
        players,
        rounds,
        ticks,
        grenades,
        shots,
        kills,
        hurts,
        blinds,
        bomb_events,
        buy_events,
        stats: Vec::new(),
        controller_dump,
    };
    #[cfg(feature = "match-stats")]
    {
        m.stats = compute_stats(&m);
    }
    let (score_ct, score_t) = starting_team_scores(&m, u32::MAX);
    m.header.score_ct = score_ct;
    m.header.score_t = score_t;
    m
}

fn start_team_names(c: &Collector, rounds: &[Round]) -> (String, String) {
    rounds
        .iter()
        .find(|r| !r.is_knife)
        .and_then(|r| c.round_names.get(&r.freeze_end_tick).cloned())
        .or_else(|| {
            rounds
                .iter()
                .find_map(|r| c.round_names.get(&r.freeze_end_tick).cloned())
        })
        .or_else(|| c.final_names.clone())
        .unwrap_or_default()
}

fn tick_rate(c: &Collector) -> f32 {
    if c.tick_interval > 0.0 {
        1.0 / c.tick_interval
    } else {
        DEFAULT_TICK_RATE
    }
}

fn build_ticks(c: &Collector, player_count: usize, steam_to_idx: &HashMap<u64, u8>) -> TickBuffer {
    let frame_count = c.frames.len();
    let n = frame_count * player_count;
    let mut buf = TickBuffer {
        frame_count: frame_count as u32,
        player_count: player_count as u32,
        ticks: Vec::with_capacity(frame_count),
        x: vec![0.0; n],
        y: vec![0.0; n],
        z: vec![0.0; n],
        yaw: vec![0.0; n],
        health: vec![0; n],
        armor: vec![0; n],
        flags: vec![0; n],
        money: vec![0; n],
        equip: vec![0; n],
        gear: vec![0; n],
        primary: vec![0; n],
        secondary: vec![0; n],
        active: vec![0; n],
        clip: vec![0; n],
        reserve: vec![0; n],
    };
    if player_count == 0 {
        buf.ticks = c.frames.iter().map(|f| f.tick).collect();
        return buf;
    }
    for (f, frame) in c.frames.iter().enumerate() {
        buf.ticks.push(frame.tick);
        for p in &frame.players {
            let Some(&idx) = steam_to_idx.get(&p.steam_id) else {
                continue;
            };
            let i = f * player_count + idx as usize;
            buf.x[i] = p.x;
            buf.y[i] = p.y;
            buf.z[i] = p.z;
            buf.yaw[i] = p.yaw;
            buf.health[i] = p.health;
            buf.armor[i] = p.armor;
            buf.flags[i] = p.flags | FLAG_PRESENT;
            buf.money[i] = p.money;
            buf.equip[i] = p.equip;
            buf.gear[i] = p.gear;
            buf.primary[i] = p.primary;
            buf.secondary[i] = p.secondary;
            buf.active[i] = p.active;
            buf.clip[i] = p.clip;
            buf.reserve[i] = p.reserve;
        }
    }
    buf
}

fn apply_match_start_sides(players: &mut [Player], ticks: &TickBuffer, rounds: &[Round]) {
    let Some(first) = rounds.iter().find(|r| !r.is_knife) else {
        return;
    };
    let frame = ticks.frame_index_at_tick(first.freeze_end_tick.max(first.start_tick));
    for p in players.iter_mut() {
        if let Some(tp) = ticks.player_at(frame, p.index as usize) {
            if tp.flags & crate::FLAG_PRESENT != 0 {
                p.start_side = if tp.flags & crate::FLAG_CT != 0 {
                    Side::Ct
                } else {
                    Side::T
                };
            }
        }
    }
}

fn build_rounds(c: &Collector) -> Vec<Round> {
    let n = c
        .freeze_ends
        .len()
        .max(c.round_starts.len())
        .max(c.synth_ends.len())
        .max(c.official_ends.len());
    let mut rounds = Vec::with_capacity(n);
    for i in 0..n {
        let freeze = *c.freeze_ends.get(i).unwrap_or(&0);
        let start = *c.round_starts.get(i).unwrap_or(&freeze);
        let next_start = c
            .round_starts
            .get(i + 1)
            .copied()
            .or_else(|| c.freeze_ends.get(i + 1).copied());
        let (end_tick, winner, reason) = round_conclusion(c, start, next_start);
        let playback_end_tick = playback_end_tick(c, start, end_tick, next_start);
        let (score_ct, score_t) = c.round_scores.get(&freeze).copied().unwrap_or((0, 0));
        let round_time_s = c.round_times.get(&freeze).copied().unwrap_or(0);
        let max_ev = c.round_equip.get(&freeze).copied().unwrap_or(0);
        let gun_kill = c.kills.iter().any(|k| {
            k.tick >= start && k.tick <= end_tick && !crate::props::is_knife_weapon(&k.weapon)
        });
        let is_knife = max_ev < KNIFE_ROUND_MAX_EQUIPMENT && !gun_kill;
        let (team_ct, team_t) = c.round_names.get(&freeze).cloned().unwrap_or_default();
        rounds.push(Round {
            number: 0,
            start_tick: start,
            freeze_end_tick: freeze,
            end_tick,
            playback_end_tick,
            winner,
            win_reason: reason,
            score_ct,
            score_t,
            round_time_s,
            is_knife,
            team_ct,
            team_t,
        });
    }

    // FACEIT: knife round win is discarded — next round still enters 0–0.
    for i in 0..rounds.len().saturating_sub(1) {
        let nxt = &rounds[i + 1];
        if nxt.score_ct == 0 && nxt.score_t == 0 && rounds[i].winner.is_some() {
            let ev = c
                .round_equip
                .get(&rounds[i].freeze_end_tick)
                .copied()
                .unwrap_or(0);
            if ev < KNIFE_ROUND_RESET_MAX_EQUIPMENT {
                rounds[i].is_knife = true;
            }
        }
    }

    let mut n_comp = 0u32;
    for r in &mut rounds {
        if r.is_knife {
            r.number = 0;
        } else {
            n_comp += 1;
            r.number = n_comp;
        }
    }
    if let Some(r) = rounds.last_mut() {
        if r.winner.is_none() {
            if let Some(w) = c.final_winner {
                r.winner = Some(w);
                r.win_reason = c.final_reason;
            }
        }
        if r.end_tick == 0 {
            r.end_tick = c.last_cap;
        }
    }
    rounds
}

/// First `cs_pre_restart` after live play ends — GOTV post-round / win panel beat.
fn playback_end_tick(c: &Collector, start: u32, end_tick: u32, next_start: Option<u32>) -> u32 {
    let bound = next_start.unwrap_or(c.last_cap);
    c.pre_restarts
        .iter()
        .find(|&&t| t > end_tick && t >= start && t <= bound)
        .copied()
        .unwrap_or(0)
}

/// Prefer the tick when `m_iRoundWinStatus` flips (in-game round over).
/// `round_officially_ended` often lands on the next freeze, which kept the C4 clock up.
fn round_conclusion(
    c: &Collector,
    start: u32,
    next_start: Option<u32>,
) -> (u32, Option<Side>, i32) {
    let bound = next_start.unwrap_or(c.last_cap);
    let last = next_start
        .map(|s| s.saturating_sub(1))
        .unwrap_or(c.last_cap);
    let in_round = |t: u32| t >= start && t <= last;
    if let Some(&(t, w, r)) = c.synth_ends.iter().find(|(t, _, _)| in_round(*t)) {
        return (t.min(last), w, r);
    }
    if let Some(&(t, w, r)) = c
        .official_ends
        .iter()
        .find(|(t, _, _)| *t >= start && *t <= bound)
    {
        return (t.min(last), w, r);
    }
    (last.min(bound).max(start), None, 0)
}

fn build_grenades(
    c: &Collector,
    idx_of: &impl Fn(Option<u64>) -> i8,
    tick_rate: f32,
    rounds: &[Round],
) -> Vec<GrenadeThrow> {
    let gap = c
        .opts
        .tick_stride
        .max(1)
        .saturating_mul(GRENADE_DET_LATE_STRIDES);
    // Entity handle order. A `HashMap` here used to change both grenade order
    // and which flight claimed a detonation.
    let mut by_entity: BTreeMap<u32, Vec<ProjSample>> = BTreeMap::new();
    for (entity, tick, kind, x, y, z, thrower) in &c.proj_points {
        by_entity
            .entry(*entity)
            .or_default()
            .push((*tick, *kind, *x, *y, *z, *thrower));
    }

    let mut flights: Vec<Flight> = Vec::new();
    for (entity, mut points) in by_entity {
        points.sort_by_key(|point| point.0);
        for segment in split_proj_track(points, gap) {
            if let Some(flight) = Flight::from_segment(entity, segment) {
                flights.push(flight);
            }
        }
    }
    flights.sort_by_key(|flight| (flight.entity, flight.start_tick));

    let dets: Vec<DetEvent> = c
        .grenade_dets
        .iter()
        .map(|det| DetEvent {
            tick: det.tick,
            kind: det.kind,
            entity: det.entity,
            x: det.x,
            y: det.y,
            z: det.z,
            thrower: det.thrower,
            source: det.source,
        })
        .collect();
    let claimed = assign_detonations(&flights, &dets, gap);

    let mut out: Vec<BuiltGrenade> = Vec::with_capacity(flights.len() + dets.len());
    for (flight_index, flight) in flights.iter().enumerate() {
        let matched = claimed[flight_index].map(|det_index| &dets[det_index]);
        let inferno = matched.and_then(|det| {
            if det.source == GrenadeDetSource::InfernoStart {
                Some(det.entity)
            } else {
                None
            }
        });
        let (detonate_tick, land_x, land_y, land_z, end_tick) = if let Some(det) = matched {
            let end_tick =
                grenade_end_tick(c, det, Some(flight.kind), flight.thrower, tick_rate, rounds);
            (det.tick, det.x, det.y, det.z, end_tick)
        } else {
            (
                flight.last_tick,
                flight.last_x,
                flight.last_y,
                flight.last_z,
                default_end(flight.kind, flight.last_tick, tick_rate),
            )
        };
        let mut points: Vec<GrenadePoint> = flight
            .samples
            .iter()
            .filter(|sample| sample.0 <= detonate_tick)
            .map(|sample| GrenadePoint {
                tick: sample.0,
                x: sample.2,
                y: sample.3,
                z: sample.4,
            })
            .collect();
        if points.last().map(|point| point.tick) != Some(detonate_tick) {
            points.push(GrenadePoint {
                tick: detonate_tick,
                x: land_x,
                y: land_y,
                z: land_z,
            });
        }
        out.push(BuiltGrenade {
            sort_entity: flight.entity,
            inferno,
            grenade: GrenadeThrow {
                thrower: idx_of(flight.thrower),
                kind: flight.kind,
                start_tick: flight.start_tick,
                detonate_tick,
                end_tick,
                points,
                fires: Vec::new(),
            },
        });
    }

    let mut used = vec![false; dets.len()];
    for det_index in claimed.into_iter().flatten() {
        used[det_index] = true;
    }
    for (det_index, det) in dets.iter().enumerate() {
        if used[det_index] {
            continue;
        }
        if det.kind.is_fire() {
            let nearby = out.iter().any(|built| {
                built.grenade.kind.is_fire()
                    && built.grenade.detonate_tick.abs_diff(det.tick) <= 48
                    && built
                        .grenade
                        .points
                        .last()
                        .is_some_and(|point| (point.x - det.x).hypot(point.y - det.y) < 400.0)
            });
            if nearby {
                continue;
            }
        }
        let end_tick = grenade_end_tick(c, det, None, det.thrower, tick_rate, rounds);
        // No projectile entity: sort after flights that spawned on this tick.
        let inferno = if det.source == GrenadeDetSource::InfernoStart {
            Some(det.entity)
        } else {
            None
        };
        out.push(BuiltGrenade {
            sort_entity: u32::MAX,
            inferno,
            grenade: GrenadeThrow {
                thrower: -1,
                kind: det.kind,
                start_tick: det.tick,
                detonate_tick: det.tick,
                end_tick,
                points: vec![GrenadePoint {
                    tick: det.tick,
                    x: det.x,
                    y: det.y,
                    z: det.z,
                }],
                fires: Vec::new(),
            },
        });
    }

    // `(start_tick, entity)`, not start tick alone, so two throws in the same
    // tick stay in entity order instead of whatever map bucket came first.
    out.sort_by(|left, right| {
        left.grenade
            .start_tick
            .cmp(&right.grenade.start_tick)
            .then(left.sort_entity.cmp(&right.sort_entity))
    });
    let inferno_of: Vec<Option<i32>> = out.iter().map(|built| built.inferno).collect();
    let mut grenades: Vec<GrenadeThrow> = out.into_iter().map(|built| built.grenade).collect();
    let open_end = open_fire_ends(c, &grenades, &inferno_of);
    attach_molotov_fires(c, &mut grenades, &inferno_of);
    apply_open_fire_ends(c, &mut grenades, &inferno_of, &open_end);
    grenades
}

struct BuiltGrenade {
    sort_entity: u32,
    /// Inferno entity from `inferno_startburn`, if this grenade was paired to one.
    inferno: Option<i32>,
    grenade: GrenadeThrow,
}

struct Flight {
    entity: u32,
    kind: GrenadeKind,
    thrower: Option<u64>,
    start_tick: u32,
    last_tick: u32,
    last_x: f32,
    last_y: f32,
    last_z: f32,
    samples: Vec<ProjSample>,
}

impl Flight {
    fn from_segment(entity: u32, samples: Vec<ProjSample>) -> Option<Self> {
        let (first, rest) = samples.split_first()?;
        let last = rest.last().copied().unwrap_or(*first);
        let kind = first.1;
        let start_tick = first.0;
        let thrower = samples.iter().find_map(|sample| sample.5);
        Some(Self {
            entity,
            kind,
            thrower,
            start_tick,
            last_tick: last.0,
            last_x: last.2,
            last_y: last.3,
            last_z: last.4,
            samples,
        })
    }
}

struct DetEvent {
    tick: u32,
    kind: GrenadeKind,
    entity: i32,
    x: f32,
    y: f32,
    z: f32,
    thrower: Option<u64>,
    source: GrenadeDetSource,
}

/// Earliest `inferno_expire` / `smokegrenade_expired` for this entity at or after `start`.
/// Entity id is an exact pair (inferno 415 start 13422 expires at 13872). Vec order is irrelevant.
fn paired_end(ends: &[(i32, u32)], entity: i32, start: u32) -> Option<u32> {
    ends.iter()
        .filter(|(id, tick)| *id == entity && *tick >= start)
        .map(|(_, tick)| *tick)
        .min()
}

/// Which flight owns each detonation, or `None` when that flight has no match.
///
/// `inferno_startburn` is primary for molotov and incendiary. Its `entity` is the
/// inferno, not the projectile, so it never matches on entity id. The thrower's
/// latest molotov/incendiary whose last sample is at or before the burn tick wins;
/// then the smallest distance from that last position to the burn position; then
/// the lower projectile entity index. Pairs are sorted, so map iteration cannot
/// change the claim. A contested projectile goes to the burn it disappeared just
/// before (smallest `burn_tick - last_tick` among equal last ticks).
///
/// `molotov_detonate` and other projectile detonates are optional. They run after
/// startburn and only claim a flight startburn left free. A named projectile
/// (`entity > 0`) stays on that entity. An unnamed one uses the nearest tick,
/// then the lower entity index.
fn assign_detonations(flights: &[Flight], dets: &[DetEvent], gap: u32) -> Vec<Option<usize>> {
    let mut assigned = vec![None; flights.len()];
    let mut flight_used = vec![false; flights.len()];
    let mut det_used = vec![false; dets.len()];
    assign_inferno_starts(
        flights,
        dets,
        &mut assigned,
        &mut flight_used,
        &mut det_used,
    );
    assign_projectile_dets(
        flights,
        dets,
        gap,
        &mut assigned,
        &mut flight_used,
        &mut det_used,
    );
    assigned
}

struct InfernoPair {
    last_tick: u32,
    gap: u32,
    dist2: f32,
    entity: u32,
    det_entity: i32,
    det_index: usize,
    flight_index: usize,
}

fn assign_inferno_starts(
    flights: &[Flight],
    dets: &[DetEvent],
    assigned: &mut [Option<usize>],
    flight_used: &mut [bool],
    det_used: &mut [bool],
) {
    let mut pairs: Vec<InfernoPair> = Vec::new();
    for (flight_index, flight) in flights.iter().enumerate() {
        if !flight.kind.is_fire() {
            continue;
        }
        let Some(thrower) = flight.thrower else {
            continue;
        };
        for (det_index, det) in dets.iter().enumerate() {
            if det.source != GrenadeDetSource::InfernoStart || det.thrower != Some(thrower) {
                continue;
            }
            if flight.last_tick > det.tick {
                continue;
            }
            pairs.push(InfernoPair {
                last_tick: flight.last_tick,
                gap: det.tick - flight.last_tick,
                dist2: position_dist2(flight, det),
                entity: flight.entity,
                det_entity: det.entity,
                det_index,
                flight_index,
            });
        }
    }
    pairs.sort_by(|left, right| {
        right
            .last_tick
            .cmp(&left.last_tick)
            .then(left.gap.cmp(&right.gap))
            .then(left.dist2.total_cmp(&right.dist2))
            .then(left.entity.cmp(&right.entity))
            .then(left.det_entity.cmp(&right.det_entity))
            .then(left.det_index.cmp(&right.det_index))
            .then(left.flight_index.cmp(&right.flight_index))
    });
    for pair in pairs {
        if flight_used[pair.flight_index] || det_used[pair.det_index] {
            continue;
        }
        flight_used[pair.flight_index] = true;
        det_used[pair.det_index] = true;
        assigned[pair.flight_index] = Some(pair.det_index);
    }
}

fn position_dist2(flight: &Flight, det: &DetEvent) -> f32 {
    let dx = flight.last_x - det.x;
    let dy = flight.last_y - det.y;
    let dz = flight.last_z - det.z;
    dx * dx + dy * dy + dz * dz
}

fn assign_projectile_dets(
    flights: &[Flight],
    dets: &[DetEvent],
    gap: u32,
    assigned: &mut [Option<usize>],
    flight_used: &mut [bool],
    det_used: &mut [bool],
) {
    let mut pairs: Vec<(u32, u32, usize, usize)> = Vec::new();
    for (flight_index, flight) in flights.iter().enumerate() {
        if flight_used[flight_index] {
            continue;
        }
        for (det_index, det) in dets.iter().enumerate() {
            if det_used[det_index] || det.source != GrenadeDetSource::Projectile {
                continue;
            }
            // An airburst has no inferno. Leave detonate_tick at the projectile's
            // last sample instead of a molotov_detonate that never started a fire.
            if flight.kind.is_fire() || det.kind.is_fire() {
                continue;
            }
            if det.kind != flight.kind || !detonation_in_flight(flight, det.tick, gap) {
                continue;
            }
            if det.entity > 0 && det.entity as u32 != flight.entity {
                continue;
            }
            pairs.push((
                flight.last_tick.abs_diff(det.tick),
                flight.entity,
                det_index,
                flight_index,
            ));
        }
    }
    pairs.sort_unstable();
    for (_, _, det_index, flight_index) in pairs {
        if flight_used[flight_index] || det_used[det_index] {
            continue;
        }
        flight_used[flight_index] = true;
        det_used[det_index] = true;
        assigned[flight_index] = Some(det_index);
    }
}

fn detonation_in_flight(flight: &Flight, det_tick: u32, gap: u32) -> bool {
    det_tick.saturating_add(GRENADE_DET_LEAD_TICKS) >= flight.start_tick
        && det_tick <= flight.last_tick.saturating_add(gap)
}

type ProjSample = (u32, GrenadeKind, f32, f32, f32, Option<u64>);

fn split_proj_track(points: Vec<ProjSample>, gap: u32) -> Vec<Vec<ProjSample>> {
    let mut segs = Vec::new();
    let mut cur: Vec<ProjSample> = Vec::new();
    for p in points {
        if let Some(prev) = cur.last() {
            let dt = p.0.saturating_sub(prev.0);
            let jump = (p.2 - prev.2).hypot(p.3 - prev.3);
            if dt > gap || p.1 != prev.1 || jump > 1200.0 {
                segs.push(std::mem::take(&mut cur));
            }
        }
        cur.push(p);
    }
    if !cur.is_empty() {
        segs.push(cur);
    }
    segs
}

fn default_end(kind: GrenadeKind, detonate: u32, tick_rate: f32) -> u32 {
    let secs = match kind {
        GrenadeKind::Smoke => SMOKE_SECONDS,
        GrenadeKind::Molotov | GrenadeKind::Incendiary => MOLOTOV_SECONDS,
        GrenadeKind::He | GrenadeKind::Decoy => HE_DECOY_SECONDS,
        GrenadeKind::Flash => FLASH_POP_SECONDS,
    };
    detonate.saturating_add((secs * tick_rate).round() as u32)
}

/// `inferno_expire` when the demo has one. A burn with no expire keeps going
/// for [`INCENDIARY_BURN_TICKS`] or [`MOLOTOV_BURN_TICKS`], capped at the next
/// freeze or the last demo tick. Smoke puts a fire out with an earlier expire,
/// so that tick stays.
fn grenade_end_tick(
    c: &Collector,
    det: &DetEvent,
    projectile: Option<GrenadeKind>,
    thrower: Option<u64>,
    tick_rate: f32,
    rounds: &[Round],
) -> u32 {
    if let Some(end) = paired_end(&c.grenade_ends, det.entity, det.tick) {
        return end;
    }
    let projectile_fire = projectile.filter(|kind| kind.is_fire());
    if det.source == GrenadeDetSource::InfernoStart
        && (det.kind.is_fire() || projectile_fire.is_some())
    {
        let kind = projectile_fire.or_else(|| thrown_fire_kind(&c.fire_throws, thrower, det.tick));
        return missing_expire_end(kind, det.tick, rounds, c.last_cap);
    }
    default_end(det.kind, det.tick, tick_rate)
}

/// Latest `weapon_fire` of a molotov or incendiary by this thrower at or before the burn.
fn thrown_fire_kind(
    throws: &[(u32, u64, GrenadeKind)],
    thrower: Option<u64>,
    burn_tick: u32,
) -> Option<GrenadeKind> {
    let thrower = thrower?;
    throws
        .iter()
        .enumerate()
        .filter(|(_, (tick, steam, _))| *steam == thrower && *tick <= burn_tick)
        .max_by_key(|(index, (tick, _, _))| (*tick, *index))
        .map(|(_, (_, _, kind))| *kind)
}

/// End tick of a fire that has no `inferno_expire`.
///
/// Incendiary is 352 ticks, molotov and an unknown type are 450. The fire keeps
/// burning after the current round's `end_tick`. Stop at the next freeze start,
/// or at the last demo tick when this is the last round.
///
/// assets-v1 demos do not emit `round_start`, so `Round.start_tick` is the
/// freeze end. The freeze start is [`FREEZE_START_AFTER_PRE_RESTART_TICKS`]
/// after that round's `cs_pre_restart` (`playback_end_tick`).
fn missing_expire_end(
    kind: Option<GrenadeKind>,
    burn_tick: u32,
    rounds: &[Round],
    last_cap: u32,
) -> u32 {
    let life = match kind {
        Some(GrenadeKind::Incendiary) => INCENDIARY_BURN_TICKS,
        _ => MOLOTOV_BURN_TICKS,
    };
    let natural = burn_tick.saturating_add(life);
    let next_start = rounds
        .iter()
        .map(|round| round.start_tick)
        .filter(|start| *start > burn_tick)
        .min();
    let from_restart = rounds
        .iter()
        .rev()
        .find(|round| round.start_tick <= burn_tick)
        .filter(|round| round.playback_end_tick > burn_tick)
        .map(|round| {
            round
                .playback_end_tick
                .saturating_add(FREEZE_START_AFTER_PRE_RESTART_TICKS)
        });
    let demo_end = (last_cap >= burn_tick).then_some(last_cap);
    let horizon = [next_start, from_restart, demo_end]
        .into_iter()
        .flatten()
        .min();
    match horizon {
        Some(end) => natural.min(end).max(burn_tick),
        None => natural,
    }
}

/// Lifetime already chosen for a burn with no expire, before flame samples shorten it.
fn open_fire_ends(
    c: &Collector,
    grenades: &[GrenadeThrow],
    inferno_of: &[Option<i32>],
) -> Vec<Option<u32>> {
    grenades
        .iter()
        .zip(inferno_of)
        .map(|(grenade, inferno)| {
            let entity = (*inferno)?;
            if !grenade.kind.is_fire() {
                return None;
            }
            if paired_end(&c.grenade_ends, entity, grenade.detonate_tick).is_some() {
                return None;
            }
            Some(grenade.end_tick)
        })
        .collect()
}

/// Put the no-expire lifetime back after sampled flames, and stop every cell there.
fn apply_open_fire_ends(
    c: &Collector,
    grenades: &mut [GrenadeThrow],
    inferno_of: &[Option<i32>],
    planned: &[Option<u32>],
) {
    for ((grenade, inferno), planned) in grenades.iter_mut().zip(inferno_of).zip(planned) {
        let Some(limit) = *planned else {
            continue;
        };
        let mut end = limit;
        if let Some(entity) = *inferno {
            if let Some(ext) = paired_end(&c.inferno_extinguish, entity, grenade.detonate_tick) {
                if ext >= grenade.detonate_tick {
                    end = end.min(ext);
                }
            }
        }
        grenade.end_tick = end;
        grenade.fires.retain(|cell| cell.start_tick <= end);
        for cell in &mut grenade.fires {
            cell.end_tick = end;
        }
    }
}

/// Fire cells belong to the inferno that was paired to a grenade. An airburst
/// has no `inferno_startburn`, so it keeps an empty `fires` list. Spans are
/// grouped in a `BTreeMap` and sorted, so claim order does not follow a `HashMap`.
fn attach_molotov_fires(c: &Collector, grenades: &mut [GrenadeThrow], inferno_of: &[Option<i32>]) {
    if c.fire_spans.is_empty() || grenades.is_empty() {
        return;
    }
    let mut by_entity: BTreeMap<u32, Vec<&crate::observer::FireSpan>> = BTreeMap::new();
    for span in &c.fire_spans {
        by_entity.entry(span.entity).or_default().push(span);
    }
    for spans in by_entity.values_mut() {
        spans.sort_by(|left, right| {
            left.start_tick
                .cmp(&right.start_tick)
                .then(left.end_tick.cmp(&right.end_tick))
                .then(left.x.total_cmp(&right.x))
                .then(left.y.total_cmp(&right.y))
        });
    }

    for (entity, spans) in by_entity {
        let Some(index) = inferno_of
            .iter()
            .position(|inferno| *inferno == Some(entity as i32))
        else {
            continue;
        };
        if index >= grenades.len() || !grenades[index].kind.is_fire() {
            continue;
        }
        let burn_tick = grenades[index].detonate_tick;
        let expire = paired_end(&c.grenade_ends, entity as i32, burn_tick);
        let extinguish = paired_end(&c.inferno_extinguish, entity as i32, burn_tick);
        // No expire: the grenade end is already the round or demo tick. Flame
        // cells must not keep burning past that close.
        let closed = if expire.is_none() {
            Some(grenades[index].end_tick)
        } else {
            None
        };
        let mut cells = Vec::new();
        for span in spans {
            let mut end = span.end_tick;
            if let Some(limit) = closed {
                if limit < span.start_tick {
                    continue;
                }
                end = end.min(limit);
            }
            if let Some(ext) = extinguish {
                if ext < span.start_tick {
                    continue;
                }
                end = end.min(ext);
            }
            cells.push(FireCell {
                x: span.x,
                y: span.y,
                start_tick: span.start_tick,
                end_tick: end.max(span.start_tick),
            });
        }
        if let Some(ext) = extinguish {
            grenades[index].end_tick = grenades[index].end_tick.min(ext);
        }
        if cells.is_empty() {
            continue;
        }
        let last_flame = cells
            .iter()
            .map(|cell| cell.end_tick)
            .max()
            .unwrap_or(burn_tick);
        grenades[index].fires = cells;
        grenades[index].end_tick = last_flame.min(grenades[index].end_tick);
    }
}

fn fill_missing_bomb_positions(events: &mut [BombEvent], ticks: &TickBuffer) {
    for e in events {
        if e.x != 0.0 || e.y != 0.0 || e.player < 0 {
            continue;
        }
        let frame = ticks.frame_index_at_tick(e.tick);
        let Some(tp) = ticks.player_at(frame, e.player as usize) else {
            continue;
        };
        if tp.flags & FLAG_PRESENT == 0 {
            continue;
        }
        e.x = tp.x;
        e.y = tp.y;
        e.z = tp.z;
    }
}

const GEAR_BUYS: [(u16, u8); 11] = [
    (GEAR_KEVLAR, WID_KEVLAR),
    (GEAR_HELMET, WID_HELMET),
    (GEAR_DEFUSER, WID_DEFUSER),
    (GEAR_ZEUS, WID_TASER),
    (GEAR_HE, WID_HE),
    (GEAR_FLASH, WID_FLASH),
    (GEAR_FLASH2, WID_FLASH),
    (GEAR_SMOKE, WID_SMOKE),
    (GEAR_MOLLY, WID_MOLLY),
    (GEAR_INC, WID_INC),
    (GEAR_DECOY, WID_DECOY),
];

/// Freeze-time cart: new guns/gear while money drops. No `item_purchase` on GOTV.
fn freeze_buys(ticks: &TickBuffer, rounds: &[Round]) -> Vec<BuyEvent> {
    let mut out = Vec::new();
    let pc = ticks.player_count as usize;
    if pc == 0 || ticks.frame_count == 0 {
        return out;
    }
    for round in rounds {
        if round.is_knife {
            continue;
        }
        let start = round.start_tick;
        let end = round.freeze_end_tick.max(start);
        for player in 0..pc {
            let mut prev: Option<(u16, u8, u8, u16)> = None;
            for f in 0..ticks.frame_count as usize {
                let t = ticks.ticks[f];
                if t > end {
                    break;
                }
                let Some(p) = ticks.player_at(f, player) else {
                    continue;
                };
                if t < start {
                    prev = Some((p.money, p.primary, p.secondary, p.gear));
                    continue;
                }
                if p.flags & FLAG_PRESENT == 0 {
                    continue;
                }
                let Some((pm, pp, ps, pg)) = prev else {
                    prev = Some((p.money, p.primary, p.secondary, p.gear));
                    continue;
                };
                if p.money < pm {
                    for wid in appeared_items(pp, ps, pg, p.primary, p.secondary, p.gear) {
                        let cost = weapon_buy_cost(wid);
                        if cost == 0 {
                            continue;
                        }
                        out.push(BuyEvent {
                            tick: t,
                            player: player as i8,
                            weapon: wid,
                            cost,
                        });
                    }
                }
                prev = Some((p.money, p.primary, p.secondary, p.gear));
            }
        }
    }
    out.sort_by_key(|e| (e.tick, e.player, e.weapon));
    out
}

fn appeared_items(
    prev_primary: u8,
    prev_secondary: u8,
    prev_gear: u16,
    primary: u8,
    secondary: u8,
    gear: u16,
) -> Vec<u8> {
    let mut out = Vec::new();
    if primary != 0 && primary != prev_primary {
        out.push(primary);
    }
    if secondary != 0 && secondary != prev_secondary && secondary != primary {
        out.push(secondary);
    }
    for (bit, wid) in GEAR_BUYS {
        if gear & bit != 0 && prev_gear & bit == 0 {
            out.push(wid);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::{
        DEFAULT_TICK_STRIDE, GRENADE_DET_LATE_STRIDES, INFERNO_OWNER_LAG_TICKS,
    };
    use crate::observer::{
        accept_blind_duration, bind_userid_steam, controller_dump_interesting, controller_identity,
        controller_steam_playable, fill_inferno_thrower, new_flash_duration,
        snapshot_controller_dump_now, Collector, FireSpan, GrenadeDet, GrenadeDetSource,
        PlayerMeta, RawFrame, RawFramePlayer, RawHurt, RawKill,
    };
    use crate::{bot_steam_id, is_bot_steam_id, ControllerDump, ParseOptions, FLAG_ALIVE, FLAG_CT};

    fn molly(detonate: u32, x: f32, y: f32) -> GrenadeThrow {
        GrenadeThrow {
            thrower: 0,
            kind: GrenadeKind::Molotov,
            start_tick: detonate.saturating_sub(32),
            detonate_tick: detonate,
            end_tick: detonate + 64 * 7,
            points: vec![GrenadePoint {
                tick: detonate,
                x,
                y,
                z: 0.0,
            }],
            fires: Vec::new(),
        }
    }

    #[test]
    fn playback_end_tick_from_pre_restart() {
        let mut c = Collector::new(ParseOptions::default());
        c.last_cap = 2000;
        c.freeze_ends.push(100);
        c.freeze_ends.push(1000);
        c.synth_ends.push((500, Some(Side::T), 1));
        c.synth_ends.push((1500, Some(Side::Ct), 7));
        c.pre_restarts.push(520);
        c.pre_restarts.push(1520);
        let rounds = build_rounds(&c);
        assert_eq!(rounds.len(), 2);
        assert_eq!(rounds[0].end_tick, 500);
        assert_eq!(rounds[0].playback_end_tick, 520);
        assert_eq!(rounds[1].end_tick, 1500);
        assert_eq!(rounds[1].playback_end_tick, 1520);
    }

    #[test]
    fn round_time_comes_from_the_freeze_end_sample() {
        let mut c = Collector::new(ParseOptions::default());
        c.freeze_ends.push(100);
        c.freeze_ends.push(1000);
        c.round_times.insert(100, 90);
        let rounds = build_rounds(&c);
        assert_eq!(rounds[0].round_time_s, 90);
        assert_eq!(rounds[1].round_time_s, 0);
    }

    #[test]
    fn round_time_defaults_to_zero_when_json_omits_it() {
        let json = r#"{
            "number": 1,
            "start_tick": 0,
            "freeze_end_tick": 64,
            "end_tick": 640,
            "winner": null,
            "win_reason": 0,
            "score_ct": 0,
            "score_t": 0
        }"#;
        let round: Round = serde_json::from_str(json).unwrap();
        assert_eq!(round.round_time_s, 0);
    }

    #[test]
    fn attach_fires_to_nearest_molotov() {
        let mut c = Collector::new(ParseOptions::default());
        c.fire_spans.push(FireSpan {
            entity: 10,
            x: 100.0,
            y: 120.0,
            start_tick: 200,
            end_tick: 500,
        });
        c.grenade_dets.push(fire_det(
            200,
            10,
            GrenadeDetSource::InfernoStart,
            100.0,
            120.0,
        ));
        // Same place and tick. The airburst has no inferno, so it does not take the flames.
        let mut grenades = vec![molly(200, 100.0, 120.0), molly(200, 100.0, 120.0)];
        attach_molotov_fires(&c, &mut grenades, &[Some(10), None]);
        assert_eq!(grenades[0].fires.len(), 1);
        assert!(grenades[1].fires.is_empty());
        assert_eq!(grenades[0].end_tick, 500);
        assert_eq!(grenades[0].fires[0].x, 100.0);
    }

    #[test]
    fn attach_fires_to_incendiary() {
        let mut c = Collector::new(ParseOptions::default());
        c.fire_spans.push(FireSpan {
            entity: 11,
            x: 50.0,
            y: 60.0,
            start_tick: 200,
            end_tick: 400,
        });
        c.grenade_dets.push(GrenadeDet {
            tick: 200,
            kind: GrenadeKind::Incendiary,
            entity: 11,
            x: 50.0,
            y: 60.0,
            z: 0.0,
            thrower: None,
            source: GrenadeDetSource::InfernoStart,
        });
        let mut grenades = vec![GrenadeThrow {
            thrower: 0,
            kind: GrenadeKind::Incendiary,
            start_tick: 168,
            detonate_tick: 200,
            end_tick: 200 + 64 * 7,
            points: vec![GrenadePoint {
                tick: 200,
                x: 50.0,
                y: 60.0,
                z: 0.0,
            }],
            fires: Vec::new(),
        }];
        attach_molotov_fires(&c, &mut grenades, &[Some(11)]);
        assert_eq!(grenades[0].fires.len(), 1);
        assert_eq!(grenades[0].end_tick, 400);
    }

    #[test]
    fn airburst_molotov_keeps_disappearance_tick_and_empty_fires() {
        let thrower = 7u64;
        let mut c = Collector::new(ParseOptions::default());
        c.proj_points
            .push((4, 100, GrenadeKind::Molotov, 10.0, 10.0, 0.0, Some(thrower)));
        c.proj_points
            .push((4, 140, GrenadeKind::Molotov, 12.0, 10.0, 0.0, Some(thrower)));
        // Flames from someone else's inferno sit on this projectile. They must not attach.
        c.fire_spans.push(FireSpan {
            entity: 99,
            x: 12.0,
            y: 10.0,
            start_tick: 140,
            end_tick: 400,
        });
        c.grenade_dets.push(GrenadeDet {
            tick: 140,
            kind: GrenadeKind::Molotov,
            entity: 99,
            x: 12.0,
            y: 10.0,
            z: 0.0,
            thrower: Some(8),
            source: GrenadeDetSource::InfernoStart,
        });
        c.grenade_dets.push(GrenadeDet {
            tick: 130,
            kind: GrenadeKind::Molotov,
            entity: 4,
            x: 12.0,
            y: 10.0,
            z: 0.0,
            thrower: None,
            source: GrenadeDetSource::Projectile,
        });
        let grenades = build_grenades(&c, &|_| 1, 64.0, &[]);
        let airburst = grenades
            .iter()
            .find(|grenade| grenade.start_tick == 100)
            .unwrap_or_else(|| panic!("airburst flight missing"));
        assert_eq!(airburst.detonate_tick, 140);
        assert_ne!(airburst.detonate_tick, 0);
        assert!(airburst.fires.is_empty());
    }

    #[test]
    fn extinguished_fire_ends_at_inferno_extinguish() {
        let mut c = Collector::new(ParseOptions::default());
        c.fire_spans.push(FireSpan {
            entity: 415,
            x: 4.0,
            y: 5.0,
            start_tick: 13422,
            end_tick: 13870,
        });
        c.inferno_extinguish.push((415, 13600));
        let mut grenades = vec![GrenadeThrow {
            thrower: 1,
            kind: GrenadeKind::Molotov,
            start_tick: 13314,
            detonate_tick: 13422,
            end_tick: 13872,
            points: vec![GrenadePoint {
                tick: 13422,
                x: 4.0,
                y: 5.0,
                z: 0.0,
            }],
            fires: Vec::new(),
        }];
        attach_molotov_fires(&c, &mut grenades, &[Some(415)]);
        assert_eq!(grenades[0].fires.len(), 1);
        assert_eq!(grenades[0].fires[0].end_tick, 13600);
        assert_eq!(grenades[0].end_tick, 13600);
    }

    #[test]
    fn missing_expire_clamps_fire_to_round_or_demo_end() {
        let thrower = 42u64;
        let burn = 1000u32;
        // Sampled flames die at the round, before either lifetime.
        let span_end = 1100u32;
        let far = 8000u32;

        let inc =
            burning_without_expire(GrenadeKind::Incendiary, thrower, burn, span_end, far, &[]);
        assert_eq!(inc.kind, GrenadeKind::Incendiary);
        assert_eq!(inc.detonate_tick, burn);
        assert_eq!(inc.end_tick, burn + INCENDIARY_BURN_TICKS);
        assert_eq!(inc.fires.len(), 1);
        assert_eq!(inc.fires[0].end_tick, burn + INCENDIARY_BURN_TICKS);

        let molo = burning_without_expire(GrenadeKind::Molotov, thrower, burn, span_end, far, &[]);
        assert_eq!(molo.kind, GrenadeKind::Molotov);
        assert_eq!(molo.end_tick, burn + MOLOTOV_BURN_TICKS);
        assert_eq!(molo.fires[0].end_tick, burn + MOLOTOV_BURN_TICKS);

        // Next freeze is 1300. The current round ends at 1100 and must not close the fire.
        let mut this_round = freeze_round();
        this_round.start_tick = 64;
        this_round.end_tick = span_end;
        let mut next_round = freeze_round();
        next_round.start_tick = 1300;
        next_round.end_tick = 2000;
        let at_next_freeze = burning_without_expire(
            GrenadeKind::Molotov,
            thrower,
            burn,
            2000,
            far,
            &[this_round.clone(), next_round],
        );
        assert_eq!(at_next_freeze.end_tick, 1300);
        assert_eq!(at_next_freeze.fires[0].end_tick, 1300);
        assert_ne!(at_next_freeze.end_tick, this_round.end_tick);

        // No `round_start`: the next stored start is the freeze end. The freeze
        // itself starts 19 ticks after `cs_pre_restart`.
        let mut restarted = freeze_round();
        restarted.start_tick = 64;
        restarted.end_tick = 900;
        restarted.playback_end_tick = 1200;
        let mut live_later = freeze_round();
        live_later.start_tick = 3000;
        live_later.freeze_end_tick = 3000;
        live_later.end_tick = 4000;
        let at_restart = burning_without_expire(
            GrenadeKind::Molotov,
            thrower,
            burn,
            2000,
            far,
            &[restarted, live_later],
        );
        let freeze_start = 1200 + FREEZE_START_AFTER_PRE_RESTART_TICKS;
        assert_eq!(at_restart.end_tick, freeze_start);
        assert_eq!(at_restart.fires[0].end_tick, freeze_start);

        let at_demo_end = burning_without_expire(
            GrenadeKind::Molotov,
            thrower,
            burn,
            2000,
            1200,
            &[this_round],
        );
        assert_eq!(at_demo_end.end_tick, 1200);
        assert_eq!(at_demo_end.fires[0].end_tick, 1200);

        let from_weapon_fire =
            burning_from_weapon_fire(thrower, burn, Some(GrenadeKind::Incendiary));
        assert_eq!(from_weapon_fire.end_tick, burn + INCENDIARY_BURN_TICKS);
        let unknown = burning_from_weapon_fire(thrower, burn, None);
        assert_eq!(unknown.end_tick, burn + MOLOTOV_BURN_TICKS);
    }

    fn burning_without_expire(
        kind: GrenadeKind,
        thrower: u64,
        burn: u32,
        span_end: u32,
        last_cap: u32,
        rounds: &[Round],
    ) -> GrenadeThrow {
        let mut c = Collector::new(ParseOptions::default());
        c.last_cap = last_cap;
        c.proj_points.push((
            7,
            burn.saturating_sub(20),
            kind,
            1.0,
            2.0,
            3.0,
            Some(thrower),
        ));
        c.proj_points
            .push((7, burn, kind, 4.0, 5.0, 6.0, Some(thrower)));
        // startburn itself is stored as molotov; the projectile class is the type.
        c.grenade_dets.push(GrenadeDet {
            tick: burn,
            kind: GrenadeKind::Molotov,
            entity: 415,
            x: 4.0,
            y: 5.0,
            z: 6.0,
            thrower: Some(thrower),
            source: GrenadeDetSource::InfernoStart,
        });
        c.fire_spans.push(FireSpan {
            entity: 415,
            x: 4.0,
            y: 5.0,
            start_tick: burn,
            end_tick: span_end,
        });
        build_grenades(&c, &|_| 1, DEFAULT_TICK_RATE, rounds)
            .into_iter()
            .next()
            .unwrap_or_else(|| panic!("burning molotov missing"))
    }

    fn burning_from_weapon_fire(
        thrower: u64,
        burn: u32,
        kind: Option<GrenadeKind>,
    ) -> GrenadeThrow {
        let mut c = Collector::new(ParseOptions::default());
        c.last_cap = 8000;
        if let Some(kind) = kind {
            c.fire_throws.push((burn.saturating_sub(30), thrower, kind));
        }
        c.grenade_dets.push(GrenadeDet {
            tick: burn,
            kind: GrenadeKind::Molotov,
            entity: 415,
            x: 4.0,
            y: 5.0,
            z: 6.0,
            thrower: Some(thrower),
            source: GrenadeDetSource::InfernoStart,
        });
        build_grenades(&c, &|_| 1, DEFAULT_TICK_RATE, &[])
            .into_iter()
            .next()
            .unwrap_or_else(|| panic!("unmatched burn missing"))
    }

    #[test]
    fn inferno_owner_fills_only_the_recent_startburn() {
        let mut dets = vec![
            GrenadeDet {
                tick: 1000,
                kind: GrenadeKind::Molotov,
                entity: 415,
                x: 0.0,
                y: 0.0,
                z: 0.0,
                thrower: None,
                source: GrenadeDetSource::InfernoStart,
            },
            GrenadeDet {
                tick: 13420,
                kind: GrenadeKind::Molotov,
                entity: 415,
                x: 0.0,
                y: 0.0,
                z: 0.0,
                thrower: Some(9),
                source: GrenadeDetSource::InfernoStart,
            },
            GrenadeDet {
                tick: 13422,
                kind: GrenadeKind::Molotov,
                entity: 415,
                x: 0.0,
                y: 0.0,
                z: 0.0,
                thrower: None,
                source: GrenadeDetSource::InfernoStart,
            },
        ];
        fill_inferno_thrower(&mut dets, 415, 13423, 42, INFERNO_OWNER_LAG_TICKS);
        assert_eq!(dets[0].thrower, None);
        assert_eq!(dets[1].thrower, Some(9));
        assert_eq!(dets[2].thrower, Some(42));
    }

    #[test]
    fn same_thrower_latest_molotov_before_startburn_wins() {
        let thrower = 1001u64;
        // Closer to the burn, but the projectile disappeared earlier.
        let early = flight_at(
            2,
            GrenadeKind::Molotov,
            Some(thrower),
            80,
            100,
            (10.0, 10.0, 0.0),
        );
        // Farther, and gone at the burn tick. Latest disappearance wins.
        let late = flight_at(
            9,
            GrenadeKind::Molotov,
            Some(thrower),
            90,
            112,
            (80.0, 0.0, 0.0),
        );
        // Still in the air after the burn, so it is not a candidate.
        let after = flight_at(
            3,
            GrenadeKind::Molotov,
            Some(thrower),
            100,
            113,
            (10.0, 10.0, 0.0),
        );
        let dets = vec![startburn(112, 415, Some(thrower), 10.0, 10.0, 0.0)];
        assert_eq!(
            assign_detonations(&[early, late, after], &dets, 0),
            vec![None, Some(0), None]
        );
    }

    #[test]
    fn startburn_tie_breaks_distance_then_entity() {
        let thrower = 1001u64;
        let gap = DEFAULT_TICK_STRIDE * GRENADE_DET_LATE_STRIDES;
        let far = flight_at(
            1,
            GrenadeKind::Molotov,
            Some(thrower),
            50,
            100,
            (40.0, 0.0, 0.0),
        );
        let near_high = flight_at(
            8,
            GrenadeKind::Molotov,
            Some(thrower),
            50,
            100,
            (3.0, 0.0, 0.0),
        );
        let near_low = flight_at(
            4,
            GrenadeKind::Incendiary,
            Some(thrower),
            50,
            100,
            (-3.0, 0.0, 0.0),
        );
        let dets = vec![startburn(100, 415, Some(thrower), 0.0, 0.0, 0.0)];
        // Same disappearance tick. Entity 1 is farther, so it loses to either
        // neighbor. Entity 4 and 8 are the same distance, so the lower index wins.
        assert_eq!(
            assign_detonations(&[far, near_high, near_low], &dets, gap),
            vec![None, None, Some(0)]
        );
    }

    #[test]
    fn two_throwers_same_tick_follow_userid() {
        let thrower_a = 11u64;
        let thrower_b = 22u64;
        // B's grenade sits on A's burn, and the reverse. Thrower still wins.
        let flight_a = flight_at(
            4,
            GrenadeKind::Molotov,
            Some(thrower_a),
            50,
            100,
            (500.0, 0.0, 0.0),
        );
        let flight_b = flight_at(
            7,
            GrenadeKind::Incendiary,
            Some(thrower_b),
            50,
            100,
            (0.0, 0.0, 0.0),
        );
        let dets = vec![
            startburn(100, 415, Some(thrower_a), 0.0, 0.0, 0.0),
            startburn(100, 416, Some(thrower_b), 500.0, 0.0, 0.0),
        ];
        assert_eq!(
            assign_detonations(&[flight_a, flight_b], &dets, 0),
            vec![Some(0), Some(1)]
        );
    }

    #[test]
    fn inferno_expire_pairs_by_entity_id() {
        let thrower = 42u64;
        let mut c = Collector::new(ParseOptions::default());
        c.proj_points
            .push((7, 13400, GrenadeKind::Molotov, 1.0, 2.0, 3.0, Some(thrower)));
        c.proj_points
            .push((7, 13420, GrenadeKind::Molotov, 4.0, 5.0, 6.0, Some(thrower)));
        c.grenade_dets.push(GrenadeDet {
            tick: 13422,
            kind: GrenadeKind::Molotov,
            entity: 415,
            x: 4.0,
            y: 5.0,
            z: 6.0,
            thrower: Some(thrower),
            source: GrenadeDetSource::InfernoStart,
        });
        // Optional projectile detonate must not replace the startburn tick.
        c.grenade_dets.push(GrenadeDet {
            tick: 13400,
            kind: GrenadeKind::Molotov,
            entity: 7,
            x: 1.0,
            y: 2.0,
            z: 3.0,
            thrower: None,
            source: GrenadeDetSource::Projectile,
        });
        c.grenade_ends.push((415, 12000));
        c.grenade_ends.push((999, 13800));
        c.grenade_ends.push((415, 13872));
        let grenades = build_grenades(&c, &|_| 3, 64.0, &[]);
        assert_eq!(grenades.len(), 1);
        assert_eq!(grenades[0].thrower, 3);
        assert_eq!(grenades[0].start_tick, 13400);
        assert_eq!(grenades[0].detonate_tick, 13422);
        assert_eq!(grenades[0].end_tick, 13872);
    }

    #[test]
    fn named_projectile_detonation_stays_on_its_entity() {
        let gap = DEFAULT_TICK_STRIDE * GRENADE_DET_LATE_STRIDES;
        let flights = vec![
            flight_at(2, GrenadeKind::Smoke, None, 50, 100, (0.0, 0.0, 0.0)),
            flight_at(8, GrenadeKind::Smoke, None, 50, 140, (0.0, 0.0, 0.0)),
        ];
        // Tick-nearest to entity 8, but the detonate names entity 2.
        let dets = vec![projectile_det(140, GrenadeKind::Smoke, 2)];
        assert_eq!(
            assign_detonations(&flights, &dets, gap),
            vec![Some(0), None]
        );
    }

    fn flight_at(
        entity: u32,
        kind: GrenadeKind,
        thrower: Option<u64>,
        start: u32,
        last: u32,
        pos: (f32, f32, f32),
    ) -> Flight {
        let (x, y, z) = pos;
        let mut samples = vec![(start, kind, x, y, z, thrower)];
        if last != start {
            samples.push((last, kind, x, y, z, thrower));
        }
        Flight::from_segment(entity, samples)
            .unwrap_or_else(|| panic!("flight {entity} needs a sample"))
    }

    fn startburn(tick: u32, entity: i32, thrower: Option<u64>, x: f32, y: f32, z: f32) -> DetEvent {
        DetEvent {
            tick,
            kind: GrenadeKind::Molotov,
            entity,
            x,
            y,
            z,
            thrower,
            source: GrenadeDetSource::InfernoStart,
        }
    }

    fn projectile_det(tick: u32, kind: GrenadeKind, entity: i32) -> DetEvent {
        DetEvent {
            tick,
            kind,
            entity,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            thrower: None,
            source: GrenadeDetSource::Projectile,
        }
    }

    fn fire_det(tick: u32, entity: i32, source: GrenadeDetSource, x: f32, y: f32) -> GrenadeDet {
        GrenadeDet {
            tick,
            kind: GrenadeKind::Molotov,
            entity,
            x,
            y,
            z: 0.0,
            thrower: None,
            source,
        }
    }

    #[test]
    fn assemble_copies_kill_modifier_flags() {
        let mut c = Collector::new(ParseOptions::default());
        c.kills.push(RawKill {
            tick: 100,
            attacker: None,
            victim: None,
            assister: None,
            weapon: "awp".into(),
            headshot: false,
            assisted_flash: false,
            wallbang: true,
            noscope: true,
            through_smoke: true,
            attacker_blind: true,
            attacker_airborne: true,
            x: 1.0,
            y: 2.0,
            z: 3.0,
            attacker_x: 10.0,
            attacker_y: 20.0,
            attacker_z: 30.0,
        });
        let m = assemble(&mut c, 200, 3.0);
        let k = &m.kills[0];
        assert!(k.wallbang);
        assert!(k.noscope);
        assert!(k.through_smoke);
        assert!(k.attacker_blind);
        assert!(k.attacker_airborne);
        assert_eq!(k.attacker_x, 10.0);
        assert_eq!(k.attacker_y, 20.0);
        assert_eq!(k.attacker_z, 30.0);
    }

    #[test]
    fn assemble_copies_hurt_hitgroup_and_armor() {
        let mut c = Collector::new(ParseOptions::default());
        c.hurts.push(RawHurt {
            tick: 90,
            attacker: None,
            victim: None,
            damage: 34,
            damage_armor: 15,
            hitgroup: 1,
            health: 66,
            armor: 85,
            weapon: "ak47".into(),
        });
        let m = assemble(&mut c, 200, 3.0);
        let h = &m.hurts[0];
        assert_eq!(h.damage, 34);
        assert_eq!(h.damage_armor, 15);
        assert_eq!(h.hitgroup, 1);
        assert_eq!(h.health, 66);
        assert_eq!(h.armor, 85);
    }

    #[test]
    fn new_flash_duration_only_on_increase() {
        assert_eq!(new_flash_duration(0.0, 2.4), Some(2.4));
        assert_eq!(new_flash_duration(2.4, 2.4), None);
        assert_eq!(new_flash_duration(2.4, 1.1), None);
        assert_eq!(new_flash_duration(0.0, 0.0), None);
        assert_eq!(new_flash_duration(0.02, 0.04), None);
    }

    #[test]
    fn flash_overlay_spike_matches_web_band() {
        assert!(!crate::flash_overlay_spike(1.3));
        assert!(!crate::flash_overlay_spike(4.1));
        assert!(crate::flash_overlay_spike(4.95));
        assert!(crate::flash_overlay_spike(5.0));
        assert!(crate::flash_overlay_spike(5.1));
        assert!(crate::flash_overlay_spike(crate::FLASH_FULL_SECONDS));
    }

    #[test]
    fn accept_blind_duration_rejects_overlay_from_pawn_and_player_blind() {
        // record_blind is the only writer; pawn sampling and player_blind both
        // call it. Revert the overlay check there → 5.0s enters blinds again
        // (ed5b8fa left that hole on the event path).
        assert!(
            accept_blind_duration(1.3),
            "short player_blind must enter blinds"
        );
        assert!(
            accept_blind_duration(4.1),
            "real leftover under the overlay band must enter blinds"
        );
        assert!(
            !accept_blind_duration(4.95),
            "overlay-band must not enter blinds"
        );
        assert!(
            !accept_blind_duration(5.0),
            "overlay-band must not enter blinds"
        );
        assert!(
            !accept_blind_duration(5.1),
            "overlay-band must not enter blinds"
        );
        assert!(
            !accept_blind_duration(crate::FLASH_FULL_SECONDS),
            "overlay-band must not enter blinds"
        );
        assert!(!accept_blind_duration(0.0));
    }

    #[test]
    fn leftover_disconnected_controller_is_not_sampled() {
        // steam ≠ 0 is the old FLAG_PRESENT rule. Revert controller_steam_playable
        // → leftover KatolikCOO is sampled present and the live scoreboard grows.
        let steam = 76_561_198_000_000_001;
        assert!(
            !controller_steam_playable(steam, Some(crate::PLAYER_DISCONNECTED), false),
            "ghost $0 leaver must not be sampled as live"
        );
        assert!(
            !controller_steam_playable(steam, Some(crate::PLAYER_DISCONNECTING), false),
            "ghost $0 leaver must not be sampled as live"
        );
        assert!(
            !controller_steam_playable(steam, None, true),
            "ghost $0 leaver must not be sampled as live"
        );
        assert!(
            controller_steam_playable(steam, Some(crate::PLAYER_CONNECTED), false),
            "connected human must still be sampled"
        );
        assert!(
            controller_steam_playable(steam, None, false),
            "missing m_iConnected must not drop the roster"
        );
        assert!(!controller_steam_playable(
            0,
            Some(crate::PLAYER_CONNECTED),
            false
        ));
    }

    #[test]
    fn player_connected_in_server_keeps_missing_prop() {
        assert!(crate::player_connected_in_server(None));
        assert!(crate::player_connected_in_server(Some(
            crate::PLAYER_CONNECTED
        )));
        assert!(crate::player_connected_in_server(Some(
            crate::PLAYER_CONNECTING
        )));
        assert!(crate::player_connected_in_server(Some(
            crate::PLAYER_RECONNECTING
        )));
        assert!(!crate::player_connected_in_server(Some(
            crate::PLAYER_DISCONNECTING
        )));
        assert!(!crate::player_connected_in_server(Some(
            crate::PLAYER_DISCONNECTED
        )));
        assert!(!crate::player_connected_in_server(Some(
            crate::PLAYER_RESERVED
        )));
        assert!(!crate::player_connected_in_server(Some(
            crate::PLAYER_NEVER_CONNECTED
        )));
    }

    #[test]
    fn bind_userid_steam_drops_leaver_when_bot_takes_slot() {
        let mut map = HashMap::new();
        bind_userid_steam(&mut map, 5, 76561198000000000);
        assert_eq!(map.get(&5), Some(&76561198000000000));
        bind_userid_steam(&mut map, 5, 0);
        assert!(!map.contains_key(&5));
        bind_userid_steam(&mut map, 5, 76561198000000001);
        assert_eq!(map.get(&5), Some(&76561198000000001));
        bind_userid_steam(&mut map, 5, bot_steam_id(5));
        assert_eq!(map.get(&5), Some(&bot_steam_id(5)));
    }

    fn identity(
        steam: u64,
        slot: u32,
        is_bot: bool,
        is_hltv: bool,
        connected: Option<i32>,
        previously_left: bool,
        has_team_pawn: bool,
    ) -> Option<u64> {
        controller_identity(
            steam,
            slot,
            is_bot,
            is_hltv,
            connected,
            previously_left,
            has_team_pawn,
        )
    }

    #[test]
    fn controller_identity_stays_cheap_without_entity_walks() {
        // The 55s → 140s WASM hit was `entities().iter()` + name clones on every
        // tick, not this function. 200k identity calls (≈ a full GOTV tick loop
        // over 10 slots) must stay well under a millisecond-class budget.
        let human = 76_561_198_000_000_001;
        let t0 = std::time::Instant::now();
        let mut n = 0u64;
        for i in 0..200_000u32 {
            n = n.wrapping_add(
                identity(
                    human,
                    i % 16,
                    false,
                    false,
                    Some(crate::PLAYER_CONNECTED),
                    false,
                    false,
                )
                .unwrap_or(0),
            );
            n = n.wrapping_add(
                identity(
                    0,
                    i % 16,
                    false,
                    false,
                    Some(crate::PLAYER_CONNECTED),
                    false,
                    true,
                )
                .unwrap_or(0),
            );
        }
        std::hint::black_box(n);
        assert!(
            t0.elapsed() < std::time::Duration::from_millis(50),
            "controller_identity itself is not the parse cost"
        );
    }

    #[test]
    fn steam_id_zero_bot_maps_to_synthetic_id() {
        let slot = 5;
        let bot = identity(
            0,
            slot,
            true,
            false,
            Some(crate::PLAYER_CONNECTED),
            false,
            false,
        );
        assert_eq!(bot, Some(bot_steam_id(slot)));
        assert!(is_bot_steam_id(bot.expect("bot id")));
        assert_ne!(bot, Some(0));
    }

    #[test]
    fn steam_id_zero_without_bot_flag_is_empty_slot() {
        assert_eq!(
            identity(
                0,
                5,
                false,
                false,
                Some(crate::PLAYER_CONNECTED),
                false,
                false
            ),
            None,
            "empty leftover must not become a bot"
        );
        assert_eq!(
            identity(
                0,
                5,
                true,
                false,
                Some(crate::PLAYER_DISCONNECTED),
                false,
                false
            ),
            None,
            "disconnected bot controller must not be sampled"
        );
        assert_eq!(
            identity(0, 5, true, true, Some(crate::PLAYER_CONNECTED), false, true),
            None,
            "HLTV must not become a bot player"
        );
    }

    #[test]
    fn faceit_fill_steam_zero_without_bot_flag_maps() {
        // Ancient Faceit leave→fill: steam 0, m_bIsBot unset, pawn still on T/CT.
        let id = identity(
            0,
            7,
            false,
            false,
            Some(crate::PLAYER_CONNECTED),
            false,
            true,
        );
        assert_eq!(id, Some(bot_steam_id(7)));
        let after_disconnect = identity(
            0,
            7,
            false,
            false,
            Some(crate::PLAYER_DISCONNECTED),
            false,
            true,
        );
        assert_eq!(
            after_disconnect,
            Some(bot_steam_id(7)),
            "GOTV may flag DISCONNECTED while the fill pawn is still playing"
        );
    }

    fn dump_row(steam: u64, is_bot: bool, assigned: u64) -> ControllerDump {
        ControllerDump {
            tick: 64,
            slot: 7,
            name: "Mike".into(),
            steam,
            is_bot,
            connected: crate::PLAYER_CONNECTED,
            has_team_pawn: true,
            assigned,
            at_freeze: true,
        }
    }

    #[test]
    fn controller_dump_skips_the_per_tick_hot_path() {
        assert!(
            !snapshot_controller_dump_now(false),
            "packet tick vs playback_ticks must never walk entities on the tick path"
        );
        assert!(snapshot_controller_dump_now(true));
    }

    #[test]
    fn leftover_human_dump_is_not_a_fill_candidate() {
        let human = 76_561_198_000_000_001;
        assert!(
            !controller_dump_interesting(&dump_row(human, false, 0)),
            "KatolikCOO leftover must not enter fillFreeze"
        );
        assert!(controller_dump_interesting(&dump_row(
            0,
            false,
            bot_steam_id(7)
        )));
    }

    #[test]
    fn assemble_copies_controller_dump() {
        let mut c = Collector::new(ParseOptions::default());
        let last = dump_row(0, false, bot_steam_id(7));
        c.controller_last.insert(
            7,
            ControllerDump {
                at_freeze: false,
                ..last.clone()
            },
        );
        c.controller_freeze.push(last.clone());
        let m = assemble(&mut c, 200, 3.0);
        assert_eq!(m.controller_dump.len(), 2);
        assert!(!m.controller_dump[0].at_freeze);
        assert!(m.controller_dump[1].at_freeze);
        assert_eq!(m.controller_dump[1].assigned, bot_steam_id(7));
    }

    #[test]
    fn leftover_human_pawn_is_not_a_bot() {
        let human = 76_561_198_000_000_001;
        assert_eq!(
            identity(
                human,
                5,
                false,
                false,
                Some(crate::PLAYER_DISCONNECTED),
                true,
                true
            ),
            None,
            "KatolikCOO leftover steam must not become a synthetic bot"
        );
    }

    #[test]
    fn human_disconnect_bot_fill_does_not_reuse_human_steam() {
        let human = 76_561_198_000_000_001;
        assert_eq!(
            identity(
                human,
                5,
                false,
                false,
                Some(crate::PLAYER_DISCONNECTED),
                false,
                true
            ),
            None
        );
        let bot = identity(
            0,
            5,
            false,
            false,
            Some(crate::PLAYER_CONNECTED),
            false,
            true,
        )
        .expect("Faceit fill");
        assert_ne!(bot, human);
        assert!(is_bot_steam_id(bot));
        assert!(!is_bot_steam_id(human));
    }

    fn raw_player(steam: u64, flags: u8) -> RawFramePlayer {
        RawFramePlayer {
            steam_id: steam,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            yaw: 0.0,
            health: 100,
            armor: 0,
            flags,
            money: 800,
            equip: 0,
            gear: 0,
            primary: 0,
            secondary: 0,
            active: 0,
            clip: 0,
            reserve: 0,
        }
    }

    fn meta(steam: u64, name: &str, side: Side, is_bot: bool) -> PlayerMeta {
        PlayerMeta {
            steam_id: steam,
            name: name.into(),
            start_side: side,
            is_bot,
        }
    }

    #[test]
    fn assemble_maps_bot_kill_instead_of_world() {
        let human = 76_561_198_000_000_001;
        let bot = bot_steam_id(5);
        let mut c = Collector::new(ParseOptions::default());
        c.meta_order.extend([human, bot]);
        c.meta.insert(human, meta(human, "Alice", Side::Ct, false));
        c.meta.insert(bot, meta(bot, "Mike", Side::T, true));
        c.frames.push(RawFrame {
            tick: 100,
            players: vec![
                raw_player(human, FLAG_PRESENT | FLAG_ALIVE | FLAG_CT),
                raw_player(bot, FLAG_PRESENT | FLAG_ALIVE),
            ],
        });
        c.kills.push(RawKill {
            tick: 100,
            attacker: Some(bot),
            victim: Some(human),
            assister: None,
            weapon: "ak47".into(),
            headshot: false,
            assisted_flash: false,
            wallbang: false,
            noscope: false,
            through_smoke: false,
            attacker_blind: false,
            attacker_airborne: false,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            attacker_x: 0.0,
            attacker_y: 0.0,
            attacker_z: 0.0,
        });
        let m = assemble(&mut c, 200, 3.0);
        assert_eq!(m.players.len(), 2);
        assert!(m.players[1].is_bot);
        assert_eq!(m.players[1].steam_id, bot);
        assert_eq!(m.kills[0].attacker, 1, "bot frag must not be World");
        assert_eq!(m.kills[0].victim, 0);
    }

    #[test]
    fn assemble_bot_fill_does_not_ghost_duplicate_human() {
        let human = 76_561_198_000_000_001;
        let bot = bot_steam_id(5);
        let mut c = Collector::new(ParseOptions::default());
        c.meta_order.extend([human, bot]);
        c.meta
            .insert(human, meta(human, "KatolikCOO", Side::Ct, false));
        c.meta.insert(bot, meta(bot, "KatolikCOO", Side::Ct, true));
        c.frames.push(RawFrame {
            tick: 64,
            players: vec![raw_player(human, FLAG_PRESENT | FLAG_ALIVE | FLAG_CT)],
        });
        c.frames.push(RawFrame {
            tick: 640,
            players: vec![raw_player(bot, FLAG_PRESENT | FLAG_ALIVE | FLAG_CT)],
        });
        let m = assemble(&mut c, 700, 10.0);
        assert_eq!(m.players.len(), 2);
        assert!(!m.players[0].is_bot);
        assert!(m.players[1].is_bot);
        assert_ne!(m.players[0].steam_id, m.players[1].steam_id);
        let human_slot = ticks_index(&m.ticks, 0, 0);
        let bot_after = ticks_index(&m.ticks, 1, 1);
        let human_after = ticks_index(&m.ticks, 1, 0);
        assert_ne!(m.ticks.flags[human_slot] & FLAG_PRESENT, 0);
        assert_eq!(
            m.ticks.flags[human_after] & FLAG_PRESENT,
            0,
            "leaver must not stay present after bot fill"
        );
        assert_ne!(m.ticks.flags[bot_after] & FLAG_PRESENT, 0);
    }

    fn ticks_index(ticks: &TickBuffer, frame: usize, player: usize) -> usize {
        frame * ticks.player_count as usize + player
    }

    fn freeze_ticks(frames: &[u32]) -> TickBuffer {
        let n = frames.len();
        TickBuffer {
            frame_count: n as u32,
            player_count: 1,
            ticks: frames.to_vec(),
            x: vec![0.0; n],
            y: vec![0.0; n],
            z: vec![0.0; n],
            yaw: vec![0.0; n],
            health: vec![100; n],
            armor: vec![0; n],
            flags: vec![FLAG_PRESENT | crate::FLAG_ALIVE; n],
            money: vec![0; n],
            equip: vec![0; n],
            gear: vec![0; n],
            primary: vec![0; n],
            secondary: vec![0; n],
            active: vec![0; n],
            clip: vec![0; n],
            reserve: vec![0; n],
        }
    }

    fn freeze_round() -> Round {
        Round {
            number: 1,
            start_tick: 0,
            freeze_end_tick: 64,
            end_tick: 640,
            playback_end_tick: 0,
            winner: None,
            win_reason: 0,
            score_ct: 0,
            score_t: 0,
            round_time_s: 0,
            is_knife: false,
            team_ct: String::new(),
            team_t: String::new(),
        }
    }

    #[test]
    fn freeze_buy_emits_new_gun_when_money_drops() {
        let mut ticks = freeze_ticks(&[0, 32]);
        ticks.money[0] = 4000;
        ticks.money[1] = 1300;
        ticks.primary[1] = crate::inventory::WID_AK47;
        let buys = freeze_buys(&ticks, &[freeze_round()]);
        assert_eq!(buys.len(), 1);
        assert_eq!(buys[0].weapon, crate::inventory::WID_AK47);
        assert_eq!(buys[0].cost, crate::constants::COST_AK47);
        assert_eq!(buys[0].tick, 32);
        assert_eq!(buys[0].player, 0);
    }

    #[test]
    fn freeze_buy_skips_saved_rifle_and_knife_rounds() {
        let mut ticks = freeze_ticks(&[0, 32]);
        ticks.money[0] = 2700;
        ticks.money[1] = 2700;
        ticks.primary[0] = crate::inventory::WID_AK47;
        ticks.primary[1] = crate::inventory::WID_AK47;
        assert!(freeze_buys(&ticks, &[freeze_round()]).is_empty());

        let mut knife = freeze_round();
        knife.is_knife = true;
        ticks.money[1] = 0;
        ticks.primary[1] = crate::inventory::WID_AK47;
        ticks.primary[0] = 0;
        assert!(freeze_buys(&ticks, &[knife]).is_empty());
    }

    #[test]
    fn freeze_buy_emits_new_flash_bit() {
        let mut ticks = freeze_ticks(&[0, 32]);
        ticks.money[0] = 800;
        ticks.money[1] = 600;
        ticks.gear[1] = GEAR_FLASH;
        let buys = freeze_buys(&ticks, &[freeze_round()]);
        assert_eq!(buys.len(), 1);
        assert_eq!(buys[0].weapon, WID_FLASH);
        assert_eq!(buys[0].cost, crate::constants::COST_FLASH);
    }
}
