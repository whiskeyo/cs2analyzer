//! Low-level readers over Source 2 entities and game events.

use crate::types::{GrenadeKind, Side};
use source2_demo::prelude::*;
use std::sync::OnceLock;

pub(crate) fn prop_i32(e: &Entity, name: &str) -> i32 {
    match e.get_property(name) {
        Ok(FieldValue::Signed32(v)) => *v,
        Ok(FieldValue::Signed16(v)) => *v as i32,
        Ok(FieldValue::Signed8(v)) => *v as i32,
        Ok(FieldValue::Unsigned32(v)) => *v as i32,
        Ok(FieldValue::Unsigned16(v)) => *v as i32,
        Ok(FieldValue::Unsigned8(v)) => *v as i32,
        _ => 0,
    }
}

pub(crate) fn prop_bool(e: &Entity, name: &str) -> bool {
    matches!(e.get_property(name), Ok(FieldValue::Boolean(true)))
}

pub(crate) fn prop_vec3(e: &Entity, name: &str) -> Option<(f32, f32, f32)> {
    match e.get_property(name) {
        Ok(FieldValue::Vector3D(v)) => Some((v[0], v[1], v[2])),
        Ok(FieldValue::Vector2D(v)) => Some((v[0], v[1], 0.0)),
        _ => None,
    }
}

pub(crate) fn prop_truthy(e: &Entity, name: &str) -> bool {
    match e.get_property(name) {
        Ok(FieldValue::Boolean(v)) => *v,
        Ok(FieldValue::Unsigned8(v)) => *v != 0,
        Ok(FieldValue::Unsigned16(v)) => *v != 0,
        Ok(FieldValue::Unsigned32(v)) => *v != 0,
        Ok(FieldValue::Signed8(v)) => *v != 0,
        Ok(FieldValue::Signed16(v)) => *v != 0,
        Ok(FieldValue::Signed32(v)) => *v != 0,
        _ => false,
    }
}

pub(crate) fn prop_u64(e: &Entity, name: &str) -> u64 {
    match e.get_property(name) {
        Ok(FieldValue::Unsigned64(v)) => *v,
        Ok(FieldValue::Unsigned32(v)) => *v as u64,
        _ => 0,
    }
}

pub(crate) fn prop_u32(e: &Entity, name: &str) -> u32 {
    match e.get_property(name) {
        Ok(FieldValue::Unsigned32(v)) => *v,
        Ok(FieldValue::Unsigned16(v)) => *v as u32,
        Ok(FieldValue::Unsigned64(v)) => *v as u32,
        _ => 0,
    }
}

/// CS2 world coordinate: `cell * 512 - 16384 + offset`.
pub(crate) fn world_coord(e: &Entity, cell: &str, vec: &str) -> f32 {
    let c = match e.get_property(cell) {
        Ok(FieldValue::Unsigned16(v)) => *v as f32,
        Ok(FieldValue::Unsigned8(v)) => *v as f32,
        Ok(FieldValue::Unsigned32(v)) => *v as f32,
        _ => 0.0,
    };
    let v = match e.get_property(vec) {
        Ok(FieldValue::Float(v)) => *v,
        _ => 0.0,
    };
    c * 512.0 - 16384.0 + v
}

pub(crate) fn entity_xyz(e: &Entity) -> (f32, f32, f32) {
    (
        world_coord(e, "CBodyComponent.m_cellX", "CBodyComponent.m_vecX"),
        world_coord(e, "CBodyComponent.m_cellY", "CBodyComponent.m_vecY"),
        world_coord(e, "CBodyComponent.m_cellZ", "CBodyComponent.m_vecZ"),
    )
}

fn prop_yaw(e: &Entity, name: &str) -> Option<f32> {
    match e.get_property(name) {
        Ok(FieldValue::Float(v)) => Some(*v),
        Ok(FieldValue::Vector3D(a)) => Some(a[1]),
        Ok(FieldValue::Vector2D(a)) => Some(a[1]),
        _ => None,
    }
}

/// Engine yaw in degrees (0 = +X / east, 90 = +Y / north).
/// Prefer the QAngle vector — flattened `[1]` can sit at a stale 0.
pub(crate) fn pawn_yaw(e: &Entity) -> f32 {
    for name in ["m_angEyeAngles", "m_angEyeAngles[1]"] {
        if let Some(v) = prop_yaw(e, name) {
            return v;
        }
    }
    0.0
}

pub(crate) fn gamerules_i32(ctx: &Context, name: &str) -> Option<i32> {
    let proxy = ctx.entities().get_by_class_name("CCSGameRulesProxy").ok()?;
    match proxy.get_property(name) {
        Ok(FieldValue::Signed32(v)) => Some(*v),
        Ok(FieldValue::Unsigned32(v)) => Some(*v as i32),
        _ => None,
    }
}

pub(crate) fn gamerules_bool(ctx: &Context, name: &str) -> bool {
    let Ok(proxy) = ctx.entities().get_by_class_name("CCSGameRulesProxy") else {
        return false;
    };
    matches!(proxy.get_property(name), Ok(FieldValue::Boolean(true)))
}

pub(crate) fn in_warmup(ctx: &Context) -> bool {
    gamerules_bool(ctx, "m_pGameRules.m_bWarmupPeriod")
}

pub(crate) fn team_scores(ctx: &Context) -> (i32, i32) {
    let (mut ct, mut t) = (0, 0);
    for e in ctx.entities().iter() {
        if e.class().name() != "CCSTeam" {
            continue;
        }
        let score = prop_i32(e, "m_iScore");
        match prop_i32(e, "m_iTeamNum") {
            3 => ct = score,
            2 => t = score,
            _ => {}
        }
    }
    (ct, t)
}

pub(crate) fn max_equipment(ctx: &Context) -> i32 {
    let mut max_ev = 0;
    for ctrl in ctx.entities().iter() {
        if ctrl.class().name() != "CCSPlayerController" {
            continue;
        }
        let handle = prop_u32(ctrl, "m_hPlayerPawn");
        let Ok(pawn) = ctx.entities().get_by_handle(handle as usize) else {
            continue;
        };
        let cur = prop_i32(pawn, "m_unCurrentEquipmentValue")
            .max(prop_i32(pawn, "m_unRoundStartEquipmentValue"));
        if cur > max_ev {
            max_ev = cur;
        }
    }
    max_ev
}

pub(crate) fn team_names(ctx: &Context) -> (String, String) {
    let (mut ct, mut t) = (String::new(), String::new());
    for e in ctx.entities().iter() {
        if e.class().name() != "CCSTeam" {
            continue;
        }
        let name = match e.get_property("m_szClanTeamname") {
            Ok(FieldValue::String(s)) => s.trim_start_matches("team_").to_string(),
            _ => String::new(),
        };
        match prop_i32(e, "m_iTeamNum") {
            3 => ct = name,
            2 => t = name,
            _ => {}
        }
    }
    (ct, t)
}

pub(crate) fn ev_i32(ge: &GameEvent<'_>, key: &str) -> Option<i32> {
    ge.get_value(key).ok().and_then(|v| v.try_into().ok())
}

pub(crate) fn ev_f32(ge: &GameEvent<'_>, key: &str) -> f32 {
    ge.get_value(key)
        .ok()
        .and_then(|v| TryInto::<f32>::try_into(v).ok())
        .unwrap_or(0.0)
}

pub(crate) fn ev_str(ge: &GameEvent<'_>, key: &str) -> Option<String> {
    ge.get_value(key)
        .ok()
        .and_then(|v| TryInto::<String>::try_into(v).ok())
}

pub(crate) fn ev_bool(ge: &GameEvent<'_>, key: &str) -> bool {
    ge.get_value(key)
        .ok()
        .and_then(|v| v.try_into().ok())
        .unwrap_or(false)
}

pub(crate) fn controller_name(ctrl: &Entity) -> String {
    match ctrl.get_property("m_iszPlayerName") {
        Ok(FieldValue::String(s)) => s.clone(),
        _ => String::new(),
    }
}

pub(crate) fn proj_kind(class: &str) -> Option<GrenadeKind> {
    match class {
        "CSmokeGrenadeProjectile" => Some(GrenadeKind::Smoke),
        "CMolotovProjectile" | "CIncendiaryGrenadeProjectile" => Some(GrenadeKind::Molotov),
        "CHEGrenadeProjectile" => Some(GrenadeKind::He),
        "CFlashbangProjectile" => Some(GrenadeKind::Flash),
        "CDecoyProjectile" => Some(GrenadeKind::Decoy),
        _ => None,
    }
}

pub(crate) fn is_inferno_class(class: &str) -> bool {
    class == "CInferno" || class == "C_Inferno"
}

pub(crate) fn is_smoke_class(class: &str) -> bool {
    class == "CSmokeGrenadeProjectile" || class == "C_SmokeGrenadeProjectile"
}

pub(crate) fn prop_bytes(e: &Entity, name: &str) -> Vec<u8> {
    let mut out = Vec::new();
    if let Ok(iter) = e.get_iter(name) {
        for v in iter.flatten() {
            match v {
                FieldValue::Unsigned8(b) => out.push(*b),
                FieldValue::Signed8(b) => out.push(*b as u8),
                FieldValue::Unsigned32(b) => out.push(*b as u8),
                FieldValue::Signed32(b) => out.push(*b as u8),
                _ => {}
            }
        }
    }
    if !out.is_empty() {
        return out;
    }
    for i in 0..8192usize {
        let key = format!("{name}.{i}");
        let padded = format!("{name}.{i:04}");
        let val = e.get_property(&key).or_else(|_| e.get_property(&padded));
        match val {
            Ok(FieldValue::Unsigned8(b)) => out.push(*b),
            Ok(FieldValue::Signed8(b)) => out.push(*b as u8),
            Ok(FieldValue::Unsigned32(b)) => out.push(*b as u8),
            Err(_) => break,
            _ => break,
        }
    }
    out
}

static VOXEL_DATA_PROP: OnceLock<String> = OnceLock::new();

fn discover_voxel_prop(e: &Entity) -> Option<String> {
    for f in e.fields() {
        if f.name.contains("VoxelFrameData")
            && !f.name.contains("Size")
            && !f.name.contains("Update")
        {
            return Some(f.name.split('.').next().unwrap_or(&f.name).to_string());
        }
    }
    None
}

pub(crate) fn smoke_voxel_bytes(e: &Entity) -> Vec<u8> {
    let mut bytes = prop_bytes(e, "m_VoxelFrameData");
    if bytes.is_empty() {
        if let Some(name) = VOXEL_DATA_PROP.get() {
            bytes = prop_bytes(e, name);
        } else if let Some(name) = discover_voxel_prop(e) {
            bytes = prop_bytes(e, &name);
            let _ = VOXEL_DATA_PROP.set(name);
        }
    }
    let size = prop_i32(e, "m_nVoxelFrameDataSize");
    if size > 0 {
        bytes.truncate((size as usize).min(bytes.len()));
    }
    bytes
}

pub(crate) fn is_knife_weapon(weapon: &str) -> bool {
    let w = weapon.to_ascii_lowercase();
    w.contains("knife")
        || w.contains("bayonet")
        || w.contains("karambit")
        || w.contains("kukri")
        || w.contains("butterfly")
}

pub(crate) fn is_utility_weapon(weapon: &str) -> bool {
    let w = weapon.to_ascii_lowercase();
    w.contains("hegrenade")
        || w.contains("inferno")
        || w.contains("molotov")
        || w.contains("incgrenade")
}

pub(crate) fn is_bullet_weapon(weapon: &str) -> bool {
    let w = weapon.to_ascii_lowercase();
    let skip = [
        "knife",
        "bayonet",
        "grenade",
        "flash",
        "smoke",
        "molotov",
        "incgrenade",
        "inc_",
        "decoy",
        "c4",
        "bomb",
        "taser",
        "zeus",
        "healthshot",
    ];
    !skip.iter().any(|s| w.contains(s))
}

pub(crate) fn side_of(team: i32) -> Option<Side> {
    Side::from_team_num(team)
}
