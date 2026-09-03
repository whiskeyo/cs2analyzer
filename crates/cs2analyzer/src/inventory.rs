//! Per-tick money, armor flags, and compact loadout ids.

use crate::props::{prop_i32, prop_truthy, prop_u32, prop_u64};
use source2_demo::prelude::*;
use std::collections::HashMap;

pub const GEAR_HE: u16 = 1 << 0;
pub const GEAR_FLASH: u16 = 1 << 1;
pub const GEAR_FLASH2: u16 = 1 << 2;
pub const GEAR_SMOKE: u16 = 1 << 3;
pub const GEAR_MOLLY: u16 = 1 << 4;
pub const GEAR_DECOY: u16 = 1 << 5;
pub const GEAR_HELMET: u16 = 1 << 6;
pub const GEAR_DEFUSER: u16 = 1 << 7;
pub const GEAR_ZEUS: u16 = 1 << 8;
pub const GEAR_C4: u16 = 1 << 9;
pub const GEAR_KEVLAR: u16 = 1 << 10;
pub const GEAR_INC: u16 = 1 << 11;

#[allow(dead_code)]
pub const WID_NONE: u8 = 0;
pub const WID_KNIFE: u8 = 1;
pub const WID_TASER: u8 = 2;
pub const WID_C4: u8 = 3;
pub const WID_GLOCK: u8 = 4;
pub const WID_USP: u8 = 5;
pub const WID_P2000: u8 = 6;
pub const WID_ELITE: u8 = 7;
pub const WID_P250: u8 = 8;
pub const WID_TEC9: u8 = 9;
pub const WID_FIVESEVEN: u8 = 10;
pub const WID_CZ75: u8 = 11;
pub const WID_DEAGLE: u8 = 12;
pub const WID_REVOLVER: u8 = 13;
pub const WID_MAC10: u8 = 14;
pub const WID_MP9: u8 = 15;
pub const WID_MP7: u8 = 16;
pub const WID_MP5SD: u8 = 17;
pub const WID_UMP45: u8 = 18;
pub const WID_P90: u8 = 19;
pub const WID_BIZON: u8 = 20;
pub const WID_GALIL: u8 = 21;
pub const WID_FAMAS: u8 = 22;
pub const WID_AK47: u8 = 23;
pub const WID_M4A4: u8 = 24;
pub const WID_M4A1S: u8 = 25;
pub const WID_SSG08: u8 = 26;
pub const WID_AUG: u8 = 27;
pub const WID_SG553: u8 = 28;
pub const WID_AWP: u8 = 29;
pub const WID_SCAR20: u8 = 30;
pub const WID_G3SG1: u8 = 31;
pub const WID_NOVA: u8 = 32;
pub const WID_XM1014: u8 = 33;
pub const WID_MAG7: u8 = 34;
pub const WID_SAWEDOFF: u8 = 35;
pub const WID_M249: u8 = 36;
pub const WID_NEGEV: u8 = 37;
pub const WID_HE: u8 = 38;
pub const WID_FLASH: u8 = 39;
pub const WID_SMOKE: u8 = 40;
pub const WID_MOLLY: u8 = 41;
pub const WID_INC: u8 = 42;
pub const WID_DECOY: u8 = 43;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Slot {
    Primary,
    Secondary,
    Nade,
    Gear,
}

#[derive(Clone, Copy, Default)]
pub struct Loadout {
    pub gear: u16,
    pub primary: u8,
    pub secondary: u8,
}

pub fn controller_money(ctrl: &Entity) -> u16 {
    for name in ["m_pInGameMoneyServices.m_iAccount", "m_iAccount"] {
        let v = prop_i32(ctrl, name);
        if v != 0 {
            return v.clamp(0, u16::MAX as i32) as u16;
        }
    }
    0
}

pub fn pawn_equip_value(pawn: &Entity) -> u16 {
    let v = prop_i32(pawn, "m_unCurrentEquipmentValue")
        .max(prop_i32(pawn, "m_unRoundStartEquipmentValue"));
    v.clamp(0, u16::MAX as i32) as u16
}

pub fn armor_gear(ctrl: &Entity, pawn: &Entity, armor: u8) -> u16 {
    let mut gear = 0u16;
    if armor > 0 {
        gear |= GEAR_KEVLAR;
    }
    if prop_truthy(pawn, "m_pItemServices.m_bHasHelmet")
        || prop_truthy(pawn, "m_bHasHelmet")
        || prop_truthy(ctrl, "m_bPawnHasHelmet")
    {
        gear |= GEAR_HELMET | GEAR_KEVLAR;
    }
    if prop_truthy(pawn, "m_pItemServices.m_bHasDefuser")
        || prop_truthy(pawn, "m_bHasDefuser")
        || prop_truthy(ctrl, "m_bPawnHasDefuser")
    {
        gear |= GEAR_DEFUSER;
    }
    gear
}

pub fn collect_loadouts(ctx: &Context, pawn_to_steam: &HashMap<u32, u64>) -> HashMap<u64, Loadout> {
    let mut out: HashMap<u64, Loadout> = HashMap::new();
    for e in ctx.entities().iter() {
        let Some((wid, slot)) = classify_entity(e) else {
            continue;
        };
        let Some(steam) = owner_steam(ctx, pawn_to_steam, e) else {
            continue;
        };
        let entry = out.entry(steam).or_default();
        match slot {
            Slot::Primary => entry.primary = wid,
            Slot::Secondary => entry.secondary = wid,
            Slot::Nade => add_nade(&mut entry.gear, wid),
            Slot::Gear => add_gear(&mut entry.gear, wid),
        }
    }
    out
}

fn add_nade(gear: &mut u16, wid: u8) {
    match wid {
        WID_HE => *gear |= GEAR_HE,
        WID_FLASH => {
            if *gear & GEAR_FLASH != 0 {
                *gear |= GEAR_FLASH2;
            } else {
                *gear |= GEAR_FLASH;
            }
        }
        WID_SMOKE => *gear |= GEAR_SMOKE,
        WID_MOLLY => *gear |= GEAR_MOLLY,
        WID_INC => *gear |= GEAR_INC,
        WID_DECOY => *gear |= GEAR_DECOY,
        _ => {}
    }
}

fn add_gear(gear: &mut u16, wid: u8) {
    match wid {
        WID_TASER => *gear |= GEAR_ZEUS,
        WID_C4 => *gear |= GEAR_C4,
        _ => {}
    }
}

fn owner_steam(ctx: &Context, pawn_to_steam: &HashMap<u32, u64>, e: &Entity) -> Option<u64> {
    for name in ["m_hOwnerEntity", "m_hOwner"] {
        let handle = prop_u32(e, name);
        if handle == 0 || handle == u32::MAX {
            continue;
        }
        let Ok(owner) = ctx.entities().get_by_handle(handle as usize) else {
            continue;
        };
        if let Some(&steam) = pawn_to_steam.get(&owner.index()) {
            return Some(steam);
        }
        let steam = prop_u64(owner, "m_steamID");
        if steam != 0 {
            return Some(steam);
        }
        let pawn_handle = prop_u32(owner, "m_hPlayerPawn");
        if pawn_handle != 0 && pawn_handle != u32::MAX {
            if let Ok(pawn) = ctx.entities().get_by_handle(pawn_handle as usize) {
                if let Some(&steam) = pawn_to_steam.get(&pawn.index()) {
                    return Some(steam);
                }
            }
        }
    }
    None
}

fn classify_entity(e: &Entity) -> Option<(u8, Slot)> {
    let class = e.class().name();
    let lower = class.to_ascii_lowercase();
    if lower.contains("projectile") || lower.contains("planted") {
        return None;
    }
    if let Some(pair) = classify_def_index(item_def_index(e)) {
        return Some(pair);
    }
    classify_class(class)
}

fn item_def_index(e: &Entity) -> i32 {
    for name in [
        "m_AttributeManager.m_Item.m_iItemDefinitionIndex",
        "m_iItemDefinitionIndex",
    ] {
        let v = prop_i32(e, name);
        if v != 0 {
            return v;
        }
    }
    0
}

fn classify_def_index(idx: i32) -> Option<(u8, Slot)> {
    let pair = match idx {
        1 => (WID_DEAGLE, Slot::Secondary),
        2 => (WID_ELITE, Slot::Secondary),
        3 => (WID_FIVESEVEN, Slot::Secondary),
        4 => (WID_GLOCK, Slot::Secondary),
        7 => (WID_AK47, Slot::Primary),
        8 => (WID_AUG, Slot::Primary),
        9 => (WID_AWP, Slot::Primary),
        10 => (WID_FAMAS, Slot::Primary),
        11 => (WID_G3SG1, Slot::Primary),
        13 => (WID_GALIL, Slot::Primary),
        14 => (WID_M249, Slot::Primary),
        16 => (WID_M4A4, Slot::Primary),
        17 => (WID_MAC10, Slot::Primary),
        19 => (WID_P90, Slot::Primary),
        23 => (WID_MP5SD, Slot::Primary),
        24 => (WID_UMP45, Slot::Primary),
        25 => (WID_XM1014, Slot::Primary),
        26 => (WID_BIZON, Slot::Primary),
        27 => (WID_MAG7, Slot::Primary),
        28 => (WID_NEGEV, Slot::Primary),
        29 => (WID_SAWEDOFF, Slot::Primary),
        30 => (WID_TEC9, Slot::Secondary),
        31 => (WID_TASER, Slot::Gear),
        32 => (WID_P2000, Slot::Secondary),
        33 => (WID_MP7, Slot::Primary),
        34 => (WID_MP9, Slot::Primary),
        35 => (WID_NOVA, Slot::Primary),
        36 => (WID_P250, Slot::Secondary),
        38 => (WID_SCAR20, Slot::Primary),
        39 => (WID_SG553, Slot::Primary),
        40 => (WID_SSG08, Slot::Primary),
        41 | 42 | 59 => (WID_KNIFE, Slot::Gear),
        43 => (WID_FLASH, Slot::Nade),
        44 => (WID_HE, Slot::Nade),
        45 => (WID_SMOKE, Slot::Nade),
        46 => (WID_MOLLY, Slot::Nade),
        47 => (WID_DECOY, Slot::Nade),
        48 => (WID_INC, Slot::Nade),
        49 => (WID_C4, Slot::Gear),
        60 => (WID_M4A1S, Slot::Primary),
        61 => (WID_USP, Slot::Secondary),
        63 => (WID_CZ75, Slot::Secondary),
        64 => (WID_REVOLVER, Slot::Secondary),
        500..=600 => (WID_KNIFE, Slot::Gear),
        _ => return None,
    };
    Some(pair)
}

fn classify_class(class: &str) -> Option<(u8, Slot)> {
    let c = class.to_ascii_lowercase();
    if c.contains("projectile") || c.contains("planted") {
        return None;
    }
    const NEEDLES: &[(&str, u8, Slot)] = &[
        ("m4a1_silencer", WID_M4A1S, Slot::Primary),
        ("m4a1silencer", WID_M4A1S, Slot::Primary),
        ("usp_silencer", WID_USP, Slot::Secondary),
        ("uspsilencer", WID_USP, Slot::Secondary),
        ("incendiary", WID_INC, Slot::Nade),
        ("incgrenade", WID_INC, Slot::Nade),
        ("hegrenade", WID_HE, Slot::Nade),
        ("flashbang", WID_FLASH, Slot::Nade),
        ("smokegrenade", WID_SMOKE, Slot::Nade),
        ("molotov", WID_MOLLY, Slot::Nade),
        ("decoy", WID_DECOY, Slot::Nade),
        ("ak47", WID_AK47, Slot::Primary),
        ("awp", WID_AWP, Slot::Primary),
        ("m4a1", WID_M4A4, Slot::Primary),
        ("m4a4", WID_M4A4, Slot::Primary),
        ("galilar", WID_GALIL, Slot::Primary),
        ("galil", WID_GALIL, Slot::Primary),
        ("famas", WID_FAMAS, Slot::Primary),
        ("aug", WID_AUG, Slot::Primary),
        ("sg556", WID_SG553, Slot::Primary),
        ("sg553", WID_SG553, Slot::Primary),
        ("ssg08", WID_SSG08, Slot::Primary),
        ("scar20", WID_SCAR20, Slot::Primary),
        ("g3sg1", WID_G3SG1, Slot::Primary),
        ("mac10", WID_MAC10, Slot::Primary),
        ("mp5sd", WID_MP5SD, Slot::Primary),
        ("mp9", WID_MP9, Slot::Primary),
        ("mp7", WID_MP7, Slot::Primary),
        ("ump45", WID_UMP45, Slot::Primary),
        ("p90", WID_P90, Slot::Primary),
        ("bizon", WID_BIZON, Slot::Primary),
        ("nova", WID_NOVA, Slot::Primary),
        ("xm1014", WID_XM1014, Slot::Primary),
        ("mag7", WID_MAG7, Slot::Primary),
        ("sawedoff", WID_SAWEDOFF, Slot::Primary),
        ("m249", WID_M249, Slot::Primary),
        ("negev", WID_NEGEV, Slot::Primary),
        ("deagle", WID_DEAGLE, Slot::Secondary),
        ("revolver", WID_REVOLVER, Slot::Secondary),
        ("glock", WID_GLOCK, Slot::Secondary),
        ("hkp2000", WID_P2000, Slot::Secondary),
        ("p2000", WID_P2000, Slot::Secondary),
        ("elite", WID_ELITE, Slot::Secondary),
        ("p250", WID_P250, Slot::Secondary),
        ("tec9", WID_TEC9, Slot::Secondary),
        ("fiveseven", WID_FIVESEVEN, Slot::Secondary),
        ("cz75", WID_CZ75, Slot::Secondary),
        ("taser", WID_TASER, Slot::Gear),
        ("flash", WID_FLASH, Slot::Nade),
        ("smoke", WID_SMOKE, Slot::Nade),
        ("c4", WID_C4, Slot::Gear),
        ("knife", WID_KNIFE, Slot::Gear),
        ("bayonet", WID_KNIFE, Slot::Gear),
        ("karambit", WID_KNIFE, Slot::Gear),
        ("kukri", WID_KNIFE, Slot::Gear),
    ];
    for (needle, wid, slot) in NEEDLES {
        if c.contains(needle) {
            return Some((*wid, *slot));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn class_names() {
        assert_eq!(classify_class("CAK47"), Some((WID_AK47, Slot::Primary)));
        assert_eq!(
            classify_class("C_WeaponM4A1Silencer"),
            Some((WID_M4A1S, Slot::Primary))
        );
        assert_eq!(
            classify_class("C_WeaponM4A1"),
            Some((WID_M4A4, Slot::Primary))
        );
        assert_eq!(classify_class("CFlashbang"), Some((WID_FLASH, Slot::Nade)));
        assert_eq!(
            classify_class("CIncendiaryGrenade"),
            Some((WID_INC, Slot::Nade))
        );
        assert_eq!(
            classify_class("CMolotovGrenade"),
            Some((WID_MOLLY, Slot::Nade))
        );
        assert_eq!(classify_class("CSmokeGrenadeProjectile"), None);
        assert_eq!(classify_class("CPlantedC4"), None);
    }

    #[test]
    fn def_indices() {
        assert_eq!(classify_def_index(7), Some((WID_AK47, Slot::Primary)));
        assert_eq!(classify_def_index(60), Some((WID_M4A1S, Slot::Primary)));
        assert_eq!(classify_def_index(507), Some((WID_KNIFE, Slot::Gear)));
        assert_eq!(classify_def_index(46), Some((WID_MOLLY, Slot::Nade)));
        assert_eq!(classify_def_index(48), Some((WID_INC, Slot::Nade)));
    }

    #[test]
    fn incendiary_gear_is_not_molotov() {
        let mut gear = 0u16;
        add_nade(&mut gear, WID_INC);
        assert_eq!(gear, GEAR_INC);
        assert_eq!(gear & GEAR_MOLLY, 0);
        add_nade(&mut gear, WID_MOLLY);
        assert_eq!(gear, GEAR_INC | GEAR_MOLLY);
    }
}
