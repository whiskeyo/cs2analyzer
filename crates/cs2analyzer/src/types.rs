use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// High-level match snapshot produced by [`crate::parse_demo`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Match {
    pub header: MatchHeader,
    pub players: Vec<Player>,
    pub rounds: Vec<Round>,
    pub ticks: TickBuffer,
    pub grenades: Vec<GrenadeThrow>,
    pub shots: Vec<Shot>,
    pub kills: Vec<Kill>,
    pub hurts: Vec<Hurt>,
    pub blinds: Vec<Blind>,
    pub bomb_events: Vec<BombEvent>,
    pub buy_events: Vec<BuyEvent>,
    pub stats: Vec<PlayerStats>,
    /// Last controller slot + freeze-end fill candidates (`steam == 0` / bot).
    /// Sampled at `round_freeze_end` only — never on the tick hot path.
    pub controller_dump: Vec<ControllerDump>,
    /// Cumulative action-tracking counters at each counted round's end.
    ///
    /// Omitted from JSON written before this field existed. New parses always
    /// include it (possibly empty).
    #[serde(default)]
    pub round_scoreboard: Vec<RoundScoreboard>,
    /// Convars, end-of-match gamerules, half scores, and demo-file header.
    /// Missing on a match saved before this field existed.
    #[serde(default)]
    pub match_info: MatchInfo,
}

/// One counted round's controller scoreboard (`Match.rounds` numbering).
///
/// Knife rounds and rounds that ended before the last `begin_new_match` are
/// absent. Demos with no `begin_new_match` start at the first counted round.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RoundScoreboard {
    /// Same `Round.number` as the rounds output.
    pub round: u32,
    pub players: Vec<RoundScoreboardPlayer>,
}

/// `m_pActionTrackingServices.m_matchStats` on one controller at round end.
///
/// Values are the server's cumulative totals, not a per-round delta.
/// `steam_id` is raw `m_steamID` (0 for a genuine bot). `slot` is the
/// controller entity index.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RoundScoreboardPlayer {
    pub steam_id: u64,
    pub slot: u32,
    pub name: String,
    pub kills: i32,
    pub deaths: i32,
    pub assists: i32,
    pub damage: i32,
    pub headshot_kills: i32,
    pub utility_damage: i32,
    pub enemies_flashed: i32,
}

/// Per-controller parse diagnostic. Not used by radar/stats.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ControllerDump {
    pub tick: u32,
    pub slot: u32,
    pub name: String,
    /// Raw `m_steamID` (0 when GOTV cleared the human).
    pub steam: u64,
    /// Truthy `m_bIsBot` on controller or pawn.
    pub is_bot: bool,
    /// `m_iConnected`, or `-1` when the prop is missing.
    pub connected: i32,
    pub has_team_pawn: bool,
    /// Identity this tick (`bot_steam_id` / SteamID64), or 0 if dropped.
    pub assigned: u64,
    pub at_freeze: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchHeader {
    pub map_name: String,
    pub tick_rate: f32,
    pub tick_stride: u32,
    pub duration_s: f32,
    pub playback_ticks: u32,
    pub team_ct: String,
    pub team_t: String,
    pub score_ct: i32,
    pub score_t: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub index: u8,
    pub steam_id: u64,
    pub name: String,
    pub start_side: Side,
    /// GOTV / offline bot (`m_bIsBot`, synthetic [`crate::bot_steam_id`]).
    pub is_bot: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Side {
    T,
    Ct,
}

impl Side {
    pub fn as_str(self) -> &'static str {
        match self {
            Side::T => "T",
            Side::Ct => "CT",
        }
    }

    pub fn from_team_num(team: i32) -> Option<Self> {
        match team {
            2 => Some(Side::T),
            3 => Some(Side::Ct),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Round {
    pub number: u32,
    pub start_tick: u32,
    pub freeze_end_tick: u32,
    pub end_tick: u32,
    /// Post-round playback end. Usually the first `cs_pre_restart` after the win.
    /// When that restart would cross a skipped warmup, this is the last kept
    /// frame before the hole. `0` when no restart falls in the kept range
    /// (the web falls back to a short cap).
    #[serde(default)]
    pub playback_end_tick: u32,
    pub winner: Option<Side>,
    pub win_reason: i32,
    pub score_ct: i32,
    pub score_t: i32,
    /// `CCSGameRules.m_iRoundTime` at this round's freeze end, in seconds.
    /// `0` when the prop is missing. The HUD falls back to the competitive clock.
    #[serde(default)]
    pub round_time_s: u32,
    #[serde(default)]
    pub is_knife: bool,
    /// Clan names for whoever is on CT / T at this round's freeze (follows side swaps).
    #[serde(default)]
    pub team_ct: String,
    #[serde(default)]
    pub team_t: String,
}

/// Structure-of-arrays tick snapshots. Length of each coordinate array is
/// `frame_count * player_count`. Index = `frame * player_count + player`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TickBuffer {
    pub frame_count: u32,
    pub player_count: u32,
    pub ticks: Vec<u32>,
    pub x: Vec<f32>,
    pub y: Vec<f32>,
    pub z: Vec<f32>,
    pub yaw: Vec<f32>,
    pub health: Vec<u8>,
    pub armor: Vec<u8>,
    pub flags: Vec<u8>,
    #[serde(default)]
    pub money: Vec<u16>,
    #[serde(default)]
    pub equip: Vec<u16>,
    #[serde(default)]
    pub gear: Vec<u16>,
    #[serde(default)]
    pub primary: Vec<u8>,
    #[serde(default)]
    pub secondary: Vec<u8>,
    #[serde(default)]
    pub active: Vec<u8>,
    #[serde(default)]
    pub clip: Vec<u8>,
    #[serde(default)]
    pub reserve: Vec<u16>,
}

impl TickBuffer {
    pub fn frame_index_at_tick(&self, tick: u32) -> usize {
        match self.ticks.binary_search(&tick) {
            Ok(i) => i,
            Err(i) => i.saturating_sub(1),
        }
    }

    pub fn player_at(&self, frame: usize, player: usize) -> Option<TickPlayer> {
        let pc = self.player_count as usize;
        if frame >= self.frame_count as usize || player >= pc {
            return None;
        }
        let i = frame * pc + player;
        Some(TickPlayer {
            x: *self.x.get(i)?,
            y: *self.y.get(i)?,
            z: *self.z.get(i)?,
            yaw: *self.yaw.get(i)?,
            health: *self.health.get(i)?,
            armor: *self.armor.get(i)?,
            flags: *self.flags.get(i)?,
            money: self.money.get(i).copied().unwrap_or(0),
            equip: self.equip.get(i).copied().unwrap_or(0),
            gear: self.gear.get(i).copied().unwrap_or(0),
            primary: self.primary.get(i).copied().unwrap_or(0),
            secondary: self.secondary.get(i).copied().unwrap_or(0),
            active: self.active.get(i).copied().unwrap_or(0),
            clip: self.clip.get(i).copied().unwrap_or(0),
            reserve: self.reserve.get(i).copied().unwrap_or(0),
        })
    }
}

#[derive(Debug, Clone, Copy)]
pub struct TickPlayer {
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GrenadeKind {
    Smoke,
    Flash,
    He,
    Molotov,
    Incendiary,
    Decoy,
}

impl GrenadeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            GrenadeKind::Smoke => "smoke",
            GrenadeKind::Flash => "flash",
            GrenadeKind::He => "he",
            GrenadeKind::Molotov => "molotov",
            GrenadeKind::Incendiary => "incendiary",
            GrenadeKind::Decoy => "decoy",
        }
    }

    pub fn is_fire(self) -> bool {
        matches!(self, GrenadeKind::Molotov | GrenadeKind::Incendiary)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GrenadeThrow {
    pub thrower: i8,
    pub kind: GrenadeKind,
    pub start_tick: u32,
    pub detonate_tick: u32,
    pub end_tick: u32,
    pub points: Vec<GrenadePoint>,
    /// Burning molotov/incendiary cells sampled from `CInferno`.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fires: Vec<FireCell>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct GrenadePoint {
    pub tick: u32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

/// One inferno flame that was burning between `start_tick` and `end_tick`.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct FireCell {
    pub x: f32,
    pub y: f32,
    pub start_tick: u32,
    pub end_tick: u32,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Shot {
    pub tick: u32,
    pub player: i8,
    pub x: f32,
    pub y: f32,
    pub yaw: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Kill {
    pub tick: u32,
    pub attacker: i8,
    pub victim: i8,
    pub assister: i8,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hurt {
    pub tick: u32,
    pub attacker: i8,
    pub victim: i8,
    pub damage: i32,
    pub damage_armor: i32,
    pub hitgroup: u8,
    /// Remaining HP after this hit.
    pub health: i32,
    /// Remaining armor after this hit.
    pub armor: i32,
    pub weapon: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Blind {
    pub tick: u32,
    pub attacker: i8,
    pub victim: i8,
    pub duration: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BombKind {
    Planted,
    Defused,
    Exploded,
    BeginDefuse,
    AbortDefuse,
    Pickup,
    Dropped,
    BeginPlant,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BombEvent {
    pub tick: u32,
    pub kind: BombKind,
    pub player: i8,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    #[serde(default)]
    pub haskit: bool,
    /// Bombsite index from `bomb_planted` (`0` = A, `1` = B).
    #[serde(default)]
    pub site: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuyEvent {
    pub tick: u32,
    pub player: i8,
    pub weapon: u8,
    pub cost: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerStats {
    pub player: u8,
    pub kills: u32,
    pub deaths: u32,
    pub assists: u32,
    pub headshots: u32,
    pub damage: i32,
    pub utility_damage: i32,
    pub enemies_flashed: u32,
    pub first_kills: u32,
    pub first_deaths: u32,
    pub kast_rounds: u32,
    pub rounds: u32,
    pub adr: f32,
    pub headshot_percent: f32,
    pub kast: f32,
    pub kd: f32,
    pub multi_kills_2: u32,
    pub multi_kills_3: u32,
    pub multi_kills_4: u32,
    pub aces: u32,
    pub flash_assists: u32,
    pub plants: u32,
    pub defuses: u32,
    pub trade_kills: u32,
    #[serde(default)]
    pub entry_attempts: u32,
    #[serde(default)]
    pub entry_success: f32,
    #[serde(default)]
    pub rounds_ct: u32,
    #[serde(default)]
    pub rounds_t: u32,
    #[serde(default)]
    pub kills_ct: u32,
    #[serde(default)]
    pub kills_t: u32,
    #[serde(default)]
    pub deaths_ct: u32,
    #[serde(default)]
    pub deaths_t: u32,
    #[serde(default)]
    pub damage_ct: i32,
    #[serde(default)]
    pub damage_t: i32,
    #[serde(default)]
    pub adr_ct: f32,
    #[serde(default)]
    pub adr_t: f32,
}

impl PlayerStats {
    pub fn empty(player: u8) -> Self {
        Self {
            player,
            kills: 0,
            deaths: 0,
            assists: 0,
            headshots: 0,
            damage: 0,
            utility_damage: 0,
            enemies_flashed: 0,
            first_kills: 0,
            first_deaths: 0,
            kast_rounds: 0,
            rounds: 0,
            adr: 0.0,
            headshot_percent: 0.0,
            kast: 0.0,
            kd: 0.0,
            multi_kills_2: 0,
            multi_kills_3: 0,
            multi_kills_4: 0,
            aces: 0,
            flash_assists: 0,
            plants: 0,
            defuses: 0,
            trade_kills: 0,
            entry_attempts: 0,
            entry_success: 0.0,
            rounds_ct: 0,
            rounds_t: 0,
            kills_ct: 0,
            kills_t: 0,
            deaths_ct: 0,
            deaths_t: 0,
            damage_ct: 0,
            damage_t: 0,
            adr_ct: 0.0,
            adr_t: 0.0,
        }
    }
}

/// One `CNETMsg_SetConVar` change. Repeats of the same value are not stored.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConvarUpdate {
    pub tick: u32,
    pub name: String,
    pub value: String,
}

/// `CCSTeam` half split at the end of the demo.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct TeamHalfScores {
    /// `m_szClanTeamname` with a leading `team_` stripped, same as round names.
    pub name: String,
    #[serde(rename = "m_iScore")]
    pub score: i32,
    #[serde(rename = "m_scoreFirstHalf")]
    pub score_first_half: i32,
    #[serde(rename = "m_scoreSecondHalf")]
    pub score_second_half: i32,
    #[serde(rename = "m_scoreOvertime")]
    pub score_overtime: i32,
}

/// CT is team number 3, T is team number 2, at the sample tick.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct TeamHalves {
    pub ct: TeamHalfScores,
    pub t: TeamHalfScores,
}

/// `CCSGameRulesProxy.m_pGameRules` at the end of the demo.
///
/// Integer and bool props that the demo never networks stay `0` / `false`.
/// `m_nOvertimePlaying` is the overtime period index (0 in regulation, 3 means the third OT).
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct GameRulesSnapshot {
    #[serde(rename = "m_nOvertimePlaying")]
    pub overtime_playing: i32,
    #[serde(rename = "m_totalRoundsPlayed")]
    pub total_rounds_played: i32,
    #[serde(rename = "m_iRoundStartRoundNumber")]
    pub round_start_round_number: i32,
    #[serde(rename = "m_nRoundsPlayedThisPhase")]
    pub rounds_played_this_phase: i32,
    #[serde(rename = "m_gamePhase")]
    pub game_phase: i32,
    #[serde(rename = "m_iFreezeTime")]
    pub freeze_time: i32,
    #[serde(rename = "m_iRoundTime")]
    pub round_time: i32,
    #[serde(rename = "m_bFreezePeriod")]
    pub freeze_period: bool,
    #[serde(rename = "m_bHasMatchStarted")]
    pub has_match_started: bool,
    #[serde(rename = "m_bGamePaused")]
    pub game_paused: bool,
    #[serde(rename = "m_bMatchWaitingForResume")]
    pub match_waiting_for_resume: bool,
    #[serde(rename = "m_bTechnicalTimeOut")]
    pub technical_timeout: bool,
    #[serde(rename = "m_bCTTimeOutActive")]
    pub ct_timeout_active: bool,
    #[serde(rename = "m_bTerroristTimeOutActive")]
    pub terrorist_timeout_active: bool,
    #[serde(rename = "m_flCTTimeOutRemaining")]
    pub ct_timeout_remaining: f32,
    #[serde(rename = "m_flTerroristTimeOutRemaining")]
    pub terrorist_timeout_remaining: f32,
    #[serde(rename = "m_nCTTimeOuts")]
    pub ct_timeouts: i32,
    #[serde(rename = "m_nTerroristTimeOuts")]
    pub terrorist_timeouts: i32,
    #[serde(rename = "m_nPauseStartTick")]
    pub pause_start_tick: i32,
    #[serde(rename = "m_nTotalPausedTicks")]
    pub total_paused_ticks: i32,
    #[serde(rename = "m_iNumConsecutiveCTLoses")]
    pub consecutive_ct_losses: i32,
    #[serde(rename = "m_iNumConsecutiveTerroristLoses")]
    pub consecutive_terrorist_losses: i32,
    #[serde(rename = "m_bBombPlanted")]
    pub bomb_planted: bool,
    #[serde(rename = "m_bBombDropped")]
    pub bomb_dropped: bool,
    #[serde(rename = "m_eRoundEndReason")]
    pub round_end_reason: i32,
    #[serde(rename = "m_iRoundEndWinnerTeam")]
    pub round_end_winner_team: i32,
    #[serde(rename = "m_sRoundEndMessage")]
    pub round_end_message: String,
    #[serde(rename = "m_sRoundEndFunFactToken")]
    pub round_end_fun_fact_token: String,
    #[serde(rename = "m_iRoundEndFunFactPlayerSlot")]
    pub round_end_fun_fact_player_slot: i32,
    #[serde(rename = "m_iRoundEndFunFactData1")]
    pub round_end_fun_fact_data1: i32,
    #[serde(rename = "m_iRoundEndFunFactData2")]
    pub round_end_fun_fact_data2: i32,
    #[serde(rename = "m_iRoundEndFunFactData3")]
    pub round_end_fun_fact_data3: i32,
    #[serde(rename = "m_iRoundEndPlayerCount")]
    pub round_end_player_count: i32,
    #[serde(rename = "m_fMatchStartTime")]
    pub match_start_time: f32,
    #[serde(rename = "m_fRoundStartTime")]
    pub round_start_time: f32,
    #[serde(rename = "m_flGameStartTime")]
    pub game_start_time: f32,
    #[serde(rename = "m_bIsValveDS")]
    pub is_valve_ds: bool,
    #[serde(rename = "m_bIsQueuedMatchmaking")]
    pub is_queued_matchmaking: bool,
    #[serde(rename = "m_nQueuedMatchmakingMode")]
    pub queued_matchmaking_mode: i32,
    #[serde(rename = "m_numBestOfMaps")]
    pub best_of_maps: i32,
    #[serde(rename = "m_szMatchStatTxt")]
    pub match_stat_text: String,
    #[serde(rename = "m_szTournamentEventName")]
    pub tournament_event_name: String,
    #[serde(rename = "m_szTournamentEventStage")]
    pub tournament_event_stage: String,
    #[serde(rename = "m_vMinimapMins")]
    pub minimap_mins: [f32; 3],
    #[serde(rename = "m_vMinimapMaxs")]
    pub minimap_maxs: [f32; 3],
    #[serde(rename = "m_bMapHasBombTarget")]
    pub map_has_bomb_target: bool,
    #[serde(rename = "m_bMapHasBuyZone")]
    pub map_has_buy_zone: bool,
}

/// Tournament defaults plus every convar the server sent.
///
/// `defaults` is always the tournament-config table. `demo` is the last value
/// of every name the server sent, including values that equal the default.
/// The frontend resolves `demo[name] ?? defaults[name]`. Rust does not infer
/// a number when the demo omitted the name.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ConvarTables {
    pub defaults: BTreeMap<String, String>,
    pub demo: BTreeMap<String, String>,
}

/// Cash read off players. `overtime_start_money` is null when the match has
/// no overtime, any overtime opening is missing its freeze-end sample, or the
/// real players do not share one amount. One missing sample nulls the whole
/// value: null is better than a number from incomplete data. No platform field.
///
/// Resolve overtime start money as `convars.demo.mp_overtime_startmoney`, then
/// this value, then `convars.defaults.mp_overtime_startmoney`.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct ObservedMatch {
    pub overtime_start_money: Option<i32>,
}

/// Extra demo data that does not change header, rounds, or player JSON.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct MatchInfo {
    pub convars: ConvarTables,
    pub convar_updates: Vec<ConvarUpdate>,
    pub rules: GameRulesSnapshot,
    pub teams: TeamHalves,
    pub server_name: String,
    pub build_num: i32,
    pub patch_version: i32,
    /// Always present on a fresh parse. Older payloads may omit it.
    #[serde(default)]
    pub observed: ObservedMatch,
}
