//! Overtime start money reconstructed at the end of buy time.
//!
//! For the first round of each overtime after the last `begin_new_match`,
//! every real player's `m_iAccount + m_iCashSpentThisRound` at
//! `round_freeze_end` must be the same number. That number is
//! `observed.overtime_start_money`. Anything else is null, including a match
//! that never reaches overtime.
//!
//! Overtime `k` (0-based) opens on competitive round
//! `mp_maxrounds + k * mp_overtime_maxrounds + 1`. The demo string is used
//! when the server sent that convar; otherwise the value comes from
//! [`crate::constants::CONVAR_DEFAULTS`] (`mp_maxrounds` 24, `mp_overtime_maxrounds` 6).

use std::collections::BTreeMap;

use crate::constants::convar_default_u32;

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

/// Regulation length and one overtime's length, in rounds.
///
/// Resolved as `convars.demo[name]`, then the same defaults table as
/// `match_info.convars.defaults`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct OvertimeRules {
    pub max_rounds: u32,
    pub overtime_max_rounds: u32,
}

impl OvertimeRules {
    /// Tournament defaults. Used when the demo omits the convar.
    pub(crate) fn defaults() -> Self {
        Self {
            max_rounds: convar_default_u32("mp_maxrounds"),
            overtime_max_rounds: convar_default_u32("mp_overtime_maxrounds"),
        }
    }

    /// Demo value when that name was sent and is a whole number; otherwise
    /// the defaults table. An unreadable string is treated as absent.
    pub(crate) fn from_demo(demo: &BTreeMap<String, String>) -> Self {
        let defaults = Self::defaults();
        Self {
            max_rounds: demo_or_default(demo, "mp_maxrounds", defaults.max_rounds),
            overtime_max_rounds: demo_or_default(
                demo,
                "mp_overtime_maxrounds",
                defaults.overtime_max_rounds,
            ),
        }
    }
}

fn demo_or_default(demo: &BTreeMap<String, String>, name: &str, fallback: u32) -> u32 {
    demo.get(name)
        .and_then(|value| parse_u32_digits(value))
        .unwrap_or(fallback)
}

fn parse_u32_digits(raw: &str) -> Option<u32> {
    if raw.is_empty() {
        return None;
    }
    let mut value: u32 = 0;
    for byte in raw.bytes() {
        if !byte.is_ascii_digit() {
            return None;
        }
        value = value.checked_mul(10)?.checked_add(u32::from(byte - b'0'))?;
    }
    Some(value)
}

/// Overtime `k` opens at `max_rounds + k * overtime_max_rounds + 1` (1-based).
///
/// `is_multiple_of(0)` is false for a positive distance, so a period of 0
/// marks only the first overtime round.
pub(crate) fn is_overtime_opening_round(number: u32, rules: OvertimeRules) -> bool {
    let Some(first) = rules.max_rounds.checked_add(1) else {
        return false;
    };
    if number < first {
        return false;
    }
    (number - first).is_multiple_of(rules.overtime_max_rounds)
}

/// `None` is JSON null: no overtime, a missing buy-time sample, or amounts
/// that are not all equal. Bots are ignored.
pub(crate) fn observed_overtime_start_money(
    rounds: &[CashRound],
    samples: &[BuytimeCashSample],
    last_begin_new_match: Option<u32>,
    rules: OvertimeRules,
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
        if !is_overtime_opening_round(competitive, rules) {
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

pub(crate) fn observed_from_rounds(
    rounds: &[crate::Round],
    samples: &[BuytimeCashSample],
    last_begin_new_match: Option<u32>,
    demo_convars: &BTreeMap<String, String>,
) -> Option<i32> {
    let cash_rounds: Vec<CashRound> = rounds
        .iter()
        .map(|round| CashRound {
            start_tick: round.start_tick,
            is_knife: round.is_knife,
        })
        .collect();
    observed_overtime_start_money(
        &cash_rounds,
        samples,
        last_begin_new_match,
        OvertimeRules::from_demo(demo_convars),
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
    use crate::constants::convar_default_u32;

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
            observed_overtime_start_money(&rounds, &samples, None, mr12()),
            Some(10_000)
        );
    }

    #[test]
    fn mismatched_balances_are_null() {
        let rounds = competitive(36);
        let samples = vec![at(25, 10_000), at(31, 12_500)];
        assert_eq!(
            observed_overtime_start_money(&rounds, &samples, None, mr12()),
            None
        );
    }

    #[test]
    fn no_overtime_is_null() {
        let rounds = competitive(16);
        let samples = vec![at(1, 800), at(16, 5000)];
        assert_eq!(
            observed_overtime_start_money(&rounds, &samples, None, mr12()),
            None
        );
        assert_eq!(
            observed_overtime_start_money(&rounds, &[], None, mr12()),
            None
        );
        // Regulation is 30 rounds, so round 25 is not an overtime opener.
        let long = OvertimeRules {
            max_rounds: 30,
            overtime_max_rounds: 6,
        };
        assert_eq!(
            observed_overtime_start_money(
                &competitive(30),
                &[at(25, 10_000), at(30, 10_000)],
                None,
                long
            ),
            None
        );
    }

    #[test]
    fn rounds_at_or_before_the_last_begin_new_match_are_ignored() {
        let rounds = competitive(60);
        let cutoff = 30 * 1000 + 500;
        let samples = vec![at(25, 16_000), at(55, 10_000)];
        assert_eq!(
            observed_overtime_start_money(&rounds, &samples, Some(cutoff), mr12()),
            Some(10_000)
        );
        assert_eq!(
            observed_overtime_start_money(
                &competitive(30),
                &[at(25, 10_000)],
                Some(u32::MAX),
                mr12()
            ),
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
            observed_overtime_start_money(&rounds, &samples, None, mr12()),
            Some(10_000)
        );
    }

    fn mr12() -> OvertimeRules {
        OvertimeRules::defaults()
    }

    #[test]
    fn absent_convars_use_the_defaults_table() {
        let rules = OvertimeRules::from_demo(&BTreeMap::new());
        assert_eq!(rules.max_rounds, convar_default_u32("mp_maxrounds"));
        assert_eq!(
            rules.overtime_max_rounds,
            convar_default_u32("mp_overtime_maxrounds")
        );
        assert!(is_overtime_opening_round(rules.max_rounds + 1, rules));
        assert!(is_overtime_opening_round(
            rules.max_rounds + 1 + rules.overtime_max_rounds,
            rules
        ));
        assert!(!is_overtime_opening_round(rules.max_rounds, rules));
        let unreadable = BTreeMap::from([("mp_maxrounds".to_string(), "24.0".to_string())]);
        assert_eq!(
            OvertimeRules::from_demo(&unreadable).max_rounds,
            convar_default_u32("mp_maxrounds")
        );
    }

    #[test]
    fn demo_convars_pick_the_overtime_opening_rounds() {
        let thirty_by_six = OvertimeRules::from_demo(&BTreeMap::from([
            ("mp_maxrounds".to_string(), "30".to_string()),
            ("mp_overtime_maxrounds".to_string(), "6".to_string()),
        ]));
        // 36 competitive rounds: the only opener is 31 (37 has not been played).
        let first_only = competitive(36);
        assert_eq!(
            observed_overtime_start_money(&first_only, &[at(31, 10_000)], None, thirty_by_six),
            Some(10_000)
        );
        assert_eq!(
            observed_overtime_start_money(&first_only, &[at(25, 10_000)], None, thirty_by_six),
            None
        );
        let two_periods = competitive(42);
        assert_eq!(
            observed_overtime_start_money(
                &two_periods,
                &[at(31, 10_000), at(37, 10_000)],
                None,
                thirty_by_six
            ),
            Some(10_000)
        );

        // Only the period is in the demo; regulation length stays the default.
        let period_ten = OvertimeRules::from_demo(&BTreeMap::from([(
            "mp_overtime_maxrounds".to_string(),
            "10".to_string(),
        )]));
        assert_eq!(period_ten.max_rounds, convar_default_u32("mp_maxrounds"));
        assert_eq!(period_ten.overtime_max_rounds, 10);
        assert_eq!(
            observed_overtime_start_money(
                &two_periods,
                &[at(25, 8_000), at(35, 8_000)],
                None,
                period_ten
            ),
            Some(8_000)
        );
        assert_eq!(
            observed_overtime_start_money(&two_periods, &[at(31, 8_000)], None, period_ten),
            None
        );

        let thirty_by_ten = OvertimeRules::from_demo(&BTreeMap::from([
            ("mp_maxrounds".to_string(), "30".to_string()),
            ("mp_overtime_maxrounds".to_string(), "10".to_string()),
        ]));
        let through_second = competitive(48);
        assert_eq!(
            observed_overtime_start_money(
                &through_second,
                &[at(31, 9_000), at(41, 9_000)],
                None,
                thirty_by_ten
            ),
            Some(9_000)
        );
        assert_eq!(
            observed_overtime_start_money(&through_second, &[at(35, 9_000)], None, thirty_by_ten),
            None
        );
    }

    #[test]
    fn observed_json_has_null_money_and_no_platform() {
        let observed = crate::ObservedMatch::default();
        let json = serde_json::to_value(&observed)
            .unwrap_or_else(|err| panic!("could not serialize observed: {err}"));
        assert!(json.get("platform").is_none());
        assert!(json["overtime_start_money"].is_null());
        let set = crate::ObservedMatch {
            overtime_start_money: Some(10_000),
        };
        let set_json = serde_json::to_value(&set)
            .unwrap_or_else(|err| panic!("could not serialize observed: {err}"));
        assert_eq!(set_json["overtime_start_money"], 10_000);
    }
}
