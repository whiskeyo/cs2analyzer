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
    pub stats: Vec<PlayerStats>,
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
    pub winner: Option<Side>,
    pub win_reason: i32,
    pub score_ct: i32,
    pub score_t: i32,
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
            x: self.x[i],
            y: self.y[i],
            z: self.z[i],
            yaw: self.yaw[i],
            health: self.health[i],
            armor: self.armor[i],
            flags: self.flags[i],
            money: self.money.get(i).copied().unwrap_or(0),
            equip: self.equip.get(i).copied().unwrap_or(0),
            gear: self.gear.get(i).copied().unwrap_or(0),
            primary: self.primary.get(i).copied().unwrap_or(0),
            secondary: self.secondary.get(i).copied().unwrap_or(0),
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
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum GrenadeKind {
    Smoke,
    Flash,
    He,
    Molotov,
    Decoy,
}

impl GrenadeKind {
    pub fn as_str(self) -> &'static str {
        match self {
            GrenadeKind::Smoke => "smoke",
            GrenadeKind::Flash => "flash",
            GrenadeKind::He => "he",
            GrenadeKind::Molotov => "molotov",
            GrenadeKind::Decoy => "decoy",
        }
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
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct GrenadePoint {
    pub tick: u32,
    pub x: f32,
    pub y: f32,
    pub z: f32,
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
    pub x: f32,
    pub y: f32,
    pub z: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hurt {
    pub tick: u32,
    pub attacker: i8,
    pub victim: i8,
    pub damage: i32,
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
#[serde(rename_all = "lowercase")]
pub enum BombKind {
    Planted,
    Defused,
    Exploded,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BombEvent {
    pub tick: u32,
    pub kind: BombKind,
    pub player: i8,
    pub x: f32,
    pub y: f32,
    pub z: f32,
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
    pub hs_percent: f32,
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
            hs_percent: 0.0,
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
        }
    }
}
