# Protobuf fields the parser reads

source2-demo 0.5.10 decodes the demo. The names below are the protobuf / networked field names. The Rust column is where that value lands. `MatchInfo` is a new optional object. Header, player, round, and event JSON are unchanged.

WASM exposes it as `matchInfoJson()`. The viewer stores it on `Replay.match_info`, which is optional so a cached replay from before this field still loads. A fresh parse always fills it. `MatchInfo::default` (and `#[serde(default)]` on `Match`) is the tournament defaults table, an empty `convars.demo` map, empty rules, empty teams, and zero build numbers.

## Demo file header — `CDemoFileHeader`

Message: `EDemoCommands::DemFileHeader`. Handler: `Collector::on_file_header`.

| Protobuf field | Meaning | Rust |
| --- | --- | --- |
| `server_name` | GOTV server label (FACEIT, Valve, BLAST, ESL, …) | `MatchInfo.server_name` |
| `build_num` | Game build | `MatchInfo.build_num` |
| `patch_version` | Network protocol / patch | `MatchInfo.patch_version` |

Map name and tick interval still come from `CSVCMsg_ServerInfo` (`map_name`, `tick_interval`) and stay on `Header`. They are not copied into `MatchInfo`.

## Convars — `CNETMsg_SetConVar`

Prost type: `CNetMsgSetConVar`, interest `NetMessages::NetSetConVar`. Handler: `Collector::on_set_convar`.

Each update is `msg.convars.cvars[]` with string `name` and string `value`. A repeat of the same value is dropped. Signon tick `u32::MAX` is stored as tick 0. The timeline is `MatchInfo.convar_updates` (`tick`, `name`, `value`), in arrival order.

`MatchInfo.convars` has two string maps (`BTreeMap`, so the JSON keys are sorted):

- `defaults` — always the tournament-config table in `CONVAR_DEFAULTS` (`crates/cs2analyzer/src/constants.rs`). It does not depend on the demo and it does not change with game mode.
- `demo` — every convar the server sent, last value, including a value that equals the default. Names the demo never sent are absent. Rust does not fill them in.

The frontend resolves `convars.demo[name] ?? convars.defaults[name]`. There is no `{value, source}` object and no top-level `mp_maxrounds` / `mp_overtime_maxrounds` / `mp_overtime_startmoney` integer.

`defaults` is exactly these strings:

| Name | Value | Source |
| --- | --- | --- |
| `mp_buytime` | `"20"` | Swiss LAN CS2 ruleset, Match Settings (https://rules.switzerlan.ch/rules/cs2/). |
| `mp_c4timer` | `"40"` | Same ruleset. |
| `mp_maxmoney` | `"16000"` | Competitive money cap next to the ruleset's $800 start money. The BLAST Nuke demo omits the convar, so the frontend uses this default. |
| `mp_maxrounds` | `"24"` | Same ruleset. Every release demo also sends `"24"` in `convars.demo`. |
| `mp_overtime_maxrounds` | `"6"` | Same ruleset. Absent from `convars.demo` on every release demo. |
| `mp_overtime_startmoney` | `"12500"` | Same ruleset. `OVERTIME_START_MONEY` in `constants.rs` is parsed from this string, so the old hardcoded `10000` is not a second copy. Tournament demos (BLAST, ESL, FantasyExpo) send `"12500"` in `convars.demo`. FACEIT and Premier in this set omit it, except the FACEIT Inferno demo, which sends `"12500"`. |
| `mp_roundtime` | `"1.92"` | Same ruleset (1 minute 55 seconds). |
| `mp_roundtime_defuse` | `"1.92"` | Bomb-map round length, matching `mp_roundtime`. The BLAST Nuke demo sends this string in `convars.demo`. |
| `mp_startmoney` | `"800"` | Same ruleset. |

`mp_freezetime` is not in `defaults`. Organizers set 15 or 20, so only a demo value is kept. `mp_overtime_enable` is not in `defaults` either. Every release demo sends `"true"` in `convars.demo`.

## Gamerules — `CCSGameRulesProxy.m_pGameRules`

Read by `read_game_rules`. Sampled at each non-warmup `round_freeze_end`, on `cs_win_panel_match`, and in `on_stop`, so the end snapshot wins. An empty team read does not clear a previous sample; gamerules replace the last snapshot only when the proxy entity is present.

JSON names are the protobuf names (`m_nOvertimePlaying`, not `overtime_playing`).

| Protobuf field | Meaning | `GameRulesSnapshot` |
| --- | --- | --- |
| `m_nOvertimePlaying` | Overtime period index (0 in regulation) | `overtime_playing` |
| `m_totalRoundsPlayed` | Played rounds, knife excluded | `total_rounds_played` |
| `m_iRoundStartRoundNumber` | Round number at the current start | `round_start_round_number` |
| `m_nRoundsPlayedThisPhase` | Rounds played in the current phase | `rounds_played_this_phase` |
| `m_gamePhase` | Phase enum (5 at the end of every release demo) | `game_phase` |
| `m_iFreezeTime` | Freeze length in seconds | `freeze_time` |
| `m_iRoundTime` | Round length in seconds | `round_time` |
| `m_bFreezePeriod` | Currently in freeze | `freeze_period` |
| `m_bHasMatchStarted` | Match-started flag | `has_match_started` |
| `m_bGamePaused` | Game paused | `game_paused` |
| `m_bMatchWaitingForResume` | Waiting for resume | `match_waiting_for_resume` |
| `m_bTechnicalTimeOut` | Technical timeout | `technical_timeout` |
| `m_bCTTimeOutActive` | CT timeout active | `ct_timeout_active` |
| `m_bTerroristTimeOutActive` | T timeout active | `terrorist_timeout_active` |
| `m_flCTTimeOutRemaining` | CT timeout seconds left | `ct_timeout_remaining` |
| `m_flTerroristTimeOutRemaining` | T timeout seconds left | `terrorist_timeout_remaining` |
| `m_nCTTimeOuts` | CT timeouts taken | `ct_timeouts` |
| `m_nTerroristTimeOuts` | T timeouts taken | `terrorist_timeouts` |
| `m_nPauseStartTick` | Pause start tick | `pause_start_tick` |
| `m_nTotalPausedTicks` | Total paused ticks | `total_paused_ticks` |
| `m_iNumConsecutiveCTLoses` | Consecutive CT losses | `consecutive_ct_losses` |
| `m_iNumConsecutiveTerroristLoses` | Consecutive T losses | `consecutive_terrorist_losses` |
| `m_bBombPlanted` | Bomb is planted | `bomb_planted` |
| `m_bBombDropped` | Bomb is dropped | `bomb_dropped` |
| `m_eRoundEndReason` | Last round-end reason | `round_end_reason` |
| `m_iRoundEndWinnerTeam` | Last winner team number | `round_end_winner_team` |
| `m_sRoundEndMessage` | End notice token (`#SFUI_Notice_…`) | `round_end_message` |
| `m_sRoundEndFunFactToken` | Fun-fact token | `round_end_fun_fact_token` |
| `m_iRoundEndFunFactPlayerSlot` | Fun-fact player slot | `round_end_fun_fact_player_slot` |
| `m_iRoundEndFunFactData1` | Fun-fact data | `round_end_fun_fact_data1` |
| `m_iRoundEndFunFactData2` | Fun-fact data | `round_end_fun_fact_data2` |
| `m_iRoundEndFunFactData3` | Fun-fact data | `round_end_fun_fact_data3` |
| `m_iRoundEndPlayerCount` | Players in the fun fact | `round_end_player_count` |
| `m_fMatchStartTime` | Match start time | `match_start_time` |
| `m_fRoundStartTime` | Round start time | `round_start_time` |
| `m_flGameStartTime` | Game start time | `game_start_time` |
| `m_bIsValveDS` | Valve dedicated server | `is_valve_ds` |
| `m_bIsQueuedMatchmaking` | Premier / queued MM | `is_queued_matchmaking` |
| `m_nQueuedMatchmakingMode` | Queued mode | `queued_matchmaking_mode` |
| `m_numBestOfMaps` | Series length | `best_of_maps` |
| `m_szMatchStatTxt` | Series label (`Match 1 of 3`) | `match_stat_text` |
| `m_szTournamentEventName` | Event name | `tournament_event_name` |
| `m_szTournamentEventStage` | Stage name | `tournament_event_stage` |
| `m_vMinimapMins` | Radar min (xyz; Vector4D xyz is accepted) | `minimap_mins` |
| `m_vMinimapMaxs` | Radar max | `minimap_maxs` |
| `m_bMapHasBombTarget` | Bomb map | `map_has_bomb_target` |
| `m_bMapHasBuyZone` | Buy zones exist | `map_has_buy_zone` |

Not read, on purpose: `m_iBombSite`, `m_hBombPlanter`, and `m_nMatchSeed` live under `m_RetakeRules`, not on `CCSGameRules`.

`m_nOvertimePlaying` is the integer callers should use. On the Mirage FACEIT demo it is 3 at the end (third overtime). Regulation demos stay 0.

## Team halves — `CCSTeam`

Read by `read_team_halves` on the same ticks as gamerules. A read with no CT and no T row does not replace the last sample.

| Protobuf field | Meaning | Rust |
| --- | --- | --- |
| `m_iTeamNum` | 3 = CT, 2 = T, at the sample tick (follows side swaps) | chooses `teams.ct` or `teams.t` |
| `m_szClanTeamname` | Clan name; a leading `team_` is stripped, same as round names | `TeamHalfScores.name` |
| `m_iScore` | Rounds won by that side | `score` → JSON `m_iScore` |
| `m_scoreFirstHalf` | First-half rounds | `score_first_half` |
| `m_scoreSecondHalf` | Second-half rounds | `score_second_half` |
| `m_scoreOvertime` | Overtime rounds | `score_overtime` |

These are the side at the end of the demo, not the starting-side header score. Premier has empty clan names. The Mirage CT row is 20 = 7 + 5 + 8. Nuke's MOUZ row (CT at the end) is 13 = 7 + 6 + 0.

## Events that are often missing

The branches stay. None of the 12 release demos need a behavior change.

| Event | What the 12 demos do | What still records the fact |
| --- | --- | --- |
| `round_start` | Never fires | `m_nRoundStartCount` edges cap smokes and molotovs. `Round.start_tick` stays the freeze tick. |
| `bullet_impact` | Never fires | `weapon_fire` tracers. Impacts are not stored. |
| `molotov_detonate` | Never fires | `inferno_startburn` starts the fire. `inferno_expire` ends it. |
| `inferno_extinguish` | Never fires | A smoke ends the fire with an earlier `inferno_expire`. |
| `round_officially_ended` | Missing on tournament GOTV and on the FACEIT Inferno demo | Round end prefers `m_iRoundWinStatus` (`synth_ends` in `round_conclusion`). |
| `bomb_beginplant` / `bomb_begindefuse` | Missing on those same demos | Pawn `m_bStartedArming` / `m_bIsDefusing` (`FLAG_PLANTING` / `FLAG_DEFUSING`). The HUD timer starts from the flag when the event is absent. |
| `player_blind` | Missing on those same demos | Pawn `m_flFlashDuration` in `sample_flash_blinds`. FACEIT (except that Inferno) and Premier do fire `player_blind`. |

`bomb_planted`, `inferno_startburn`, and `inferno_expire` are present on the tournament demos. Every release demo still has a winner on every round, at least one blind, and at least one fire.

## Output shape

`match_info` is its own WASM section (`matchInfoJson`), after `controllerDumpJson`. It is not folded into `headerJson`, `roundsJson`, or `playersJson`. The real-demo hash files gained a `match_info` section for that payload. Other section hashes are the previous parser output.

```json
{
  "convars": {
    "defaults": {
      "mp_buytime": "20",
      "mp_c4timer": "40",
      "mp_maxmoney": "16000",
      "mp_maxrounds": "24",
      "mp_overtime_maxrounds": "6",
      "mp_overtime_startmoney": "12500",
      "mp_roundtime": "1.92",
      "mp_roundtime_defuse": "1.92",
      "mp_startmoney": "800"
    },
    "demo": {
      "mp_maxrounds": "24"
    }
  },
  "convar_updates": [{ "tick": 0, "name": "mp_maxrounds", "value": "24" }],
  "rules": { "m_nOvertimePlaying": 0 },
  "teams": {
    "ct": {
      "name": "",
      "m_iScore": 0,
      "m_scoreFirstHalf": 0,
      "m_scoreSecondHalf": 0,
      "m_scoreOvertime": 0
    },
    "t": {
      "name": "",
      "m_iScore": 0,
      "m_scoreFirstHalf": 0,
      "m_scoreSecondHalf": 0,
      "m_scoreOvertime": 0
    }
  },
  "server_name": "",
  "build_num": 0,
  "patch_version": 0
}
```

`rules` in a real parse lists every field in the gamerules table. The CLI section is `match-info`.
