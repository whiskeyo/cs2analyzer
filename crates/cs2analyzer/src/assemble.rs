//! Turn the streaming collector into a compact [`Match`].

#[cfg(feature = "match-stats")]
use crate::analysis::compute_stats;
use crate::analysis::starting_team_scores;
use crate::constants::{
    DEFAULT_TICK_RATE, FLASH_POP_SECONDS, HE_DECOY_SECONDS, KNIFE_ROUND_MAX_EQUIPMENT,
    KNIFE_ROUND_RESET_MAX_EQUIPMENT, MOLOTOV_SECONDS, SMOKE_SECONDS,
};
use crate::observer::Collector;
use crate::types::*;
use crate::{FLAG_PRESENT, MAX_PLAYERS};
use std::collections::HashMap;

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
    let mut grenades = build_grenades(c, &idx_of, tick_rate(c));
    attach_molotov_fires(c, &mut grenades);
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
        stats: Vec::new(),
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
) -> Vec<GrenadeThrow> {
    let gap = c.opts.tick_stride.max(1) * 10;
    let mut by_entity: HashMap<u32, Vec<ProjSample>> = HashMap::new();
    for (entity, tick, kind, x, y, z, thrower) in &c.proj_points {
        by_entity
            .entry(*entity)
            .or_default()
            .push((*tick, *kind, *x, *y, *z, *thrower));
    }

    let mut used_dets = vec![false; c.grenade_dets.len()];
    let mut out = Vec::new();

    for (entity, mut points) in by_entity {
        points.sort_by_key(|p| p.0);
        for seg in split_proj_track(points, gap) {
            let Some((first, rest)) = seg.split_first() else {
                continue;
            };
            let kind = first.1;
            let thrower = seg.iter().find_map(|p| p.5);
            let start_tick = first.0;
            let last = rest.last().copied().unwrap_or(*first);

            let mut detonate_tick = last.0;
            let mut land = (last.2, last.3, last.4);
            let matched = c.grenade_dets.iter().enumerate().find(|(i, d)| {
                if used_dets[*i] || d.1 != kind {
                    return false;
                }
                let in_window = d.0 + 16 >= start_tick && d.0 <= last.0.saturating_add(gap);
                if !in_window {
                    return false;
                }
                d.2 as u32 == entity || d.2 <= 0
            });
            let matched = matched.or_else(|| {
                c.grenade_dets.iter().enumerate().find(|(i, d)| {
                    !used_dets[*i]
                        && d.1 == kind
                        && d.0 + 16 >= start_tick
                        && d.0 <= last.0.saturating_add(gap)
                })
            });

            let end_tick = if let Some((i, det)) = matched {
                used_dets[i] = true;
                detonate_tick = det.0;
                land = (det.3, det.4, det.5);
                c.grenade_ends
                    .iter()
                    .find(|(id, t)| *id == det.2 && *t >= detonate_tick)
                    .map(|(_, t)| *t)
                    .unwrap_or_else(|| default_end(kind, detonate_tick, tick_rate))
            } else {
                default_end(kind, detonate_tick, tick_rate)
            };

            let mut pts: Vec<GrenadePoint> = seg
                .into_iter()
                .filter(|(tick, _, _, _, _, _)| *tick <= detonate_tick)
                .map(|(tick, _, x, y, z, _)| GrenadePoint { tick, x, y, z })
                .collect();
            if pts.last().map(|p| p.tick) != Some(detonate_tick) {
                pts.push(GrenadePoint {
                    tick: detonate_tick,
                    x: land.0,
                    y: land.1,
                    z: land.2,
                });
            }

            out.push(GrenadeThrow {
                thrower: idx_of(thrower),
                kind,
                start_tick,
                detonate_tick,
                end_tick,
                points: pts,
                fires: Vec::new(),
            });
        }
    }

    for (i, det) in c.grenade_dets.iter().enumerate() {
        if used_dets[i] {
            continue;
        }
        if det.1.is_fire() {
            let nearby = out.iter().any(|g| {
                g.kind.is_fire()
                    && g.detonate_tick.abs_diff(det.0) <= 48
                    && g.points
                        .last()
                        .is_some_and(|p| (p.x - det.3).hypot(p.y - det.4) < 400.0)
            });
            if nearby {
                continue;
            }
        }
        let end_tick = c
            .grenade_ends
            .iter()
            .find(|(id, t)| *id == det.2 && *t >= det.0)
            .map(|(_, t)| *t)
            .unwrap_or_else(|| default_end(det.1, det.0, tick_rate));
        out.push(GrenadeThrow {
            thrower: -1,
            kind: det.1,
            start_tick: det.0,
            detonate_tick: det.0,
            end_tick,
            points: vec![GrenadePoint {
                tick: det.0,
                x: det.3,
                y: det.4,
                z: det.5,
            }],
            fires: Vec::new(),
        });
    }

    out.sort_by_key(|g| g.start_tick);
    out
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

fn attach_molotov_fires(c: &Collector, grenades: &mut [GrenadeThrow]) {
    if c.fire_spans.is_empty() {
        return;
    }
    let mut by_entity: HashMap<u32, Vec<&crate::observer::FireSpan>> = HashMap::new();
    for span in &c.fire_spans {
        by_entity.entry(span.entity).or_default().push(span);
    }

    let mut claimed = vec![false; grenades.len()];
    for (entity, spans) in by_entity {
        let t0 = spans.iter().map(|s| s.start_tick).min().unwrap_or(0);
        let t1 = spans.iter().map(|s| s.end_tick).max().unwrap_or(t0);
        let (mut cx, mut cy) = (0.0f32, 0.0f32);
        for s in &spans {
            cx += s.x;
            cy += s.y;
        }
        let n = spans.len() as f32;
        cx /= n;
        cy /= n;

        let det_tick = c
            .grenade_dets
            .iter()
            .find(|d| d.1.is_fire() && d.2 as u32 == entity)
            .map(|d| d.0);

        let mut best = None;
        let mut best_score = f32::MAX;
        for (i, g) in grenades.iter().enumerate() {
            if claimed[i] || !g.kind.is_fire() {
                continue;
            }
            let Some(last) = g.points.last() else {
                continue;
            };
            let dist = (last.x - cx).hypot(last.y - cy);
            if dist > 800.0 {
                continue;
            }
            let dt = g.detonate_tick.abs_diff(t0);
            if dt > 96 {
                continue;
            }
            let mut score = dist + dt as f32;
            if det_tick.is_some_and(|t| g.detonate_tick.abs_diff(t) <= 16) {
                score -= 200.0;
            }
            if score < best_score {
                best_score = score;
                best = Some(i);
            }
        }
        if let Some(i) = best {
            claimed[i] = true;
            grenades[i].fires = spans
                .iter()
                .map(|s| FireCell {
                    x: s.x,
                    y: s.y,
                    start_tick: s.start_tick,
                    end_tick: s.end_tick,
                })
                .collect();
            grenades[i].end_tick = t1.min(grenades[i].end_tick);
        }
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::observer::{new_flash_duration, Collector, FireSpan, RawHurt, RawKill};
    use crate::ParseOptions;

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
    fn attach_fires_to_nearest_molotov() {
        let mut c = Collector::new(ParseOptions::default());
        c.fire_spans.push(FireSpan {
            entity: 10,
            x: 100.0,
            y: 120.0,
            start_tick: 200,
            end_tick: 500,
        });
        c.grenade_dets
            .push((200, GrenadeKind::Molotov, 10, 100.0, 120.0, 0.0));
        let mut grenades = vec![molly(200, 100.0, 120.0), molly(800, 2000.0, 2000.0)];
        attach_molotov_fires(&c, &mut grenades);
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
        c.grenade_dets
            .push((200, GrenadeKind::Incendiary, 11, 50.0, 60.0, 0.0));
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
        attach_molotov_fires(&c, &mut grenades);
        assert_eq!(grenades[0].fires.len(), 1);
        assert_eq!(grenades[0].end_tick, 400);
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
}
