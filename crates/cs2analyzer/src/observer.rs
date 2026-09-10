//! Streaming observer: walks the demo tick by tick and accumulates samples.

use crate::inventory::{
    armor_gear, c4_arming_steams, collect_loadouts, controller_money, hold_ammo,
    pawn_active_ammo_raw, pawn_active_weapon, pawn_equip_value, refine_hurt_weapon,
};
use crate::props::*;
use crate::types::{BombKind, GrenadeKind, Side};
use crate::{
    ParseOptions, FLAG_ALIVE, FLAG_CT, FLAG_DEFUSING, FLAG_DUCKED, FLAG_PLANTING, FLAG_PRESENT,
    FLAG_SCOPED, MAX_PLAYERS,
};
use source2_demo::prelude::*;
use source2_demo::proto::CSvcMsgServerInfo;
use std::collections::{HashMap, HashSet};

pub(crate) struct PlayerMeta {
    pub steam_id: u64,
    pub name: String,
    pub start_side: Side,
}

pub(crate) struct RawFramePlayer {
    pub steam_id: u64,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub yaw: f32,
    pub health: u8,
    pub armor: u8,
    pub flags: u8,
    pub money: u16,
    pub equip: u16,
    pub gear: u16,
    pub primary: u8,
    pub secondary: u8,
    pub active: u8,
    pub clip: u8,
    pub reserve: u16,
}

pub(crate) struct RawFrame {
    pub tick: u32,
    pub players: Vec<RawFramePlayer>,
}

pub(crate) type ProjPoint = (u32, u32, GrenadeKind, f32, f32, f32, Option<u64>);
pub(crate) type BombRec = (u32, BombKind, Option<u64>, f32, f32, f32, bool, Option<u8>);

pub(crate) struct Collector {
    pub opts: ParseOptions,
    pub map_name: String,
    pub tick_interval: f32,
    pub meta_order: Vec<u64>,
    pub meta: HashMap<u64, PlayerMeta>,
    pub round_starts: Vec<u32>,
    pub freeze_ends: Vec<u32>,
    pub official_ends: Vec<(u32, Option<Side>, i32)>,
    pub pre_restarts: Vec<u32>,
    pub synth_ends: Vec<(u32, Option<Side>, i32)>,
    pub prev_win_status: i32,
    pub grenade_dets: Vec<(u32, GrenadeKind, i32, f32, f32, f32)>,
    pub grenade_ends: Vec<(i32, u32)>,
    pub proj_points: Vec<ProjPoint>,
    pub final_winner: Option<Side>,
    pub final_reason: i32,
    pub round_scores: HashMap<u32, (i32, i32)>,
    pub round_names: HashMap<u32, (String, String)>,
    /// Max player equipment value at freeze-end, keyed by freeze tick.
    pub round_equip: HashMap<u32, i32>,
    pub final_score: Option<(i32, i32)>,
    pub final_names: Option<(String, String)>,
    pub hurts: Vec<RawHurt>,
    pub shots: Vec<(u32, Option<u64>, f32, f32, f32)>,
    pub kills: Vec<RawKill>,
    /// `(tick, victim_steam, duration_s, attacker_steam)`.
    pub blinds: Vec<(u32, Option<u64>, f32, Option<u64>)>,
    pub bomb_events: Vec<BombRec>,
    pub userid_to_steam: HashMap<i32, u64>,
    flash_duration: HashMap<u64, f32>,
    last_flash_thrower: Option<u64>,
    pub frames: Vec<RawFrame>,
    pub pawn_to_steam: HashMap<u32, u64>,
    pub last_cap: u32,
    pub total_ticks: u32,
    pub last_progress_tick: u32,
    pub progress: Option<Box<dyn FnMut(u32, u32)>>,
    pub fire_spans: Vec<FireSpan>,
    inferno_live: HashMap<u32, [Option<LiveFlame>; 64]>,
    /// Last non-negative clip/reserve per steam and active WID.
    last_ammo: HashMap<(u64, u8), (u8, u16)>,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct FireSpan {
    pub entity: u32,
    pub x: f32,
    pub y: f32,
    pub start_tick: u32,
    pub end_tick: u32,
}

#[derive(Clone, Copy)]
struct LiveFlame {
    x: f32,
    y: f32,
    start: u32,
}

pub(crate) struct RawHurt {
    pub tick: u32,
    pub attacker: Option<u64>,
    pub victim: Option<u64>,
    pub damage: i32,
    pub damage_armor: i32,
    pub hitgroup: u8,
    pub health: i32,
    pub armor: i32,
    pub weapon: String,
}

pub(crate) struct RawKill {
    pub tick: u32,
    pub attacker: Option<u64>,
    pub victim: Option<u64>,
    pub assister: Option<u64>,
    pub weapon: String,
    pub headshot: bool,
    pub assisted_flash: bool,
    pub wallbang: bool,
    pub noscope: bool,
    pub through_smoke: bool,
    pub attacker_blind: bool,
    pub attacker_airborne: bool,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub attacker_x: f32,
    pub attacker_y: f32,
    pub attacker_z: f32,
}

impl Collector {
    pub(crate) fn new(opts: ParseOptions) -> Self {
        Self {
            opts,
            map_name: String::new(),
            tick_interval: 1.0 / 64.0,
            meta_order: Vec::new(),
            meta: HashMap::new(),
            round_starts: Vec::new(),
            freeze_ends: Vec::new(),
            official_ends: Vec::new(),
            pre_restarts: Vec::new(),
            synth_ends: Vec::new(),
            prev_win_status: 0,
            grenade_dets: Vec::new(),
            grenade_ends: Vec::new(),
            proj_points: Vec::new(),
            final_winner: None,
            final_reason: 0,
            round_scores: HashMap::new(),
            round_names: HashMap::new(),
            round_equip: HashMap::new(),
            final_score: None,
            final_names: None,
            hurts: Vec::new(),
            shots: Vec::new(),
            kills: Vec::new(),
            blinds: Vec::new(),
            bomb_events: Vec::new(),
            userid_to_steam: HashMap::new(),
            flash_duration: HashMap::new(),
            last_flash_thrower: None,
            frames: Vec::new(),
            pawn_to_steam: HashMap::new(),
            last_cap: 0,
            total_ticks: 0,
            last_progress_tick: 0,
            progress: None,
            fire_spans: Vec::new(),
            inferno_live: HashMap::new(),
            last_ammo: HashMap::new(),
        }
    }

    pub(crate) fn finish_infernos(&mut self, tick: u32) {
        let ents: Vec<u32> = self.inferno_live.keys().copied().collect();
        for entity in ents {
            self.close_inferno(entity, tick);
        }
    }

    fn sample_ammo(&mut self, ctx: &Context) {
        let pairs: Vec<(u32, u64)> = self.pawn_to_steam.iter().map(|(&i, &s)| (i, s)).collect();
        for (idx, steam) in pairs {
            let Ok(pawn) = ctx.entities().get_by_index(idx as usize) else {
                continue;
            };
            let active = pawn_active_weapon(ctx, pawn);
            let (clip, reserve) = pawn_active_ammo_raw(ctx, pawn);
            let prev = self.last_ammo.get(&(steam, active)).copied();
            let (clip, reserve) = hold_ammo(prev, clip, reserve);
            self.last_ammo.insert((steam, active), (clip, reserve));
        }
    }

    fn record_blind(&mut self, tick: u32, victim: u64, duration: f32, attacker: Option<u64>) {
        if duration <= 0.0 {
            return;
        }
        if self
            .blinds
            .iter()
            .rev()
            .take(32)
            .any(|(t, v, _, _)| *t == tick && *v == Some(victim))
        {
            return;
        }
        self.blinds.push((
            tick,
            Some(victim),
            duration,
            attacker.or(self.last_flash_thrower),
        ));
        let prev = self.flash_duration.get(&victim).copied().unwrap_or(0.0);
        if duration > prev {
            self.flash_duration.insert(victim, duration);
        }
    }

    fn sample_flash_blinds(&mut self, ctx: &Context, tick: u32) {
        for ctrl in ctx.entities().iter() {
            if ctrl.class().name() != "CCSPlayerController" {
                continue;
            }
            let steam = prop_u64(ctrl, "m_steamID");
            if steam == 0 {
                continue;
            }
            let handle = prop_u32(ctrl, "m_hPlayerPawn");
            let Ok(pawn) = ctx.entities().get_by_handle(handle as usize) else {
                continue;
            };
            let dur = prop_f32(pawn, "m_flFlashDuration");
            let prev = self.flash_duration.get(&steam).copied().unwrap_or(0.0);
            if let Some(next) = new_flash_duration(prev, dur) {
                self.record_blind(tick, steam, next, self.last_flash_thrower);
            }
            self.flash_duration.insert(steam, dur);
        }
    }

    fn sample_infernos(&mut self, ctx: &Context, tick: u32) {
        let mut seen = HashSet::new();
        for e in ctx.entities().iter() {
            if !is_inferno_class(e.class().name()) {
                continue;
            }
            let entity = e.index();
            seen.insert(entity);
            self.track_inferno(e, tick);
        }
        let stale: Vec<u32> = self
            .inferno_live
            .keys()
            .copied()
            .filter(|k| !seen.contains(k))
            .collect();
        for entity in stale {
            self.close_inferno(entity, tick.saturating_sub(1));
        }
    }

    fn track_inferno(&mut self, e: &Entity, tick: u32) {
        let entity = e.index();
        let slots = self.inferno_live.entry(entity).or_insert([None; 64]);
        for (i, slot) in slots.iter_mut().enumerate() {
            let burning = fire_burning(e, i);
            if burning {
                let Some((x, y)) = fire_pos(e, i) else {
                    continue;
                };
                match *slot {
                    Some(live) if (live.x - x).hypot(live.y - y) < 80.0 => {
                        *slot = Some(LiveFlame {
                            x,
                            y,
                            start: live.start,
                        });
                    }
                    Some(live) => {
                        self.fire_spans.push(FireSpan {
                            entity,
                            x: live.x,
                            y: live.y,
                            start_tick: live.start,
                            end_tick: tick.saturating_sub(1).max(live.start),
                        });
                        *slot = Some(LiveFlame { x, y, start: tick });
                    }
                    None => {
                        *slot = Some(LiveFlame { x, y, start: tick });
                    }
                }
            } else if let Some(live) = slot.take() {
                self.fire_spans.push(FireSpan {
                    entity,
                    x: live.x,
                    y: live.y,
                    start_tick: live.start,
                    end_tick: tick.saturating_sub(1).max(live.start),
                });
            }
        }
        if slots.iter().all(Option::is_none) {
            self.inferno_live.remove(&entity);
        }
    }

    fn close_inferno(&mut self, entity: u32, end_tick: u32) {
        if let Some(slots) = self.inferno_live.remove(&entity) {
            for live in slots.into_iter().flatten() {
                self.fire_spans.push(FireSpan {
                    entity,
                    x: live.x,
                    y: live.y,
                    start_tick: live.start,
                    end_tick: end_tick.max(live.start),
                });
            }
        }
    }
}

fn fire_burning(e: &Entity, i: usize) -> bool {
    prop_truthy(e, &format!("m_bFireIsBurning.{i:04}"))
        || prop_truthy(e, &format!("m_bFireIsBurning.{i}"))
}

fn fire_pos(e: &Entity, i: usize) -> Option<(f32, f32)> {
    for key in [
        format!("m_firePositions.{i:04}"),
        format!("m_firePositions.{i}"),
    ] {
        if let Some((x, y, _)) = prop_vec3(e, &key) {
            return Some((x, y));
        }
    }
    None
}

fn steam_from_pawn_handle(c: &Collector, ctx: &Context, handle: i32) -> Option<u64> {
    let pawn = ctx.entities().get_by_handle(handle as u32 as usize).ok()?;
    c.pawn_to_steam.get(&pawn.index()).copied()
}

fn steam_from_game_event(c: &Collector, ctx: &Context, ge: &GameEvent<'_>) -> Option<u64> {
    ev_i32(ge, "userid_pawn")
        .and_then(|h| steam_from_pawn_handle(c, ctx, h))
        .or_else(|| ev_i32(ge, "userid").and_then(|uid| steam_from_userid(c, ctx, uid)))
}

/// Controllers with `m_steamID == 0` are bots (or an empty slot after a leave).
/// Drop the stale userid→steam binding so `player_blind` does not keep the leaver.
pub(crate) fn bind_userid_steam(map: &mut HashMap<i32, u64>, userid: i32, steam: u64) {
    if steam == 0 {
        map.remove(&userid);
    } else {
        map.insert(userid, steam);
    }
}

fn steam_from_userid(c: &Collector, ctx: &Context, uid: i32) -> Option<u64> {
    if uid <= 0 {
        return None;
    }
    if let Some(&steam) = c.userid_to_steam.get(&uid) {
        return Some(steam);
    }
    if let Ok(ent) = ctx.entities().get_by_index(uid as usize) {
        if ent.class().name() == "CCSPlayerController" {
            let steam = prop_u64(ent, "m_steamID");
            if steam != 0 {
                return Some(steam);
            }
        }
    }
    let slot = uid & 0xff;
    if slot != uid {
        if let Some(&steam) = c.userid_to_steam.get(&slot) {
            return Some(steam);
        }
    }
    None
}

fn steam_from_event_player(
    c: &Collector,
    ctx: &Context,
    ge: &GameEvent<'_>,
    pawn_key: &str,
    userid_key: &str,
) -> Option<u64> {
    ev_i32(ge, pawn_key)
        .and_then(|h| steam_from_pawn_handle(c, ctx, h))
        .or_else(|| ev_i32(ge, userid_key).and_then(|uid| steam_from_userid(c, ctx, uid)))
}

fn entity_xyz_by_index(ctx: &Context, index: i32) -> Option<(f32, f32, f32)> {
    if index <= 0 {
        return None;
    }
    let ent = ctx
        .entities()
        .get_by_index(index as usize)
        .or_else(|_| ctx.entities().get_by_handle(index as usize))
        .ok()?;
    Some(entity_xyz(ent))
}

fn thrower_from_nade_entity(c: &Collector, ctx: &Context, entityid: i32) -> Option<u64> {
    if entityid <= 0 {
        return None;
    }
    let ent = ctx
        .entities()
        .get_by_index(entityid as usize)
        .or_else(|_| ctx.entities().get_by_handle(entityid as usize))
        .ok()?;
    steam_from_pawn_handle(c, ctx, prop_u32(ent, "m_hThrower") as i32)
}

/// True when `next` is a new flash on this pawn (duration jumped up).
pub(crate) fn new_flash_duration(prev: f32, next: f32) -> Option<f32> {
    if next > 0.0 && next > prev + 0.05 {
        Some(next)
    } else {
        None
    }
}

fn ev_haskit(ge: &GameEvent<'_>) -> bool {
    ev_bool(ge, "haskit") || ev_i32(ge, "haskit").unwrap_or(0) != 0
}

const PROGRESS_TICK_INTERVAL: u32 = 512;

#[observer]
#[uses_all]
impl Collector {
    #[on_message]
    fn on_server_info(&mut self, _ctx: &Context, msg: CSvcMsgServerInfo) -> ObserverResult {
        if let Some(m) = msg.map_name {
            if !m.is_empty() {
                self.map_name = m.rsplit('/').next().unwrap_or(&m).to_string();
            }
        }
        if let Some(interval) = msg.tick_interval {
            if interval > 0.0 {
                self.tick_interval = interval;
            }
        }
        Ok(())
    }

    #[on_tick_start]
    fn on_tick_start(&mut self, ctx: &Context) -> ObserverResult {
        let tick = ctx.tick();
        if tick == u32::MAX {
            return Ok(());
        }

        if self.total_ticks > 0
            && tick.wrapping_sub(self.last_progress_tick) >= PROGRESS_TICK_INTERVAL
        {
            self.last_progress_tick = tick;
            let total = self.total_ticks;
            if let Some(cb) = self.progress.as_mut() {
                cb(tick.min(total), total);
            }
        }

        self.pawn_to_steam.clear();
        for ctrl in ctx.entities().iter() {
            if ctrl.class().name() != "CCSPlayerController" {
                continue;
            }
            let steam = prop_u64(ctrl, "m_steamID");
            bind_userid_steam(&mut self.userid_to_steam, ctrl.index() as i32, steam);
            if steam == 0 {
                continue;
            }
            let handle = prop_u32(ctrl, "m_hPlayerPawn");
            if let Ok(pawn) = ctx.entities().get_by_handle(handle as usize) {
                self.pawn_to_steam.insert(pawn.index(), steam);
            }
        }

        let warmup = in_warmup(ctx);
        if self.opts.skip_warmup && warmup {
            return Ok(());
        }

        let win_status = gamerules_i32(ctx, "m_pGameRules.m_iRoundWinStatus").unwrap_or(0);
        if win_status != 0 && self.prev_win_status == 0 && !warmup {
            let winner = side_of(win_status);
            let reason = gamerules_i32(ctx, "m_pGameRules.m_eRoundWinReason").unwrap_or(0);
            self.synth_ends.push((tick, winner, reason));
        }
        self.prev_win_status = win_status;

        self.sample_infernos(ctx, tick);
        self.sample_flash_blinds(ctx, tick);
        self.sample_ammo(ctx);

        if tick.wrapping_sub(self.last_cap) < self.opts.tick_stride && self.last_cap != 0 {
            return Ok(());
        }
        self.last_cap = tick;

        let inventory = collect_loadouts(ctx, &self.pawn_to_steam);
        let planters = c4_arming_steams(ctx, &self.pawn_to_steam);

        let mut players = Vec::with_capacity(10);
        for ctrl in ctx.entities().iter() {
            if ctrl.class().name() != "CCSPlayerController" {
                continue;
            }
            let steam = prop_u64(ctrl, "m_steamID");
            if steam == 0 {
                continue;
            }
            if side_of(prop_i32(ctrl, "m_iTeamNum")).is_none() {
                continue;
            }
            if self.meta_order.len() >= MAX_PLAYERS && !self.meta.contains_key(&steam) {
                continue;
            }
            let handle = prop_u32(ctrl, "m_hPlayerPawn");
            let pawn = match ctx.entities().get_by_handle(handle as usize) {
                Ok(p) => p,
                Err(_) => continue,
            };
            let team = prop_i32(pawn, "m_iTeamNum");
            let side = match side_of(team) {
                Some(s) => s,
                None => continue,
            };

            if !self.meta.contains_key(&steam) {
                self.meta_order.push(steam);
                self.meta.insert(
                    steam,
                    PlayerMeta {
                        steam_id: steam,
                        name: controller_name(ctrl),
                        start_side: side,
                    },
                );
            } else if let Some(m) = self.meta.get_mut(&steam) {
                if m.name.is_empty() {
                    m.name = controller_name(ctrl);
                }
            }

            let alive = prop_i32(pawn, "m_lifeState") == 0;
            let (x, y, z) = entity_xyz(pawn);
            let mut flags = FLAG_PRESENT;
            if alive {
                flags |= FLAG_ALIVE;
            }
            if prop_bool(pawn, "m_bDucked") || prop_bool(pawn, "m_bDucking") {
                flags |= FLAG_DUCKED;
            }
            if prop_bool(pawn, "m_bIsScoped") {
                flags |= FLAG_SCOPED;
            }
            if side == Side::Ct {
                flags |= FLAG_CT;
            }
            if prop_bool(pawn, "m_bIsDefusing") {
                flags |= FLAG_DEFUSING;
            }
            if planters.contains(&steam) {
                flags |= FLAG_PLANTING;
            }

            let armor = prop_i32(pawn, "m_ArmorValue").clamp(0, 255) as u8;
            let inv = inventory.get(&steam);
            let mut gear = armor_gear(ctrl, pawn, armor);
            let mut primary = 0u8;
            let mut secondary = 0u8;
            if let Some(inv) = inv {
                gear |= inv.gear;
                primary = inv.primary;
                secondary = inv.secondary;
            }
            let active = pawn_active_weapon(ctx, pawn);
            let (clip, reserve) = self
                .last_ammo
                .get(&(steam, active))
                .copied()
                .unwrap_or((0, 0));

            players.push(RawFramePlayer {
                steam_id: steam,
                x,
                y,
                z,
                yaw: pawn_yaw(pawn),
                health: prop_i32(pawn, "m_iHealth").clamp(0, 255) as u8,
                armor,
                flags,
                money: controller_money(ctrl),
                equip: pawn_equip_value(pawn),
                gear,
                primary,
                secondary,
                active,
                clip,
                reserve,
            });
        }
        self.frames.push(RawFrame { tick, players });

        for e in ctx.entities().iter() {
            if let Some(kind) = proj_kind(e) {
                let (x, y, z) = entity_xyz(e);
                let thrower = steam_from_pawn_handle(self, ctx, prop_u32(e, "m_hThrower") as i32);
                self.proj_points
                    .push((e.index(), tick, kind, x, y, z, thrower));
            }
        }

        Ok(())
    }

    #[on_game_event]
    fn on_game_event(&mut self, ctx: &Context, ge: &GameEvent) -> ObserverResult {
        let tick = ctx.tick();
        if self.opts.skip_warmup && in_warmup(ctx) {
            return Ok(());
        }

        if let (Some(uid), Some(ph)) = (ev_i32(ge, "userid"), ev_i32(ge, "userid_pawn")) {
            if !self.userid_to_steam.contains_key(&uid) {
                if let Some(s) = steam_from_pawn_handle(self, ctx, ph) {
                    self.userid_to_steam.insert(uid, s);
                }
            }
        }

        match ge.name() {
            "round_start" => {
                if !in_warmup(ctx) {
                    self.round_starts.push(tick);
                }
            }
            "round_freeze_end" => {
                if !in_warmup(ctx) {
                    self.freeze_ends.push(tick);
                    self.round_scores.insert(tick, team_scores(ctx));
                    self.round_names.insert(tick, team_names(ctx));
                    self.round_equip.insert(tick, max_equipment(ctx));
                }
            }
            "round_officially_ended" => {
                if in_warmup(ctx) {
                    return Ok(());
                }
                let winner = gamerules_i32(ctx, "m_pGameRules.m_iRoundWinStatus").and_then(side_of);
                let reason = gamerules_i32(ctx, "m_pGameRules.m_eRoundWinReason").unwrap_or(0);
                self.official_ends.push((tick, winner, reason));
            }
            "cs_pre_restart" => {
                if !in_warmup(ctx) {
                    self.pre_restarts.push(tick);
                }
            }
            "cs_win_panel_match" => {
                self.final_winner =
                    gamerules_i32(ctx, "m_pGameRules.m_iRoundWinStatus").and_then(side_of);
                self.final_reason =
                    gamerules_i32(ctx, "m_pGameRules.m_eRoundWinReason").unwrap_or(0);
                self.final_score = Some(team_scores(ctx));
                self.final_names = Some(team_names(ctx));
            }
            "player_hurt" => {
                let dmg = ev_i32(ge, "dmg_health").unwrap_or(0);
                if dmg <= 0 {
                    return Ok(());
                }
                let atk = ev_i32(ge, "attacker_pawn");
                let vic = ev_i32(ge, "userid_pawn");
                if atk.is_none() || atk == vic {
                    return Ok(());
                }
                let attacker = atk.and_then(|h| steam_from_pawn_handle(self, ctx, h));
                let victim = vic.and_then(|h| steam_from_pawn_handle(self, ctx, h));
                let mut weapon = ev_str(ge, "weapon").unwrap_or_default();
                if let Some(h) = atk {
                    if let Ok(pawn) = ctx.entities().get_by_handle(h as u32 as usize) {
                        weapon = refine_hurt_weapon(&weapon, pawn_active_weapon(ctx, pawn));
                    }
                }
                self.hurts.push(RawHurt {
                    tick,
                    attacker,
                    victim,
                    damage: dmg,
                    damage_armor: ev_i32(ge, "dmg_armor").unwrap_or(0),
                    hitgroup: hurt_hitgroup(ev_i32(ge, "hitgroup")),
                    health: ev_i32(ge, "health").unwrap_or(0),
                    armor: ev_i32(ge, "armor").unwrap_or(0),
                    weapon,
                });
            }
            "player_death" => {
                let victim =
                    ev_i32(ge, "userid_pawn").and_then(|h| steam_from_pawn_handle(self, ctx, h));
                let attacker =
                    ev_i32(ge, "attacker_pawn").and_then(|h| steam_from_pawn_handle(self, ctx, h));
                let assister =
                    ev_i32(ge, "assister_pawn").and_then(|h| steam_from_pawn_handle(self, ctx, h));
                let (mut x, mut y, mut z) = (0.0, 0.0, 0.0);
                if let Some(h) = ev_i32(ge, "userid_pawn") {
                    if let Ok(p) = ctx.entities().get_by_handle(h as u32 as usize) {
                        (x, y, z) = entity_xyz(p);
                    }
                }
                let (mut attacker_x, mut attacker_y, mut attacker_z) = (0.0, 0.0, 0.0);
                if let Some(h) = ev_i32(ge, "attacker_pawn") {
                    if let Ok(p) = ctx.entities().get_by_handle(h as u32 as usize) {
                        (attacker_x, attacker_y, attacker_z) = entity_xyz(p);
                    }
                }
                self.kills.push(RawKill {
                    tick,
                    attacker,
                    victim,
                    assister,
                    weapon: ev_str(ge, "weapon").unwrap_or_default(),
                    headshot: ev_bool(ge, "headshot"),
                    assisted_flash: ev_bool(ge, "assistedflash"),
                    wallbang: kill_wallbang(ev_i32(ge, "penetrated")),
                    noscope: ev_bool(ge, "noscope"),
                    through_smoke: ev_bool(ge, "thrusmoke"),
                    attacker_blind: ev_bool(ge, "attackerblind"),
                    attacker_airborne: ev_bool(ge, "attackerinair"),
                    x,
                    y,
                    z,
                    attacker_x,
                    attacker_y,
                    attacker_z,
                });
            }
            name @ ("bomb_planted" | "bomb_defused" | "bomb_exploded" | "bomb_begindefuse"
            | "bomb_abortdefuse" | "bomb_pickup" | "bomb_dropped" | "bomb_beginplant") => {
                let kind = match name {
                    "bomb_planted" => BombKind::Planted,
                    "bomb_defused" => BombKind::Defused,
                    "bomb_begindefuse" => BombKind::BeginDefuse,
                    "bomb_abortdefuse" => BombKind::AbortDefuse,
                    "bomb_pickup" => BombKind::Pickup,
                    "bomb_dropped" => BombKind::Dropped,
                    "bomb_beginplant" => BombKind::BeginPlant,
                    _ => BombKind::Exploded,
                };
                let player = steam_from_game_event(self, ctx, ge);
                let (mut x, mut y, mut z) = (0.0, 0.0, 0.0);
                if kind == BombKind::Dropped {
                    if let Some(idx) = ev_i32(ge, "entindex") {
                        if let Some(pos) = entity_xyz_by_index(ctx, idx) {
                            (x, y, z) = pos;
                        }
                    }
                }
                if x == 0.0 && y == 0.0 {
                    if let Some(h) = ev_i32(ge, "userid_pawn") {
                        if let Ok(p) = ctx.entities().get_by_handle(h as u32 as usize) {
                            (x, y, z) = entity_xyz(p);
                        }
                    }
                }
                let site = if kind == BombKind::Planted {
                    ev_i32(ge, "site").and_then(|s| u8::try_from(s).ok())
                } else {
                    None
                };
                self.bomb_events
                    .push((tick, kind, player, x, y, z, ev_haskit(ge), site));
            }
            name @ ("smokegrenade_detonate"
            | "inferno_startburn"
            | "hegrenade_detonate"
            | "flashbang_detonate"
            | "decoy_detonate"
            | "molotov_detonate") => {
                let kind = match name {
                    "smokegrenade_detonate" => GrenadeKind::Smoke,
                    "inferno_startburn" | "molotov_detonate" => GrenadeKind::Molotov,
                    "hegrenade_detonate" => GrenadeKind::He,
                    "flashbang_detonate" => GrenadeKind::Flash,
                    _ => GrenadeKind::Decoy,
                };
                let id = ev_i32(ge, "entityid").unwrap_or(0);
                if kind == GrenadeKind::Flash {
                    if let Some(thrower) = thrower_from_nade_entity(self, ctx, id) {
                        self.last_flash_thrower = Some(thrower);
                    }
                }
                self.grenade_dets.push((
                    tick,
                    kind,
                    id,
                    ev_f32(ge, "x"),
                    ev_f32(ge, "y"),
                    ev_f32(ge, "z"),
                ));
            }
            "smokegrenade_expired" | "inferno_expire" => {
                let id = ev_i32(ge, "entityid").unwrap_or(0);
                self.grenade_ends.push((id, tick));
            }
            "weapon_fire" => {
                let w = ev_str(ge, "weapon").unwrap_or_default();
                if !is_bullet_weapon(&w) {
                    return Ok(());
                }
                if let Some(ph) = ev_i32(ge, "userid_pawn") {
                    if let Ok(p) = ctx.entities().get_by_handle(ph as u32 as usize) {
                        let (x, y, _) = entity_xyz(p);
                        let steam = steam_from_pawn_handle(self, ctx, ph);
                        self.shots.push((tick, steam, x, y, pawn_yaw(p)));
                    }
                }
            }
            "bullet_impact" => {
                // Optional: some GOTV demos include impact points. We keep weapon_fire
                // tracers as the primary shot viz; impacts are not stored separately
                // in the MVP snapshot.
            }
            "player_blind" => {
                let dur = ev_f32(ge, "blind_duration");
                if let Some(victim) =
                    steam_from_event_player(self, ctx, ge, "userid_pawn", "userid")
                {
                    let attacker =
                        steam_from_event_player(self, ctx, ge, "attacker_pawn", "attacker")
                            .or(self.last_flash_thrower);
                    if let Some(thrower) = attacker {
                        self.last_flash_thrower = Some(thrower);
                    }
                    self.record_blind(tick, victim, dur, attacker);
                }
            }
            _ => {}
        }
        Ok(())
    }
}
