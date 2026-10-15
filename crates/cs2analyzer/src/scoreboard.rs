//! Round-end scoreboard from `CCSPlayerController` action-tracking counters.
//!
//! The server keeps these totals on the controller (`m_matchStats`). A dead
//! human who takes a bot still receives the kills and damage on the human
//! controller, so the bot body is not a second row. A bot with no human
//! controlling it is a real player and stays.

use std::collections::BTreeSet;

use crate::types::{Round, RoundScoreboardPlayer, Side};

/// `m_pActionTrackingServices.m_matchStats` on `CCSPlayerController`.
pub(crate) const MATCH_KILLS: &str = "m_pActionTrackingServices.m_matchStats.m_iKills";
pub(crate) const MATCH_DEATHS: &str = "m_pActionTrackingServices.m_matchStats.m_iDeaths";
pub(crate) const MATCH_ASSISTS: &str = "m_pActionTrackingServices.m_matchStats.m_iAssists";
pub(crate) const MATCH_DAMAGE: &str = "m_pActionTrackingServices.m_matchStats.m_iDamage";
pub(crate) const MATCH_HEADSHOT_KILLS: &str =
    "m_pActionTrackingServices.m_matchStats.m_iHeadShotKills";
pub(crate) const MATCH_UTILITY_DAMAGE: &str =
    "m_pActionTrackingServices.m_matchStats.m_iUtilityDamage";
pub(crate) const MATCH_ENEMIES_FLASHED: &str =
    "m_pActionTrackingServices.m_matchStats.m_iEnemiesFlashed";

/// One controller as read from the demo, before scoreboard inclusion.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScoreboardController {
    pub slot: u32,
    pub steam_id: u64,
    pub name: String,
    /// Bot body (`m_bIsBot`, or a team/named controller with no Steam id).
    pub is_bot: bool,
    pub is_hltv: bool,
    pub team_num: i32,
    pub controlling_bot: bool,
    pub has_controlled_bot_this_round: bool,
    /// `m_hOriginalControllerOfCurrentPawn` entity index, when it resolves.
    pub original_controller_slot: Option<u32>,
    pub kills: i32,
    pub deaths: i32,
    pub assists: i32,
    pub damage: i32,
    pub headshot_kills: i32,
    pub utility_damage: i32,
    pub enemies_flashed: i32,
}

/// Networked `m_bIsBot` is missing on current builds. A controller with no
/// Steam id on T/CT is a bot body. A name alone is not: GOTV, `DemoRecorder`,
/// and caster slots (`ESL GOTV`, `FantasyExpo TV`) also have steam 0.
pub fn controller_is_bot(steam_id: u64, bot_flag: bool, team_num: i32, name: &str) -> bool {
    if is_broadcast_name(name) {
        return false;
    }
    if bot_flag {
        return true;
    }
    if steam_id != 0 {
        return false;
    }
    Side::from_team_num(team_num).is_some()
}

pub fn controller_is_hltv(flag: bool, name: &str) -> bool {
    flag || is_broadcast_name(name)
}

fn is_broadcast_name(name: &str) -> bool {
    let name = name.trim().to_ascii_lowercase();
    name == "gotv"
        || name == "sourcetv"
        || name == "demorecorder"
        || name.contains("gotv")
        || name.ends_with(" tv")
}

/// Remember bot bodies a human is (or was, this round) controlling.
pub fn remember_human_controlled_bots(
    controllers: &[ScoreboardController],
    slots: &mut BTreeSet<u32>,
) {
    for controller in controllers {
        if let Some(slot) = human_controlled_bot_slot(controller) {
            slots.insert(slot);
        }
    }
}

fn human_controlled_bot_slot(controller: &ScoreboardController) -> Option<u32> {
    if controller.is_hltv || controller.is_bot || controller.steam_id == 0 {
        return None;
    }
    if !controller.controlling_bot && !controller.has_controlled_bot_this_round {
        return None;
    }
    controller.original_controller_slot
}

/// Rows for one round-end snapshot.
///
/// Humans stay, including when they are controlling a bot (the counters
/// already include that). A bot body is omitted when a human controls it.
/// A bot nobody is controlling stays.
pub fn scoreboard_players(
    controllers: &[ScoreboardController],
    human_controlled_bots: &BTreeSet<u32>,
) -> Vec<RoundScoreboardPlayer> {
    let mut suppressed = human_controlled_bots.clone();
    remember_human_controlled_bots(controllers, &mut suppressed);
    let mut rows = Vec::new();
    for controller in controllers {
        if !include_controller(controller, &suppressed) {
            continue;
        }
        rows.push(RoundScoreboardPlayer {
            steam_id: controller.steam_id,
            slot: controller.slot,
            name: controller.name.clone(),
            kills: controller.kills,
            deaths: controller.deaths,
            assists: controller.assists,
            damage: controller.damage,
            headshot_kills: controller.headshot_kills,
            utility_damage: controller.utility_damage,
            enemies_flashed: controller.enemies_flashed,
        });
    }
    rows.sort_by(|left, right| {
        left.slot
            .cmp(&right.slot)
            .then(left.steam_id.cmp(&right.steam_id))
            .then(left.name.cmp(&right.name))
    });
    rows
}

fn include_controller(controller: &ScoreboardController, suppressed: &BTreeSet<u32>) -> bool {
    if controller.is_hltv {
        return false;
    }
    if controller.is_bot || controller.steam_id == 0 {
        if !controller.is_bot || suppressed.contains(&controller.slot) {
            return false;
        }
        return true;
    }
    true
}

/// Counted rounds match `Match.rounds` after the last `begin_new_match`.
///
/// Knife rounds are numbered 0 and omitted. A demo with no `begin_new_match`
/// (legacy-spirit) keeps every non-knife round from the first one. Restart
/// fragments are not separate rows in `Match.rounds`; this does not invent any.
pub fn counted_scoreboard_round(round: &Round, last_begin_new_match: Option<u32>) -> bool {
    if round.is_knife {
        return false;
    }
    match last_begin_new_match {
        None => true,
        Some(begin) => round.end_tick >= begin,
    }
}

/// Players for one round.
///
/// Prefers the latest snap in `[end_tick, next_start)`. A demo-end read lands
/// there for the last round (`next_start` is `u32::MAX`), so that row matches
/// the controllers still on the server when the file stops. Earlier rounds
/// stay on the snap taken at their own end.
pub(crate) fn players_at_round_end<'a>(
    snaps: &'a [(u32, Vec<RoundScoreboardPlayer>)],
    round: &Round,
    next_start: u32,
) -> &'a [RoundScoreboardPlayer] {
    if let Some((_, rows)) = snaps
        .iter()
        .rev()
        .find(|(tick, _)| *tick >= round.end_tick && *tick < next_start)
    {
        return rows;
    }
    snaps
        .iter()
        .rev()
        .find(|(tick, _)| *tick >= round.start_tick && *tick <= round.end_tick)
        .map(|(_, rows)| rows.as_slice())
        .unwrap_or(&[])
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::Round;

    fn human(slot: u32, steam: u64, name: &str) -> ScoreboardController {
        ScoreboardController {
            slot,
            steam_id: steam,
            name: name.to_string(),
            is_bot: false,
            is_hltv: false,
            team_num: 3,
            controlling_bot: false,
            has_controlled_bot_this_round: false,
            original_controller_slot: None,
            kills: 4,
            deaths: 3,
            assists: 2,
            damage: 80,
            headshot_kills: 1,
            utility_damage: 10,
            enemies_flashed: 5,
        }
    }

    fn bot(slot: u32, name: &str) -> ScoreboardController {
        ScoreboardController {
            slot,
            steam_id: 0,
            name: name.to_string(),
            is_bot: true,
            is_hltv: false,
            team_num: 2,
            controlling_bot: false,
            has_controlled_bot_this_round: false,
            original_controller_slot: None,
            kills: 9,
            deaths: 1,
            assists: 0,
            damage: 200,
            headshot_kills: 4,
            utility_damage: 0,
            enemies_flashed: 0,
        }
    }

    fn round(number: u32, start: u32, end: u32, knife: bool) -> Round {
        Round {
            number,
            start_tick: start,
            freeze_end_tick: start + 64,
            end_tick: end,
            playback_end_tick: 0,
            winner: None,
            win_reason: 0,
            score_ct: 0,
            score_t: 0,
            round_time_s: 115,
            is_knife: knife,
            team_ct: String::new(),
            team_t: String::new(),
        }
    }

    #[test]
    fn human_controlling_a_bot_keeps_the_human_row_only() {
        let mut human = human(3, 76561198000000001, "alice");
        human.controlling_bot = true;
        human.original_controller_slot = Some(12);
        human.kills = 11;
        let bot = bot(12, "BOT Bob");
        let rows = scoreboard_players(&[human, bot], &BTreeSet::new());
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].steam_id, 76561198000000001);
        assert_eq!(rows[0].slot, 3);
        assert_eq!(rows[0].name, "alice");
        assert_eq!(rows[0].kills, 11);
    }

    #[test]
    fn sticky_control_still_hides_the_bot_after_the_flag_clears() {
        let human = human(3, 76561198000000001, "alice");
        let bot = bot(12, "BOT Bob");
        let mut sticky = BTreeSet::new();
        sticky.insert(12);
        let rows = scoreboard_players(&[human, bot], &sticky);
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].slot, 3);
    }

    #[test]
    fn genuine_bot_with_no_human_is_its_own_row() {
        let human = human(3, 76561198000000001, "alice");
        let bot = bot(8, "BOT Hans");
        let rows = scoreboard_players(&[bot, human], &BTreeSet::new());
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].slot, 3);
        assert_eq!(rows[1].slot, 8);
        assert_eq!(rows[1].steam_id, 0);
        assert_eq!(rows[1].name, "BOT Hans");
        assert_eq!(rows[1].damage, 200);
    }

    #[test]
    fn hltv_and_empty_slots_are_omitted() {
        let mut hltv = human(1, 1, "GOTV");
        hltv.is_hltv = true;
        let empty = ScoreboardController {
            slot: 2,
            steam_id: 0,
            name: String::new(),
            is_bot: false,
            is_hltv: false,
            team_num: 0,
            controlling_bot: false,
            has_controlled_bot_this_round: false,
            original_controller_slot: None,
            kills: 0,
            deaths: 0,
            assists: 0,
            damage: 0,
            headshot_kills: 0,
            utility_damage: 0,
            enemies_flashed: 0,
        };
        let rows = scoreboard_players(&[hltv, empty, human(4, 99, "bob")], &BTreeSet::new());
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "bob");
    }

    #[test]
    fn steam_zero_on_a_team_is_a_bot_without_the_networked_flag() {
        assert!(controller_is_bot(0, false, 2, ""));
        assert!(!controller_is_bot(0, false, 0, ""));
        assert!(!controller_is_bot(0, false, 0, "BOT Hans"));
        assert!(controller_is_bot(0, false, 2, "BOT Hans"));
        assert!(!controller_is_bot(0, false, 2, "DemoRecorder"));
        assert!(!controller_is_bot(0, false, 3, "ESL GOTV"));
        assert!(!controller_is_bot(0, false, 0, "FantasyExpo TV"));
        assert!(!controller_is_bot(0, false, 0, "GOTV"));
        assert!(!controller_is_bot(76561198000000001, false, 3, "alice"));
        assert!(controller_is_hltv(false, "GOTV"));
        assert!(controller_is_hltv(false, "DemoRecorder"));
        assert!(controller_is_hltv(false, "SourceTV"));
        assert!(controller_is_hltv(false, "FantasyExpo TV"));
    }

    #[test]
    fn counted_rounds_skip_knife_and_rounds_before_begin_new_match() {
        let knife = round(0, 10, 400, true);
        let early = round(1, 500, 900, false);
        let live = round(2, 1000, 2000, false);
        assert!(!counted_scoreboard_round(&knife, Some(1000)));
        assert!(!counted_scoreboard_round(&early, Some(1000)));
        assert!(counted_scoreboard_round(&live, Some(1000)));
        assert!(counted_scoreboard_round(&live, None));
        assert!(!counted_scoreboard_round(&knife, None));
        assert!(counted_scoreboard_round(&early, None));
    }

    #[test]
    fn round_end_snap_prefers_the_end_tick() {
        let round = round(3, 100, 500, false);
        let early = vec![crate::RoundScoreboardPlayer {
            steam_id: 1,
            slot: 1,
            name: "early".into(),
            kills: 1,
            deaths: 0,
            assists: 0,
            damage: 0,
            headshot_kills: 0,
            utility_damage: 0,
            enemies_flashed: 0,
        }];
        let at_end = vec![crate::RoundScoreboardPlayer {
            steam_id: 1,
            slot: 1,
            name: "end".into(),
            kills: 4,
            deaths: 0,
            assists: 0,
            damage: 0,
            headshot_kills: 0,
            utility_damage: 0,
            enemies_flashed: 0,
        }];
        let snaps = vec![(150, early), (500, at_end.clone())];
        assert_eq!(players_at_round_end(&snaps, &round, 900)[0].name, "end");
        let snaps = vec![(150, at_end.clone())];
        assert_eq!(players_at_round_end(&snaps, &round, 900)[0].kills, 4);
        assert!(players_at_round_end(&[], &round, 900).is_empty());
        let settled = vec![crate::RoundScoreboardPlayer {
            steam_id: 1,
            slot: 1,
            name: "settled".into(),
            kills: 9,
            deaths: 1,
            assists: 0,
            damage: 0,
            headshot_kills: 0,
            utility_damage: 0,
            enemies_flashed: 0,
        }];
        let snaps = vec![(500, at_end), (800, settled)];
        assert_eq!(
            players_at_round_end(&snaps, &round, u32::MAX)[0].name,
            "settled"
        );
        assert_eq!(players_at_round_end(&snaps, &round, 700)[0].name, "end");
    }
}
