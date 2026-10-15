//! Resolve `CNETMsg_SetConVar` plus the defaults table into [`MatchInfo`].

use std::collections::BTreeMap;

use crate::constants::{
    CONVAR_DEFAULTS, DEFAULT_MP_MAXROUNDS, DEFAULT_MP_OVERTIME_MAXROUNDS, OVERTIME_START_MONEY,
};
use crate::{ConvarEntry, ConvarSource, ConvarUpdate, GameRulesSnapshot, MatchInfo, TeamHalves};

/// Demo-sent convars (last value wins) plus the file header and the end snapshot.
pub(crate) struct MatchInfoParts<'a> {
    pub convar_latest: &'a BTreeMap<String, String>,
    pub convar_updates: &'a [ConvarUpdate],
    pub rules: &'a GameRulesSnapshot,
    pub teams: &'a TeamHalves,
    pub server_name: &'a str,
    pub build_num: i32,
    pub patch_version: i32,
}

pub(crate) fn build_match_info(parts: MatchInfoParts<'_>) -> MatchInfo {
    let convars = resolve_convars(parts.convar_latest);
    let mp_maxrounds = convar_i32(&convars, "mp_maxrounds", DEFAULT_MP_MAXROUNDS);
    let mp_overtime_maxrounds = convar_i32(
        &convars,
        "mp_overtime_maxrounds",
        DEFAULT_MP_OVERTIME_MAXROUNDS,
    );
    let mp_overtime_startmoney =
        convar_i32(&convars, "mp_overtime_startmoney", OVERTIME_START_MONEY);
    MatchInfo {
        convars,
        convar_updates: parts.convar_updates.to_vec(),
        mp_maxrounds,
        mp_overtime_maxrounds,
        mp_overtime_startmoney,
        rules: parts.rules.clone(),
        teams: parts.teams.clone(),
        server_name: parts.server_name.to_string(),
        build_num: parts.build_num,
        patch_version: parts.patch_version,
    }
}

impl Default for MatchInfo {
    fn default() -> Self {
        build_match_info(MatchInfoParts {
            convar_latest: &BTreeMap::new(),
            convar_updates: &[],
            rules: &GameRulesSnapshot::default(),
            teams: &TeamHalves::default(),
            server_name: "",
            build_num: 0,
            patch_version: 0,
        })
    }
}

/// Defaults for names the demo omitted, demo strings for names it sent.
fn resolve_convars(latest: &BTreeMap<String, String>) -> BTreeMap<String, ConvarEntry> {
    let mut convars = BTreeMap::new();
    for (name, default_value) in CONVAR_DEFAULTS {
        let (value, source) = match latest.get(*name) {
            Some(seen) => (seen.clone(), ConvarSource::Demo),
            None => ((*default_value).to_string(), ConvarSource::Default),
        };
        convars.insert((*name).to_string(), ConvarEntry { value, source });
    }
    for (name, value) in latest {
        convars.entry(name.clone()).or_insert(ConvarEntry {
            value: value.clone(),
            source: ConvarSource::Demo,
        });
    }
    convars
}

fn convar_i32(convars: &BTreeMap<String, ConvarEntry>, name: &str, fallback: i32) -> i32 {
    convars
        .get(name)
        .and_then(|entry| parse_convar_i32(&entry.value))
        .unwrap_or(fallback)
}

/// `24` and `12500`. A float string is accepted only when it is a whole number.
fn parse_convar_i32(raw: &str) -> Option<i32> {
    let text = raw.trim();
    if let Ok(value) = text.parse::<i32>() {
        return Some(value);
    }
    let value = text.parse::<f32>().ok()?;
    if !value.is_finite() {
        return None;
    }
    let whole = value.trunc();
    if (value - whole).abs() > f32::EPSILON {
        return None;
    }
    Some(whole as i32)
}

/// Record a convar when the value changes. `tick == u32::MAX` (signon) is stored as 0.
pub(crate) fn note_convar(
    latest: &mut BTreeMap<String, String>,
    updates: &mut Vec<ConvarUpdate>,
    tick: u32,
    name: &str,
    value: &str,
) {
    if name.is_empty() {
        return;
    }
    if latest.get(name).is_some_and(|previous| previous == value) {
        return;
    }
    let tick = if tick == u32::MAX { 0 } else { tick };
    latest.insert(name.to_string(), value.to_string());
    updates.push(ConvarUpdate {
        tick,
        name: name.to_string(),
        value: value.to_string(),
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::constants::{DEFAULT_MP_OVERTIME_MAXROUNDS, DEFAULT_MP_STARTMONEY};

    fn latest(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(name, value)| ((*name).to_string(), (*value).to_string()))
            .collect()
    }

    #[test]
    fn absent_overtime_maxrounds_uses_the_engine_default() {
        let info = build_match_info(MatchInfoParts {
            convar_latest: &BTreeMap::new(),
            convar_updates: &[],
            rules: &GameRulesSnapshot::default(),
            teams: &TeamHalves::default(),
            server_name: "",
            build_num: 0,
            patch_version: 0,
        });
        let entry = info
            .convars
            .get("mp_overtime_maxrounds")
            .expect("default row");
        assert_eq!(entry.value, "6");
        assert_eq!(entry.source, ConvarSource::Default);
        assert_eq!(info.mp_overtime_maxrounds, DEFAULT_MP_OVERTIME_MAXROUNDS);
        assert_eq!(info.mp_overtime_startmoney, OVERTIME_START_MONEY);
        assert_eq!(
            info.convars
                .get("mp_overtime_startmoney")
                .expect("start money")
                .source,
            ConvarSource::Default
        );
        assert_eq!(info.mp_maxrounds, DEFAULT_MP_MAXROUNDS);
        assert_eq!(
            info.convars
                .get("mp_startmoney")
                .expect("start money")
                .value,
            DEFAULT_MP_STARTMONEY.to_string()
        );
    }

    #[test]
    fn demo_value_wins_and_unknown_names_are_kept() {
        let seen = latest(&[
            ("mp_overtime_startmoney", "10000"),
            ("mp_maxrounds", "24"),
            ("sv_server_graphic1", "faceit_logo_big.png"),
        ]);
        let info = build_match_info(MatchInfoParts {
            convar_latest: &seen,
            convar_updates: &[ConvarUpdate {
                tick: 0,
                name: "mp_startmoney".into(),
                value: "0".into(),
            }],
            rules: &GameRulesSnapshot {
                overtime_playing: 3,
                ..GameRulesSnapshot::default()
            },
            teams: &TeamHalves::default(),
            server_name: "FACEIT",
            build_num: 10924,
            patch_version: 14189,
        });
        assert_eq!(info.mp_overtime_startmoney, 10000);
        assert_eq!(
            info.convars
                .get("mp_overtime_startmoney")
                .expect("row")
                .source,
            ConvarSource::Demo
        );
        assert_eq!(
            info.convars
                .get("mp_overtime_maxrounds")
                .expect("row")
                .source,
            ConvarSource::Default
        );
        let graphic = info.convars.get("sv_server_graphic1").expect("graphic");
        assert_eq!(graphic.value, "faceit_logo_big.png");
        assert_eq!(graphic.source, ConvarSource::Demo);
        assert_eq!(info.rules.overtime_playing, 3);
        assert_eq!(info.server_name, "FACEIT");
        assert_eq!(info.build_num, 10924);
        assert_eq!(info.patch_version, 14189);
        assert_eq!(info.convar_updates.len(), 1);
    }

    #[test]
    fn repeated_convar_value_is_not_appended() {
        let mut seen = BTreeMap::new();
        let mut updates = Vec::new();
        note_convar(&mut seen, &mut updates, u32::MAX, "mp_startmoney", "0");
        note_convar(&mut seen, &mut updates, 10, "mp_startmoney", "0");
        note_convar(&mut seen, &mut updates, 20, "mp_startmoney", "800");
        note_convar(&mut seen, &mut updates, 20, "", "ignored");
        assert_eq!(
            updates,
            vec![
                ConvarUpdate {
                    tick: 0,
                    name: "mp_startmoney".into(),
                    value: "0".into(),
                },
                ConvarUpdate {
                    tick: 20,
                    name: "mp_startmoney".into(),
                    value: "800".into(),
                },
            ]
        );
        assert_eq!(seen.get("mp_startmoney").map(String::as_str), Some("800"));
    }

    #[test]
    fn match_info_json_uses_convar_entries_and_rule_numbers() {
        let info = build_match_info(MatchInfoParts {
            convar_latest: &latest(&[("mp_maxrounds", "24")]),
            convar_updates: &[],
            rules: &GameRulesSnapshot {
                overtime_playing: 3,
                total_rounds_played: 42,
                game_phase: 5,
                ..GameRulesSnapshot::default()
            },
            teams: &TeamHalves {
                ct: crate::TeamHalfScores {
                    name: "A".into(),
                    score: 20,
                    score_first_half: 7,
                    score_second_half: 5,
                    score_overtime: 8,
                },
                t: crate::TeamHalfScores::default(),
            },
            server_name: "BLAST.tv",
            build_num: 10847,
            patch_version: 14172,
        });
        let json = serde_json::to_value(&info).expect("match_info json");
        assert_eq!(json["mp_maxrounds"], 24);
        assert_eq!(json["mp_overtime_maxrounds"], 6);
        assert_eq!(json["convars"]["mp_maxrounds"]["value"], "24");
        assert_eq!(json["convars"]["mp_maxrounds"]["source"], "demo");
        assert_eq!(
            json["convars"]["mp_overtime_maxrounds"]["source"],
            "default"
        );
        assert_eq!(json["convars"]["mp_overtime_startmoney"]["value"], "12500");
        assert_eq!(json["rules"]["m_nOvertimePlaying"], 3);
        assert_eq!(json["rules"]["m_totalRoundsPlayed"], 42);
        assert_eq!(json["rules"]["m_gamePhase"], 5);
        assert_eq!(json["teams"]["ct"]["m_iScore"], 20);
        assert_eq!(json["teams"]["ct"]["m_scoreFirstHalf"], 7);
        assert_eq!(json["teams"]["ct"]["m_scoreSecondHalf"], 5);
        assert_eq!(json["teams"]["ct"]["m_scoreOvertime"], 8);
        assert_eq!(json["server_name"], "BLAST.tv");
        assert_eq!(json["build_num"], 10847);
        assert_eq!(json["patch_version"], 14172);
    }

    #[test]
    fn defaults_table_is_sorted_and_matches_the_named_constants() {
        let mut previous = "";
        for (name, _value) in CONVAR_DEFAULTS {
            assert!(previous < *name, "{name} is not strictly after {previous}");
            previous = name;
        }
        let table = BTreeMap::from_iter(CONVAR_DEFAULTS.iter().copied());
        let maxrounds = DEFAULT_MP_MAXROUNDS.to_string();
        let overtime_rounds = DEFAULT_MP_OVERTIME_MAXROUNDS.to_string();
        let overtime_money = OVERTIME_START_MONEY.to_string();
        let startmoney = DEFAULT_MP_STARTMONEY.to_string();
        assert_eq!(table["mp_maxrounds"], maxrounds.as_str());
        assert_eq!(table["mp_overtime_maxrounds"], overtime_rounds.as_str());
        assert_eq!(table["mp_overtime_startmoney"], overtime_money.as_str());
        assert_eq!(table["mp_startmoney"], startmoney.as_str());
    }
}
