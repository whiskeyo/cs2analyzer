# Protobuf fields behind `match_info`

WASM exposes this object as `matchInfoJson`. The viewer resolves overtime
start money in this order:

1. `convars.demo.mp_overtime_startmoney` — the demo convar, when the server sent it
2. `observed.overtime_start_money` — reconstructed from player cash
3. `convars.defaults.mp_overtime_startmoney` — the built-in value (10000)

`observed` may be omitted on an older payload. A fresh parse always sends it.
`overtime_start_money` is `null` when the match has no overtime, a buy-time
sample is missing, or the real players do not all hold the same amount.
There is no `observed.platform` field.

## Demo convar

`CNetMsgSetConVar` carries `CMsgCVars`. Each `CVar` is a name and a string
value. The parser keeps the last `mp_overtime_startmoney` in that list.
When the demo never sets it, `convars.demo` omits the key.

## Observed overtime money

On the first round of each overtime after the last `begin_new_match`, at
`round_freeze_end`, every real player's cash is:

- `CCSPlayerController_InGameMoneyServices.m_iAccount`
- plus `CCSPlayerController_InGameMoneyServices.m_iCashSpentThisRound`

The flattened names are `m_pInGameMoneyServices.m_iAccount` and
`m_pInGameMoneyServices.m_iCashSpentThisRound`. The sample is taken at tick
end so those props already include the buy. `buytime_ended` is not used:
`mp_buytime` keeps running after the freeze, and a kill in that window
changes `m_iAccount` without a matching spend.

Do not read `m_iStartAccount`. It does not reset when overtime begins, so it
still shows the regulation pistol balance.

Bots are dropped with the same identity rules as the roster (`m_bIsBot` /
synthetic steam id from `controller_identity`). Rounds at or before the last
`begin_new_match` belong to the previous match and are ignored. Competitive
numbers are then counted again from 1, and overtime openers are rounds 25,
31, 37, … (MR12, then every 6 rounds). If every real player on every such
round has the same sum, that sum is `observed.overtime_start_money`.
