use clap::{Parser, Subcommand};
use cs2analyzer::{parse_demo, ParseOptions, Side};
use std::path::PathBuf;
use std::time::Instant;

#[derive(Parser)]
#[command(
    name = "cs2analyzer",
    about = "Parse CS2 demo files into replay snapshots and stats."
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Parse a .dem file and print a summary (optionally dump JSON).
    Parse {
        /// Path to a CS2 .dem file.
        demo: PathBuf,
        /// Write the full Match snapshot as JSON.
        #[arg(long)]
        json: Option<PathBuf>,
        /// Keep every Nth tick (default 4 ≈ 16 Hz at 64-tick).
        #[arg(long, default_value_t = 4)]
        tick_stride: u32,
        /// Include warmup.
        #[arg(long)]
        warmup: bool,
    },
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Parse {
            demo,
            json,
            tick_stride,
            warmup,
        } => {
            let bytes = std::fs::read(&demo)?;
            eprintln!("read {} bytes from {}", bytes.len(), demo.display());
            let started = Instant::now();
            let parsed = parse_demo(
                &bytes,
                ParseOptions {
                    tick_stride,
                    skip_warmup: !warmup,
                },
            )?;
            eprintln!("parsed in {:.2?}", started.elapsed());

            let h = &parsed.header;
            println!("map          {}", h.map_name);
            println!(
                "score        CT {} ({})  –  T {} ({})",
                h.score_ct, h.team_ct, h.score_t, h.team_t
            );
            println!(
                "duration     {:.1}s  ({} ticks @ {:.0} Hz, stride {})",
                h.duration_s, h.playback_ticks, h.tick_rate, h.tick_stride
            );
            println!(
                "rounds       {}    frames {}",
                parsed.rounds.len(),
                parsed.ticks.frame_count
            );
            println!(
                "events       {} kills  {} shots  {} grenades  {} bomb",
                parsed.kills.len(),
                parsed.shots.len(),
                parsed.grenades.len(),
                parsed.bomb_events.len()
            );
            println!();
            println!(
                "{:<16} {:>3} {:>3} {:>3} {:>6} {:>6} {:>5} {:>5} {:>4} {:>4}",
                "player", "K", "D", "A", "ADR", "KAST", "HS%", "UD", "FK", "FD"
            );
            let mut stats = parsed.stats.clone();
            stats.sort_by(|a, b| {
                b.adr
                    .partial_cmp(&a.adr)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
            for s in &stats {
                let name = parsed
                    .players
                    .get(s.player as usize)
                    .map(|p| p.name.as_str())
                    .unwrap_or("?");
                let side = parsed
                    .players
                    .get(s.player as usize)
                    .map(|p| match p.start_side {
                        Side::Ct => "CT",
                        Side::T => "T ",
                    })
                    .unwrap_or("  ");
                println!(
                    "{side} {:<14} {:>3} {:>3} {:>3} {:>6.1} {:>5.1}% {:>5.1} {:>5} {:>4} {:>4}",
                    truncate(name, 14),
                    s.kills,
                    s.deaths,
                    s.assists,
                    s.adr,
                    s.kast,
                    s.headshot_percent,
                    s.utility_damage,
                    s.first_kills,
                    s.first_deaths
                );
            }

            if let Some(path) = json {
                let file = std::fs::File::create(&path)?;
                serde_json::to_writer(file, &parsed)?;
                eprintln!("wrote {}", path.display());
            }
        }
    }
    Ok(())
}

fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let mut out: String = s.chars().take(max.saturating_sub(1)).collect();
        out.push('…');
        out
    }
}
