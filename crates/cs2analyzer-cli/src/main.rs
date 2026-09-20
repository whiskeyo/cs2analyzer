//! Parse a Counter-Strike 2 GOTV demo on the command line and print JSON.
//!
//! The parser was previously reachable only from the browser worker, so there
//! was no way to look at what a real demo assembles into, generate a test
//! fixture, or check the Rust scoreboard against the one the viewer computes.
//! JSON goes to stdout and progress to stderr, so output can be piped.

use std::path::Path;
use std::process::ExitCode;

use cs2analyzer::{compute_stats_until, parse_demo_with_progress, Match, ParseOptions};

mod fixture;
mod series;

const USAGE: &str = "\
cs2analyzer — dump a CS2 demo as JSON

USAGE:
    cs2analyzer <demo.dem> [OPTIONS]
    cs2analyzer --generate-ts-series <a.dem> <b.dem> [...]

OPTIONS:
    -s, --section <NAME>  What to print (default: summary)
    -t, --tick <TICK>     Only count events up to this tick (sections: stats, replay)
        --stride <N>      Keep one tick snapshot every N demo ticks
                          (default: 4; 6 ≈ 10 Hz for tutorial TypeScript)
        --generate-ts-fixture
                          Two-round tutorial TypeScript under
                          apps/web/src/lib/tutorial/single-demo/ (walks up from
                          cwd, or the cargo workspace). No match JSON on stdout.
        --generate-ts-series
                          Same-map Aggregated tutorial under
                          apps/web/src/lib/tutorial/multi-demo/. Full round
                          list; habits-window ticks for full-buy regulation
                          rounds across the series (default 20s window).
        --habits-window <SEC>
                          Series habits window after freeze (default 20; 5–60).
        --series-rounds <N>
                          Cap on full-buy regulation rounds that keep
                          habits-window ticks, counted across the whole
                          series (default 20). Round-robin across demos,
                          balancing the focal team's CT and T sides.
                          Unused rounds still emit headers + a freeze
                          snapshot so the strip can label pistol/eco/force.
        --pretty          Indent the JSON
    -q, --quiet           No progress on stderr
    -h, --help            Show this help

SECTIONS:
    summary  Map, teams, score, and how much of everything was found
    replay   Everything in one object, for fixtures and cross-checks
    header, players, rounds, grenades, shots, kills, hurts, blinds,
    bomb-events, buy-events, stats, ticks
";

const SECTIONS: [&str; 14] = [
    "summary",
    "replay",
    "header",
    "players",
    "rounds",
    "grenades",
    "shots",
    "kills",
    "hurts",
    "blinds",
    "bomb-events",
    "buy-events",
    "stats",
    "ticks",
];

struct Args {
    paths: Vec<String>,
    section: String,
    tick: u32,
    stride: u32,
    stride_explicit: bool,
    pretty: bool,
    quiet: bool,
    generate_ts_fixture: bool,
    generate_ts_series: bool,
    habits_window_sec: u32,
    series_rounds: u32,
}

fn main() -> ExitCode {
    let args = match parse_args() {
        Ok(Some(args)) => args,
        Ok(None) => {
            print!("{USAGE}");
            return ExitCode::SUCCESS;
        }
        Err(message) => {
            eprintln!("cs2analyzer: {message}\n\n{USAGE}");
            return ExitCode::FAILURE;
        }
    };
    match run(&args) {
        Ok(json) => {
            if !json.is_empty() {
                println!("{json}");
            }
            ExitCode::SUCCESS
        }
        Err(message) => {
            eprintln!("cs2analyzer: {message}");
            ExitCode::FAILURE
        }
    }
}

/// `Ok(None)` means help was asked for.
fn parse_args() -> Result<Option<Args>, String> {
    let mut paths: Vec<String> = Vec::new();
    let mut section = "summary".to_string();
    let mut tick = u32::MAX;
    let mut stride = cs2analyzer::DEFAULT_TICK_STRIDE;
    let mut stride_explicit = false;
    let mut pretty = false;
    let mut quiet = false;
    let mut generate_ts_fixture = false;
    let mut generate_ts_series = false;
    let mut habits_window_sec = series::default_habits_window_sec();
    let mut series_rounds = series::TUTORIAL_SERIES_FULL_BUY_CAP;

    let mut argv = std::env::args().skip(1);
    while let Some(arg) = argv.next() {
        match arg.as_str() {
            "-h" | "--help" => return Ok(None),
            "--pretty" => pretty = true,
            "-q" | "--quiet" => quiet = true,
            "--generate-ts-fixture" => generate_ts_fixture = true,
            "--generate-ts-series" => generate_ts_series = true,
            "-s" | "--section" => section = next_value(&mut argv, &arg)?,
            "-t" | "--tick" => tick = parse_number(&next_value(&mut argv, &arg)?, &arg)?,
            "--stride" => {
                stride = parse_number(&next_value(&mut argv, &arg)?, &arg)?.max(1);
                stride_explicit = true;
            }
            "--habits-window" => {
                habits_window_sec = fixture::clamp_habits_window_sec(parse_number(
                    &next_value(&mut argv, &arg)?,
                    &arg,
                )?);
            }
            "--series-rounds" => {
                series_rounds = parse_number(&next_value(&mut argv, &arg)?, &arg)?.max(1);
            }
            other if other.starts_with('-') => return Err(format!("unknown option {other}")),
            other => paths.push(other.to_string()),
        }
    }

    if generate_ts_fixture && generate_ts_series {
        return Err("use only one of --generate-ts-fixture or --generate-ts-series".to_string());
    }
    if paths.is_empty() {
        return Err("no demo given".to_string());
    }
    if generate_ts_series {
        if paths.len() > series::TUTORIAL_SERIES_MAX_MATCHES {
            return Err(format!(
                "series fixture accepts at most {} demos (got {})",
                series::TUTORIAL_SERIES_MAX_MATCHES,
                paths.len()
            ));
        }
    } else if paths.len() != 1 {
        return Err(
            "unexpected extra demo path (use --generate-ts-series for several)".to_string(),
        );
    }
    if !SECTIONS.contains(&section.as_str()) {
        return Err(format!("unknown section {section}"));
    }
    Ok(Some(Args {
        paths,
        section,
        tick,
        stride,
        stride_explicit,
        pretty,
        quiet,
        generate_ts_fixture,
        generate_ts_series,
        habits_window_sec,
        series_rounds,
    }))
}

fn next_value(argv: &mut impl Iterator<Item = String>, flag: &str) -> Result<String, String> {
    argv.next().ok_or_else(|| format!("{flag} needs a value"))
}

fn parse_number(value: &str, flag: &str) -> Result<u32, String> {
    value
        .parse()
        .map_err(|_| format!("{flag} wants a whole number, got {value}"))
}

fn tutorial_tick_stride(args: &Args) -> u32 {
    if (args.generate_ts_fixture || args.generate_ts_series) && !args.stride_explicit {
        fixture::TUTORIAL_TICK_STRIDE
    } else {
        args.stride
    }
}

fn parse_one_demo(path: &str, tick_stride: u32, quiet: bool) -> Result<Match, String> {
    let bytes = std::fs::read(path).map_err(|e| format!("cannot read {path}: {e}"))?;
    let progress = progress_reporter(quiet);
    let parsed = parse_demo_with_progress(
        &bytes,
        ParseOptions {
            tick_stride,
            skip_warmup: true,
        },
        progress,
    )
    .map_err(|e| e.to_string())?;
    if !quiet {
        eprintln!();
    }
    Ok(parsed)
}

fn run(args: &Args) -> Result<String, String> {
    let tick_stride = tutorial_tick_stride(args);
    if args.generate_ts_series {
        return write_ts_series(args, tick_stride);
    }
    let path = args
        .paths
        .first()
        .ok_or_else(|| "no demo given".to_string())?;
    let parsed = parse_one_demo(path, tick_stride, args.quiet)?;
    if args.generate_ts_fixture {
        return write_ts_fixture(&parsed, args.quiet);
    }
    section_json(&parsed, args)
}

/// Slice two live rounds and write TypeScript. Progress and the success
/// summary go to stderr; stdout stays empty so a pipe never sees megabytes.
fn write_ts_fixture(parsed: &Match, quiet: bool) -> Result<String, String> {
    if !quiet {
        eprintln!(
            "slicing first {} non-knife regulation rounds",
            fixture::TUTORIAL_LIVE_ROUNDS
        );
    }
    let slice = fixture::slice_tutorial_match(parsed, fixture::TUTORIAL_LIVE_ROUNDS)?;
    let dir = fixture::discover_single_demo_dir(Path::new("."))?;
    if !quiet {
        eprintln!("writing TypeScript under {}", dir.display());
    }
    let hydrate = tutorial_hydrate_source();
    let summary =
        fixture::write_tutorial_fixture(&dir, &slice, fixture::TS_SHARD_VALUE_THRESHOLD, hydrate)?;
    if !quiet {
        eprintln!("wrote tutorial fixture:");
        for (name, bytes) in &summary.files {
            eprintln!("  {name} ({})", format_bytes(*bytes));
        }
        eprintln!(
            "  {} frames, {} players, {} rounds, map {}, origin tick {} → 0",
            summary.frame_count,
            summary.player_count,
            summary.round_count,
            summary.map_name,
            summary.origin_tick
        );
    }
    Ok(String::new())
}

/// Slice habits windows from each demo and write `tutorial/multi-demo/`.
fn write_ts_series(args: &Args, tick_stride: u32) -> Result<String, String> {
    let mut parsed_matches = Vec::new();
    for (index, path) in args.paths.iter().enumerate() {
        if !args.quiet {
            eprintln!(
                "parsing series demo {} / {}: {path}",
                index + 1,
                args.paths.len()
            );
        }
        parsed_matches.push(parse_one_demo(path, tick_stride, args.quiet)?);
    }
    let match_refs: Vec<&Match> = parsed_matches.iter().collect();
    let focal = series::infer_series_focal_names(&match_refs);
    let candidates: Vec<Vec<series::FullBuyCandidate>> = parsed_matches
        .iter()
        .map(|parsed| series::full_buy_candidates(parsed, &focal))
        .collect();
    let allocated = series::assign_full_buy_active_rounds(&candidates, args.series_rounds as usize);
    if allocated.iter().all(|rounds| rounds.is_empty()) {
        return Err("series has no full-buy regulation rounds for Aggregated".to_string());
    }
    let mut matches = Vec::new();
    for (index, parsed) in parsed_matches.iter().enumerate() {
        if !args.quiet {
            let picked = &allocated[index];
            let ct = candidates[index]
                .iter()
                .filter(|c| picked.contains(&c.number) && c.side == cs2analyzer::Side::Ct)
                .count();
            let t = candidates[index]
                .iter()
                .filter(|c| picked.contains(&c.number) && c.side == cs2analyzer::Side::T)
                .count();
            eprintln!(
                "  {} full-buy habits windows (of {} candidates; {} CT / {} T)",
                picked.len(),
                candidates[index].len(),
                ct,
                t
            );
        }
        matches.push(series::series_match_from_parsed(
            parsed,
            index,
            &allocated[index],
            args.habits_window_sec,
        )?);
    }
    let dir = series::discover_series_dir(Path::new("."))?;
    if !args.quiet {
        eprintln!(
            "writing Aggregated tutorial (habits window {}s) under {}",
            args.habits_window_sec,
            dir.display()
        );
    }
    let summary = series::write_tutorial_series(
        &dir,
        &matches,
        args.habits_window_sec,
        series::shard_threshold(),
    )?;
    if !args.quiet {
        eprintln!("wrote tutorial series:");
        for (name, bytes) in &summary.files {
            eprintln!("  {name} ({})", format_bytes(*bytes));
        }
        eprintln!(
            "  {} matches (target {}), {} frames, {} players, map {}, habits {}s, {} total ({:.1} KiB)",
            summary.match_count,
            series::TUTORIAL_SERIES_TARGET_MATCHES,
            summary.frame_count,
            summary.player_count,
            summary.map_name,
            summary.habits_window_sec,
            format_bytes(summary.total_bytes),
            summary.total_bytes as f64 / 1024.0
        );
        if summary.total_bytes > series::SERIES_FIXTURE_BUDGET_BYTES {
            eprintln!(
                "  warning: uncompressed series TS is above the {:.0} MiB soft budget",
                series::SERIES_FIXTURE_BUDGET_BYTES as f64 / (1024.0 * 1024.0)
            );
        }
    }
    Ok(String::new())
}

fn tutorial_hydrate_source() -> Option<&'static str> {
    Some(include_str!(
        "../../../apps/web/src/lib/tutorial/single-demo/hydrate.ts"
    ))
}

fn format_bytes(n: usize) -> String {
    if n >= 1024 * 1024 {
        format!("{:.1} MB", n as f64 / (1024.0 * 1024.0))
    } else if n >= 1024 {
        format!("{:.1} KB", n as f64 / 1024.0)
    } else {
        format!("{n} B")
    }
}

/// Reports whole percents on stderr so a long parse does not look hung.
fn progress_reporter(quiet: bool) -> Option<Box<dyn FnMut(u32, u32)>> {
    if quiet {
        return None;
    }
    let mut last = u32::MAX;
    Some(Box::new(move |current, total| {
        if total == 0 {
            return;
        }
        let percent = (u64::from(current) * 100 / u64::from(total)) as u32;
        if percent != last {
            last = percent;
            eprint!("\rparsing {percent}%");
        }
    }))
}

fn section_json(m: &Match, args: &Args) -> Result<String, String> {
    let encode = |value: &serde_json::Value| -> Result<String, String> {
        if args.pretty {
            serde_json::to_string_pretty(value)
        } else {
            serde_json::to_string(value)
        }
        .map_err(|e| e.to_string())
    };
    let value = match args.section.as_str() {
        "summary" => summary(m, args.tick),
        "replay" => replay(m, args.tick)?,
        "header" => to_value(&m.header)?,
        "players" => to_value(&m.players)?,
        "rounds" => to_value(&m.rounds)?,
        "grenades" => to_value(&m.grenades)?,
        "shots" => to_value(&m.shots)?,
        "kills" => to_value(&m.kills)?,
        "hurts" => to_value(&m.hurts)?,
        "blinds" => to_value(&m.blinds)?,
        "bomb-events" => to_value(&m.bomb_events)?,
        "buy-events" => to_value(&m.buy_events)?,
        "stats" => to_value(&compute_stats_until(m, args.tick))?,
        "ticks" => to_value(&m.ticks)?,
        other => return Err(format!("unknown section {other}")),
    };
    encode(&value)
}

fn to_value<T: serde::Serialize>(value: &T) -> Result<serde_json::Value, String> {
    serde_json::to_value(value).map_err(|e| e.to_string())
}

/// The whole match in one object, so a consumer parses the demo once. `stats`
/// is the scoreboard as of `--tick`, which defaults to the end of the match.
fn replay(m: &Match, until_tick: u32) -> Result<serde_json::Value, String> {
    let mut value = to_value(m)?;
    let stats = to_value(&compute_stats_until(m, until_tick))?;
    match value.as_object_mut() {
        Some(object) => {
            object.insert("stats".to_string(), stats);
            Ok(value)
        }
        None => Err("match did not serialize to an object".to_string()),
    }
}

fn summary(m: &Match, until_tick: u32) -> serde_json::Value {
    let knife = m.rounds.iter().filter(|r| r.is_knife).count();
    let stats = compute_stats_until(m, until_tick);
    let scoreboard: Vec<serde_json::Value> = stats
        .iter()
        .map(|s| {
            let name = m
                .players
                .iter()
                .find(|p| p.index == s.player)
                .map(|p| p.name.clone())
                .unwrap_or_default();
            serde_json::json!({
                "player": s.player,
                "name": name,
                "kills": s.kills,
                "deaths": s.deaths,
                "assists": s.assists,
                "adr": round2(s.adr),
                "kast": round2(s.kast),
                "headshot_percent": round2(s.headshot_percent),
            })
        })
        .collect();
    serde_json::json!({
        "map": m.header.map_name,
        "tick_rate": m.header.tick_rate,
        "tick_stride": m.header.tick_stride,
        "duration_s": round2(m.header.duration_s),
        "playback_ticks": m.header.playback_ticks,
        "team_ct": m.header.team_ct,
        "team_t": m.header.team_t,
        "score_ct": m.header.score_ct,
        "score_t": m.header.score_t,
        "counts": {
            "players": m.players.len(),
            "rounds": m.rounds.len(),
            "knife_rounds": knife,
            "frames": m.ticks.frame_count,
            "grenades": m.grenades.len(),
            "shots": m.shots.len(),
            "kills": m.kills.len(),
            "hurts": m.hurts.len(),
            "blinds": m.blinds.len(),
            "bomb_events": m.bomb_events.len(),
            "buy_events": m.buy_events.len(),
        },
        "scoreboard": scoreboard,
    })
}

fn round2(value: f32) -> f32 {
    (value * 100.0).round() / 100.0
}

#[cfg(test)]
mod tests {
    use super::USAGE;

    #[test]
    fn help_mentions_generate_ts_fixture() {
        assert!(USAGE.contains("--generate-ts-fixture"));
        assert!(USAGE.contains("apps/web/src/lib/tutorial/single-demo"));
        assert!(USAGE.contains("--generate-ts-series"));
        assert!(USAGE.contains("--habits-window"));
        assert!(USAGE.contains("--series-rounds"));
        assert!(USAGE.contains("full-buy"));
        assert!(USAGE.contains("apps/web/src/lib/tutorial/multi-demo"));
    }
}
