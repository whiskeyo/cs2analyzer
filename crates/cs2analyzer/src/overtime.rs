//! Overtime start money reconstructed at the end of buy time.
//!
//! For the first round of each overtime after the last `begin_new_match`,
//! every real player's `m_iAccount + m_iCashSpentThisRound` at
//! `round_freeze_end` must be the same number. That number is
//! `observed.overtime_start_money`. Anything else is null, including a match
//! that never reaches overtime.

use crate::constants::{FIRST_OVERTIME_ROUND, OVERTIME_PERIOD_ROUNDS};
use crate::types::MatchInfo;

/// One round in playback order. Competitive numbers are assigned after the
/// last `begin_new_match`, so a restarted demo does not keep the previous
/// match's round index.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct CashRound {
    pub start_tick: u32,
    pub is_knife: bool,
}

/// One player at `round_freeze_end`. Bots stay in the sample so the derivation
/// can drop them the same way the roster does (`is_bot_steam_id`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct BuytimePlayerCash {
    pub is_bot: bool,
    pub amount: i32,
}

/// Every playable controller at one `round_freeze_end` tick.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BuytimeCashSample {
    pub tick: u32,
    pub players: Vec<BuytimePlayerCash>,
}

pub(crate) fn is_overtime_opening_round(number: u32) -> bool {
    number >= FIRST_OVERTIME_ROUND
        && (number - FIRST_OVERTIME_ROUND).is_multiple_of(OVERTIME_PERIOD_ROUNDS)
}

/// `None` is JSON null: no overtime, a missing buy-time sample, or amounts
/// that are not all equal. Bots are ignored.
pub(crate) fn observed_overtime_start_money(
    rounds: &[CashRound],
    samples: &[BuytimeCashSample],
    last_begin_new_match: Option<u32>,
) -> Option<i32> {
    let mut competitive = 0u32;
    let mut seen: Option<i32> = None;
    let mut openings = 0u32;
    for (index, round) in rounds.iter().enumerate() {
        if last_begin_new_match.is_some_and(|tick| round.start_tick <= tick) {
            continue;
        }
        if round.is_knife {
            continue;
        }
        competitive += 1;
        if !is_overtime_opening_round(competitive) {
            continue;
        }
        let window_end = rounds
            .iter()
            .skip(index + 1)
            .map(|next| next.start_tick)
            .find(|start| *start > round.start_tick);
        let sample = last_sample_in_window(samples, round.start_tick, window_end)?;
        let mut humans = 0u32;
        for player in &sample.players {
            if player.is_bot {
                continue;
            }
            humans += 1;
            match seen {
                None => seen = Some(player.amount),
                Some(value) if value != player.amount => return None,
                Some(_) => {}
            }
        }
        if humans == 0 {
            return None;
        }
        openings += 1;
    }
    if openings == 0 {
        None
    } else {
        seen
    }
}

pub(crate) fn build_match_info(
    rounds: &[crate::Round],
    samples: &[BuytimeCashSample],
    last_begin_new_match: Option<u32>,
    demo_overtime_startmoney: Option<i32>,
) -> MatchInfo {
    let cash_rounds: Vec<CashRound> = rounds
        .iter()
        .map(|round| CashRound {
            start_tick: round.start_tick,
            is_knife: round.is_knife,
        })
        .collect();
    MatchInfo::new(
        demo_overtime_startmoney,
        observed_overtime_start_money(&cash_rounds, samples, last_begin_new_match),
    )
}

fn last_sample_in_window(
    samples: &[BuytimeCashSample],
    start: u32,
    end_exclusive: Option<u32>,
) -> Option<&BuytimeCashSample> {
    samples
        .iter()
        .rev()
        .find(|sample| sample.tick >= start && end_exclusive.is_none_or(|end| sample.tick < end))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn live(index: u32) -> CashRound {
        CashRound {
            start_tick: index * 1000,
            is_knife: false,
        }
    }

    fn competitive(count: u32) -> Vec<CashRound> {
        (1..=count).map(live).collect()
    }

    fn humans(amount: i32) -> BuytimeCashSample {
        BuytimeCashSample {
            tick: 0,
            players: vec![
                BuytimePlayerCash {
                    is_bot: false,
                    amount,
                },
                BuytimePlayerCash {
                    is_bot: true,
                    amount: 0,
                },
                BuytimePlayerCash {
                    is_bot: false,
                    amount,
                },
            ],
        }
    }

    fn at(round_index: u32, amount: i32) -> BuytimeCashSample {
        let mut sample = humans(amount);
        sample.tick = round_index * 1000 + 200;
        sample
    }

    #[test]
    fn equal_balances_across_overtime_openers_emit_that_amount() {
        let rounds = competitive(36);
        let samples = vec![at(25, 10_000), at(31, 10_000), at(1, 800)];
        assert_eq!(
            observed_overtime_start_money(&rounds, &samples, None),
            Some(10_000)
        );
    }

    #[test]
    fn mismatched_balances_are_null() {
        let rounds = competitive(36);
        let samples = vec![at(25, 10_000), at(31, 12_500)];
        assert_eq!(observed_overtime_start_money(&rounds, &samples, None), None);
    }

    #[test]
    fn no_overtime_is_null() {
        let rounds = competitive(16);
        let samples = vec![at(1, 800), at(16, 5000)];
        assert_eq!(observed_overtime_start_money(&rounds, &samples, None), None);
        assert_eq!(observed_overtime_start_money(&rounds, &[], None), None);
    }

    #[test]
    fn rounds_at_or_before_the_last_begin_new_match_are_ignored() {
        let rounds = competitive(60);
        let cutoff = 30 * 1000 + 500;
        let samples = vec![at(25, 16_000), at(55, 10_000)];
        assert_eq!(
            observed_overtime_start_money(&rounds, &samples, Some(cutoff)),
            Some(10_000)
        );
        assert_eq!(
            observed_overtime_start_money(&competitive(30), &[at(25, 10_000)], Some(u32::MAX)),
            None
        );
    }

    #[test]
    fn a_knife_round_does_not_shift_the_overtime_index() {
        let mut rounds = vec![CashRound {
            start_tick: 100,
            is_knife: true,
        }];
        rounds.extend(competitive(25));
        let samples = vec![at(25, 10_000)];
        assert_eq!(
            observed_overtime_start_money(&rounds, &samples, None),
            Some(10_000)
        );
    }

    #[test]
    fn match_info_json_omits_a_missing_convar_and_has_no_platform() {
        let info = MatchInfo::new(None, None);
        let json = serde_json::to_value(&info)
            .unwrap_or_else(|err| panic!("could not serialize match info: {err}"));
        assert!(json["observed"].get("platform").is_none());
        assert!(json["observed"]["overtime_start_money"].is_null());
        assert!(json["convars"]["demo"]
            .get("mp_overtime_startmoney")
            .is_none());
        assert_eq!(
            json["convars"]["defaults"]["mp_overtime_startmoney"],
            10_000
        );

        let set = MatchInfo::new(Some(12_500), Some(10_000));
        let set_json = serde_json::to_value(&set)
            .unwrap_or_else(|err| panic!("could not serialize match info: {err}"));
        assert_eq!(
            set_json["convars"]["demo"]["mp_overtime_startmoney"],
            12_500
        );
        assert_eq!(set_json["observed"]["overtime_start_money"], 10_000);
    }
}
