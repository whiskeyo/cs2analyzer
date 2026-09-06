//! Per-player stats derived from events and rounds.

use crate::constants::{
    FIRST_OVERTIME_ROUND, OVERTIME_BLOCK_ROUNDS, REGULATION_ROUNDS, REGULATION_ROUNDS_PER_HALF,
};
#[cfg(feature = "match-stats")]
use crate::constants::{FULL_HEALTH, TRADE_SECONDS};
#[cfg(feature = "match-stats")]
use crate::props::is_utility_weapon;
use crate::types::*;
use crate::{FLAG_CT, FLAG_PRESENT};

/// Compute MVP scoreboard stats from an assembled match (kills/hurts/rounds).
#[cfg(feature = "match-stats")]
pub fn compute_stats(m: &Match) -> Vec<PlayerStats> {
    compute_stats_until(m, u32::MAX)
}

/// Like [`compute_stats`], but only count events at or before `until_tick`.
#[cfg(feature = "match-stats")]
pub fn compute_stats_until(m: &Match, until_tick: u32) -> Vec<PlayerStats> {
    let n = m.players.len();
    let mut stats: Vec<PlayerStats> = (0..n).map(|i| PlayerStats::empty(i as u8)).collect();
    let tick_rate = m.header.tick_rate.max(1.0);
    let trade_ticks = (TRADE_SECONDS * tick_rate).round() as u32;

    let competitive: Vec<&Round> = m.rounds.iter().filter(|r| !r.is_knife).collect();
    let started: Vec<&Round> = competitive
        .iter()
        .copied()
        .filter(|r| r.freeze_end_tick.min(r.start_tick) <= until_tick)
        .collect();
    let rounds_n = started.len() as u32;
    for s in &mut stats {
        s.rounds = rounds_n;
    }

    for k in m.kills.iter().filter(|k| k.tick <= until_tick) {
        if in_knife_round(m, k.tick) || is_suicide(k) {
            continue;
        }
        if is_enemy_kill(m, k) {
            let a = k.attacker as usize;
            if a < n {
                stats[a].kills += 1;
                if k.headshot {
                    stats[a].headshots += 1;
                }
                match side_at(m, a, k.tick) {
                    Side::Ct => stats[a].kills_ct += 1,
                    Side::T => stats[a].kills_t += 1,
                }
            }
        }
        if k.victim >= 0 {
            let v = k.victim as usize;
            if v < n {
                stats[v].deaths += 1;
                match side_at(m, v, k.tick) {
                    Side::Ct => stats[v].deaths_ct += 1,
                    Side::T => stats[v].deaths_t += 1,
                }
            }
        }
        if k.assister >= 0 && k.victim >= 0 {
            let a = k.assister as usize;
            let v = k.victim as usize;
            if a < n && v < n && is_enemy(m, a, v, k.tick) {
                stats[a].assists += 1;
                if k.assisted_flash {
                    stats[a].flash_assists += 1;
                }
            }
        }
    }

    apply_damage(m, until_tick, &mut stats);

    for b in m.blinds.iter().filter(|b| b.tick <= until_tick) {
        if in_knife_round(m, b.tick) {
            continue;
        }
        if b.attacker >= 0 && b.victim >= 0 && b.attacker != b.victim {
            let a = b.attacker as usize;
            let v = b.victim as usize;
            if a < n && v < n && side_at(m, a, b.tick) != side_at(m, v, b.tick) {
                stats[a].enemies_flashed += 1;
            }
        }
    }

    for e in m.bomb_events.iter().filter(|e| e.tick <= until_tick) {
        if in_knife_round(m, e.tick) {
            continue;
        }
        if e.player < 0 {
            continue;
        }
        let p = e.player as usize;
        if p >= n {
            continue;
        }
        match e.kind {
            BombKind::Planted => stats[p].plants += 1,
            BombKind::Defused => stats[p].defuses += 1,
            BombKind::Exploded | BombKind::BeginDefuse | BombKind::AbortDefuse => {}
        }
    }

    for round in started {
        let end = round.end_tick.min(until_tick);
        let round_kills: Vec<&Kill> = m
            .kills
            .iter()
            .filter(|k| k.tick >= round.freeze_end_tick && k.tick <= end)
            .collect();
        if let Some(first) = round_kills.iter().copied().find(|k| is_enemy_kill(m, k)) {
            if first.attacker >= 0 {
                let a = first.attacker as usize;
                if a < n {
                    stats[a].first_kills += 1;
                }
            }
            if first.victim >= 0 {
                let v = first.victim as usize;
                if v < n {
                    stats[v].first_deaths += 1;
                }
            }
        }

        let mut kills_in_round = vec![0u32; n];
        let mut kast = vec![false; n];
        let mut died_at = vec![None; n];
        let freeze = round.freeze_end_tick.max(round.start_tick);
        for (i, s) in stats.iter_mut().enumerate() {
            if !present_at(m, i, freeze) {
                continue;
            }
            match side_at(m, i, freeze) {
                Side::Ct => s.rounds_ct += 1,
                Side::T => s.rounds_t += 1,
            }
        }

        for k in &round_kills {
            if is_enemy_kill(m, k) {
                let a = k.attacker as usize;
                if a < n {
                    kast[a] = true;
                    kills_in_round[a] += 1;
                }
            }
            if k.assister >= 0 && k.victim >= 0 {
                let a = k.assister as usize;
                let v = k.victim as usize;
                if a < n && v < n && is_enemy(m, a, v, k.tick) {
                    kast[a] = true;
                }
            }
            if k.victim >= 0 && !is_suicide(k) {
                let v = k.victim as usize;
                if v < n {
                    died_at[v] = Some(k.tick);
                }
            }
        }

        let round_over = round.end_tick <= until_tick;
        for (i, death) in died_at.iter().enumerate() {
            if death.is_none() && round_over && present_at(m, i, freeze) {
                kast[i] = true;
            }
        }

        apply_trades(
            &round_kills,
            trade_ticks,
            |i, tick| side_at(m, i, tick),
            &mut kast,
            &mut stats,
        );

        for (i, ok) in kast.iter().enumerate() {
            if *ok {
                stats[i].kast_rounds += 1;
            }
        }
        for (i, k) in kills_in_round.iter().enumerate() {
            match *k {
                2 => stats[i].multi_kills_2 += 1,
                3 => stats[i].multi_kills_3 += 1,
                4 => stats[i].multi_kills_4 += 1,
                n if n >= 5 => stats[i].aces += 1,
                _ => {}
            }
        }
    }

    for s in &mut stats {
        s.adr = if s.rounds > 0 {
            s.damage as f32 / s.rounds as f32
        } else {
            0.0
        };
        s.headshot_percent = if s.kills > 0 {
            100.0 * s.headshots as f32 / s.kills as f32
        } else {
            0.0
        };
        s.kast = if s.rounds > 0 {
            100.0 * s.kast_rounds as f32 / s.rounds as f32
        } else {
            0.0
        };
        s.kd = if s.deaths > 0 {
            s.kills as f32 / s.deaths as f32
        } else {
            s.kills as f32
        };
        s.entry_attempts = s.first_kills + s.first_deaths;
        s.entry_success = if s.entry_attempts > 0 {
            100.0 * s.first_kills as f32 / s.entry_attempts as f32
        } else {
            0.0
        };
        s.adr_ct = if s.rounds_ct > 0 {
            s.damage_ct as f32 / s.rounds_ct as f32
        } else {
            0.0
        };
        s.adr_t = if s.rounds_t > 0 {
            s.damage_t as f32 / s.rounds_t as f32
        } else {
            0.0
        };
    }

    stats
}

#[cfg(feature = "match-stats")]
fn apply_damage(m: &Match, until_tick: u32, stats: &mut [PlayerStats]) {
    let n = stats.len();
    let competitive: Vec<&Round> = m.rounds.iter().filter(|r| !r.is_knife).collect();
    for round in competitive {
        if round.start_tick > until_tick {
            continue;
        }
        let end = round.end_tick.min(until_tick);
        let mut hp = vec![FULL_HEALTH; n];
        for h in m
            .hurts
            .iter()
            .filter(|h| h.tick >= round.start_tick && h.tick <= end)
        {
            if h.victim < 0 {
                continue;
            }
            let v = h.victim as usize;
            if v >= n || hp[v] <= 0 {
                continue;
            }
            let dealt = h.damage.min(hp[v]);
            hp[v] -= dealt;
            if h.attacker < 0 {
                continue;
            }
            let a = h.attacker as usize;
            if a >= n || a == v {
                continue;
            }
            if side_at(m, a, h.tick) == side_at(m, v, h.tick) {
                continue;
            }
            stats[a].damage += dealt;
            match side_at(m, a, h.tick) {
                Side::Ct => stats[a].damage_ct += dealt,
                Side::T => stats[a].damage_t += dealt,
            }
            if is_utility_weapon(&h.weapon) {
                stats[a].utility_damage += dealt;
            }
        }
    }
}

#[cfg(feature = "match-stats")]
fn apply_trades(
    round_kills: &[&Kill],
    trade_ticks: u32,
    side_at: impl Fn(usize, u32) -> Side,
    kast: &mut [bool],
    stats: &mut [PlayerStats],
) {
    let n = stats.len();
    for death in round_kills {
        if death.victim < 0 || death.attacker < 0 {
            continue;
        }
        let vic = death.victim as usize;
        let killer = death.attacker as usize;
        if vic >= n || killer >= n {
            continue;
        }
        let vic_side = side_at(vic, death.tick);
        if vic_side == side_at(killer, death.tick) {
            continue;
        }
        for k in round_kills {
            if k.tick <= death.tick || k.tick.saturating_sub(death.tick) > trade_ticks {
                continue;
            }
            if k.victim != death.attacker || k.attacker < 0 {
                continue;
            }
            let trader = k.attacker as usize;
            if trader >= n || trader == vic {
                continue;
            }
            if side_at(trader, k.tick) != vic_side {
                continue;
            }
            kast[vic] = true;
            stats[trader].trade_kills += 1;
            break;
        }
    }
}

/// True when the team that started T is currently on CT at this round's freeze.
pub fn round_sides_swapped(m: &Match, round: &Round) -> bool {
    let tick = round.freeze_end_tick.max(round.start_tick);
    if m.ticks.frame_count == 0 {
        return swapped_by_schedule(round.number);
    }
    let mut flipped = 0u32;
    let mut n = 0u32;
    for (i, p) in m.players.iter().enumerate() {
        if !present_at(m, i, tick) {
            continue;
        }
        n += 1;
        let now_ct = side_at(m, i, tick) == Side::Ct;
        if now_ct != (p.start_side == Side::Ct) {
            flipped += 1;
        }
    }
    if n == 0 {
        return swapped_by_schedule(round.number);
    }
    flipped * 2 > n
}

/// Match wins for the teams that started on CT and T.
pub fn starting_team_scores(m: &Match, until_tick: u32) -> (i32, i32) {
    let mut ct = 0i32;
    let mut t = 0i32;
    for r in m.rounds.iter().filter(|r| !r.is_knife) {
        if r.end_tick > until_tick {
            continue;
        }
        let Some(winner) = r.winner else { continue };
        let start = if round_sides_swapped(m, r) {
            flip_side(winner)
        } else {
            winner
        };
        match start {
            Side::Ct => ct += 1,
            Side::T => t += 1,
        }
    }
    (ct, t)
}

fn swapped_by_schedule(number: u32) -> bool {
    if number == 0 || number <= REGULATION_ROUNDS_PER_HALF {
        false
    } else if number <= REGULATION_ROUNDS {
        true
    } else {
        ((number - FIRST_OVERTIME_ROUND) / OVERTIME_BLOCK_ROUNDS) % 2 == 1
    }
}

fn flip_side(side: Side) -> Side {
    match side {
        Side::T => Side::Ct,
        Side::Ct => Side::T,
    }
}

fn side_at(m: &Match, player: usize, tick: u32) -> Side {
    if m.ticks.frame_count == 0 || player >= m.players.len() {
        return m
            .players
            .get(player)
            .map(|p| p.start_side)
            .unwrap_or(Side::T);
    }
    let frame = m.ticks.frame_index_at_tick(tick);
    if let Some(tp) = m.ticks.player_at(frame, player) {
        if tp.flags & FLAG_PRESENT != 0 {
            return if tp.flags & FLAG_CT != 0 {
                Side::Ct
            } else {
                Side::T
            };
        }
    }
    m.players[player].start_side
}

fn present_at(m: &Match, player: usize, tick: u32) -> bool {
    if m.ticks.frame_count == 0 {
        return true;
    }
    let frame = m.ticks.frame_index_at_tick(tick);
    m.ticks
        .player_at(frame, player)
        .is_some_and(|tp| tp.flags & FLAG_PRESENT != 0)
}

#[cfg(feature = "match-stats")]
fn in_knife_round(m: &Match, tick: u32) -> bool {
    m.rounds
        .iter()
        .find(|r| tick >= r.start_tick && tick <= r.end_tick)
        .map(|r| r.is_knife)
        .unwrap_or(false)
}

#[cfg(feature = "match-stats")]
fn is_suicide(k: &Kill) -> bool {
    if k.attacker == k.victim {
        return true;
    }
    if k.attacker < 0 {
        return true;
    }
    let w = k.weapon.to_ascii_lowercase();
    w == "world" || w == "suicide" || w.contains("trigger_hurt")
}

#[cfg(feature = "match-stats")]
fn is_enemy(m: &Match, a: usize, b: usize, tick: u32) -> bool {
    a != b
        && a < m.players.len()
        && b < m.players.len()
        && side_at(m, a, tick) != side_at(m, b, tick)
}

#[cfg(feature = "match-stats")]
fn is_enemy_kill(m: &Match, k: &Kill) -> bool {
    k.attacker >= 0 && k.victim >= 0 && is_enemy(m, k.attacker as usize, k.victim as usize, k.tick)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MatchHeader;

    fn empty_match() -> Match {
        Match {
            header: MatchHeader {
                map_name: "de_dust2".into(),
                tick_rate: 64.0,
                tick_stride: 4,
                duration_s: 10.0,
                playback_ticks: 640,
                team_ct: "CT".into(),
                team_t: "T".into(),
                score_ct: 1,
                score_t: 0,
            },
            players: vec![
                Player {
                    index: 0,
                    steam_id: 1,
                    name: "A".into(),
                    start_side: Side::Ct,
                },
                Player {
                    index: 1,
                    steam_id: 2,
                    name: "B".into(),
                    start_side: Side::T,
                },
            ],
            rounds: vec![Round {
                number: 1,
                start_tick: 0,
                freeze_end_tick: 64,
                end_tick: 640,
                playback_end_tick: 0,
                winner: Some(Side::Ct),
                win_reason: 8,
                score_ct: 1,
                score_t: 0,
                is_knife: false,
                team_ct: String::new(),
                team_t: String::new(),
            }],
            ticks: TickBuffer::default(),
            grenades: vec![],
            shots: vec![],
            kills: vec![],
            hurts: vec![],
            blinds: vec![],
            bomb_events: vec![],
            stats: vec![],
        }
    }

    fn kill(tick: u32, attacker: i8, victim: i8) -> Kill {
        Kill {
            tick,
            attacker,
            victim,
            assister: -1,
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
        }
    }

    fn hurt(tick: u32, attacker: i8, victim: i8, damage: i32) -> Hurt {
        Hurt {
            tick,
            attacker,
            victim,
            damage,
            damage_armor: 0,
            hitgroup: 0,
            health: 0,
            armor: 0,
            weapon: "ak47".into(),
        }
    }

    #[test]
    fn adr_caps_overkill_at_remaining_hp() {
        let mut m = empty_match();
        m.kills.push(Kill {
            tick: 100,
            attacker: 0,
            victim: 1,
            assister: -1,
            weapon: "ak47".into(),
            headshot: true,
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
        m.hurts.push(hurt(90, 0, 1, 110));
        let stats = compute_stats(&m);
        assert_eq!(stats[0].kills, 1);
        assert_eq!(stats[0].headshots, 1);
        assert_eq!(stats[1].deaths, 1);
        assert!((stats[0].adr - 100.0).abs() < f32::EPSILON);
        assert!((stats[0].headshot_percent - 100.0).abs() < f32::EPSILON);
        assert!(stats[0].kast > 0.0);
    }

    #[test]
    fn skips_knife_round_kills() {
        let mut m = empty_match();
        m.rounds[0].is_knife = true;
        m.rounds[0].number = 0;
        m.kills.push(kill(100, 0, 1));
        let stats = compute_stats(&m);
        assert_eq!(stats[0].kills, 0);
        assert_eq!(stats[0].rounds, 0);
    }

    #[test]
    fn killer_follow_up_is_not_a_trade() {
        let mut m = empty_match();
        m.players.push(Player {
            index: 2,
            steam_id: 3,
            name: "C".into(),
            start_side: Side::Ct,
        });
        m.kills.push(kill(100, 1, 0));
        m.kills.push(kill(120, 1, 2));
        let stats = compute_stats(&m);
        assert_eq!(stats[0].kast_rounds, 0);
        assert_eq!(stats[1].trade_kills, 0);
        assert_eq!(stats[2].trade_kills, 0);
        assert_eq!(stats[1].kills, 2);
    }

    #[test]
    fn teammate_killing_attacker_is_a_trade() {
        let mut m = empty_match();
        m.players.push(Player {
            index: 2,
            steam_id: 3,
            name: "C".into(),
            start_side: Side::Ct,
        });
        m.kills.push(kill(100, 1, 0));
        m.kills.push(kill(120, 2, 1));
        let stats = compute_stats(&m);
        assert_eq!(stats[0].kast_rounds, 1);
        assert_eq!(stats[2].trade_kills, 1);
        assert_eq!(stats[1].trade_kills, 0);
    }

    #[test]
    fn suicide_is_omitted_from_kills_and_deaths() {
        let mut m = empty_match();
        m.kills.push(kill(100, 0, 0));
        m.kills.push(kill(200, 0, 1));
        let stats = compute_stats(&m);
        assert_eq!(stats[0].kills, 1);
        assert_eq!(stats[0].deaths, 0);
        assert_eq!(stats[1].deaths, 1);
    }

    #[test]
    fn world_death_is_omitted_from_kills_and_deaths() {
        let mut m = empty_match();
        m.kills.push(Kill {
            tick: 100,
            attacker: -1,
            victim: 0,
            assister: -1,
            weapon: "world".into(),
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
        m.kills.push(kill(200, 0, 1));
        let stats = compute_stats(&m);
        assert_eq!(stats[0].kills, 1);
        assert_eq!(stats[0].deaths, 0);
        assert_eq!(stats[1].deaths, 1);
    }

    #[test]
    fn teamkill_is_not_a_kill() {
        let mut m = empty_match();
        m.players.push(Player {
            index: 2,
            steam_id: 3,
            name: "C".into(),
            start_side: Side::Ct,
        });
        m.kills.push(kill(100, 0, 2));
        m.kills.push(kill(200, 0, 1));
        let stats = compute_stats(&m);
        assert_eq!(stats[0].kills, 1);
        assert_eq!(stats[2].deaths, 1);
        assert_eq!(stats[0].first_kills, 1);
        assert_eq!(stats[2].first_deaths, 0);
        assert_eq!(stats[1].first_deaths, 1);
    }

    #[test]
    fn entry_success_is_opening_kills_over_attempts() {
        let mut m = empty_match();
        m.kills.push(kill(100, 0, 1));
        let stats = compute_stats(&m);
        assert_eq!(stats[0].entry_attempts, 1);
        assert_eq!(stats[1].entry_attempts, 1);
        assert!((stats[0].entry_success - 100.0).abs() < f32::EPSILON);
        assert!(stats[1].entry_success.abs() < f32::EPSILON);
    }

    #[test]
    fn splits_kills_and_adr_by_side() {
        let mut m = empty_match();
        m.kills.push(kill(100, 0, 1));
        m.hurts.push(hurt(90, 0, 1, 40));
        let stats = compute_stats(&m);
        assert_eq!(stats[0].kills_ct, 1);
        assert_eq!(stats[0].kills_t, 0);
        assert!((stats[0].adr_ct - 40.0).abs() < f32::EPSILON);
        assert_eq!(stats[1].deaths_t, 1);
        assert_eq!(stats[1].deaths_ct, 0);
    }

    #[test]
    fn same_side_assist_is_ignored() {
        let mut m = empty_match();
        m.kills.push(Kill {
            tick: 100,
            attacker: 0,
            victim: 1,
            assister: 1,
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
        let stats = compute_stats(&m);
        assert_eq!(stats[1].assists, 0);
        assert_eq!(stats[0].kills, 1);
    }

    #[test]
    fn ot_schedule_swaps_every_three_rounds() {
        assert!(!swapped_by_schedule(12));
        assert!(swapped_by_schedule(13));
        assert!(swapped_by_schedule(24));
        assert!(!swapped_by_schedule(25));
        assert!(swapped_by_schedule(28));
        assert!(swapped_by_schedule(30));
    }
}
