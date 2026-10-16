//! Copy `CNETMsg_SetConVar` and the tournament defaults table into [`MatchInfo`].

use std::collections::BTreeMap;

use crate::constants::CONVAR_DEFAULTS;
use crate::{ConvarTables, ConvarUpdate, GameRulesSnapshot, MatchInfo, TeamHalves};

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
    MatchInfo {
        convars: ConvarTables {
            defaults: default_convars(),
            demo: parts.convar_latest.clone(),
        },
        convar_updates: parts.convar_updates.to_vec(),
        rules: parts.rules.clone(),
        teams: parts.teams.clone(),
        server_name: parts.server_name.to_string(),
        build_num: parts.build_num,
        patch_version: parts.patch_version,
        observed: crate::ObservedMatch::default(),
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

fn default_convars() -> BTreeMap<String, String> {
    CONVAR_DEFAULTS
        .iter()
        .map(|(name, value)| ((*name).to_string(), (*value).to_string()))
        .collect()
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
    use crate::constants::OVERTIME_START_MONEY;

    fn latest(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs
            .iter()
            .map(|(name, value)| ((*name).to_string(), (*value).to_string()))
            .collect()
    }

    fn empty_info() -> MatchInfo {
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

    #[test]
    fn defaults_contain_exactly_the_tournament_table() {
        let info = empty_info();
        let defaults: Vec<(&str, &str)> = info
            .convars
            .defaults
            .iter()
            .map(|(name, value)| (name.as_str(), value.as_str()))
            .collect();
        assert_eq!(
            defaults,
            vec![
                ("mp_buytime", "20"),
                ("mp_c4timer", "40"),
                ("mp_maxmoney", "16000"),
                ("mp_maxrounds", "24"),
                ("mp_overtime_maxrounds", "6"),
                ("mp_overtime_startmoney", "12500"),
                ("mp_roundtime", "1.92"),
                ("mp_roundtime_defuse", "1.92"),
                ("mp_startmoney", "800"),
            ]
        );
        assert!(!info.convars.defaults.contains_key("mp_freezetime"));
        assert!(info.convars.demo.is_empty());
        let overtime_money = OVERTIME_START_MONEY.to_string();
        assert_eq!(overtime_money, "12500");
        assert_eq!(
            info.convars
                .defaults
                .get("mp_overtime_startmoney")
                .map(String::as_str),
            Some(overtime_money.as_str())
        );
        let json = serde_json::to_value(&info)
            .unwrap_or_else(|err| panic!("could not serialize match info: {err}"));
        assert!(json["observed"].get("platform").is_none());
        assert!(json["observed"]["overtime_start_money"].is_null());
    }

    #[test]
    fn demo_keeps_a_value_equal_to_the_default_and_unknown_names() {
        let seen = latest(&[
            ("mp_maxrounds", "24"),
            ("mp_overtime_startmoney", "12500"),
            ("sv_server_graphic1", "faceit_logo_big.png"),
        ]);
        let info = build_match_info(MatchInfoParts {
            convar_latest: &seen,
            convar_updates: &[ConvarUpdate {
                tick: 0,
                name: "mp_maxrounds".into(),
                value: "24".into(),
            }],
            rules: &GameRulesSnapshot {
                overtime_playing: 3,
                ..GameRulesSnapshot::default()
            },
            teams: &TeamHalves::default(),
            server_name: "BLAST.tv",
            build_num: 10924,
            patch_version: 14189,
        });
        assert_eq!(
            info.convars.demo.get("mp_maxrounds").map(String::as_str),
            Some("24")
        );
        assert_eq!(
            info.convars
                .defaults
                .get("mp_maxrounds")
                .map(String::as_str),
            Some("24")
        );
        assert!(!info.convars.demo.contains_key("mp_overtime_maxrounds"));
        assert_eq!(
            info.convars
                .defaults
                .get("mp_overtime_maxrounds")
                .map(String::as_str),
            Some("6")
        );
        assert_eq!(
            info.convars
                .demo
                .get("mp_overtime_startmoney")
                .map(String::as_str),
            Some("12500")
        );
        assert_eq!(
            info.convars
                .demo
                .get("sv_server_graphic1")
                .map(String::as_str),
            Some("faceit_logo_big.png")
        );
        assert!(!info.convars.defaults.contains_key("sv_server_graphic1"));
        assert_eq!(info.rules.overtime_playing, 3);
        assert_eq!(info.server_name, "BLAST.tv");
        assert_eq!(info.build_num, 10924);
        assert_eq!(info.patch_version, 14189);
        assert_eq!(info.convar_updates.len(), 1);
    }

    #[test]
    fn demo_value_is_kept_verbatim_when_it_differs_from_the_table() {
        let seen = latest(&[("mp_overtime_startmoney", "10000")]);
        let info = build_match_info(MatchInfoParts {
            convar_latest: &seen,
            convar_updates: &[],
            rules: &GameRulesSnapshot::default(),
            teams: &TeamHalves::default(),
            server_name: "",
            build_num: 0,
            patch_version: 0,
        });
        assert_eq!(
            info.convars
                .demo
                .get("mp_overtime_startmoney")
                .map(String::as_str),
            Some("10000")
        );
        assert_eq!(
            info.convars
                .defaults
                .get("mp_overtime_startmoney")
                .map(String::as_str),
            Some("12500")
        );
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
    fn match_info_json_nests_demo_and_defaults() {
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
        assert!(json.get("mp_maxrounds").is_none());
        assert!(json.get("mp_overtime_maxrounds").is_none());
        assert!(json.get("mp_overtime_startmoney").is_none());
        assert_eq!(json["convars"]["demo"]["mp_maxrounds"], "24");
        assert!(json["convars"]["demo"]
            .get("mp_overtime_maxrounds")
            .is_none());
        assert!(json["convars"]["demo"]["mp_maxrounds"]
            .get("source")
            .is_none());
        assert_eq!(json["convars"]["defaults"]["mp_overtime_maxrounds"], "6");
        assert_eq!(
            json["convars"]["defaults"]["mp_overtime_startmoney"],
            "12500"
        );
        assert_eq!(json["convars"]["defaults"]["mp_c4timer"], "40");
        assert!(json["convars"]["defaults"].get("mp_freezetime").is_none());
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
}
