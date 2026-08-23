import { computeStats, currentSide, liveTeams } from "./stats";
import { samplePlayers } from "./sample";
import type { PlayerStats, Replay } from "./types";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onSelect: (index: number) => void;
}

function rowClass(stats: PlayerStats, side: string, selected: number | null): string {
  return `sb-row ${side === "CT" ? "ct" : "t"}${selected === stats.player ? " selected" : ""}`;
}

export function Scoreboard({ replay, tick, selected, onSelect }: Props) {
  const stats = computeStats(replay, tick);
  const teams = liveTeams(replay, tick);
  const sampled = samplePlayers(replay, tick);

  const withSide = stats.map((s) => ({
    s,
    side: currentSide(replay, s.player, tick),
  }));
  const ct = withSide.filter((x) => x.side === "CT").sort((a, b) => b.s.rating - a.s.rating);
  const t = withSide.filter((x) => x.side === "T").sort((a, b) => b.s.rating - a.s.rating);

  const table = (title: string, rows: typeof ct, teamScore: number) => (
    <div className="sb-team">
      <div className="sb-head">
        <span>{title}</span>
        <strong>{teamScore}</strong>
      </div>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>$</th>
            <th>K</th>
            <th>D</th>
            <th>A</th>
            <th>ADR</th>
            <th>KAST</th>
            <th>Rtg</th>
            <th>Ent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ s, side }) => (
            <tr
              key={s.player}
              className={rowClass(s, side, selected)}
              onClick={() => onSelect(s.player)}
            >
              <td>{replay.players[s.player]?.name ?? "?"}</td>
              <td className="eco-money">${sampled[s.player]?.money ?? 0}</td>
              <td>{s.kills}</td>
              <td>{s.deaths}</td>
              <td>{s.assists}</td>
              <td>{s.adr.toFixed(1)}</td>
              <td>{s.kast.toFixed(0)}</td>
              <td>{s.rating.toFixed(2)}</td>
              <td>{s.entry_attempts > 0 ? `${s.first_kills}/${s.entry_attempts}` : "0"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const sel = selected != null ? stats.find((s) => s.player === selected) : null;
  const selPlayer = selected != null ? replay.players[selected] : null;

  return (
    <div>
      {table(teams.ctName, ct, teams.ct)}
      {table(teams.tName, t, teams.t)}
      {sel && selPlayer && (
        <div className="detail">
          <h3>{selPlayer.name}</h3>
          <p className="steam">{selPlayer.steam_id ? String(selPlayer.steam_id) : ""}</p>
          <dl>
            <dt>K / D / A</dt>
            <dd>
              {sel.kills} / {sel.deaths} / {sel.assists} ({sel.kd.toFixed(2)})
            </dd>
            <dt>Rating / Impact</dt>
            <dd>
              {sel.rating.toFixed(2)} / {sel.impact.toFixed(2)}
            </dd>
            <dt>KPR / DPR</dt>
            <dd>
              {sel.kpr.toFixed(2)} / {sel.dpr.toFixed(2)}
            </dd>
            <dt>CT / T</dt>
            <dd>
              {sel.kills_ct}/{sel.deaths_ct} · ADR {sel.adr_ct.toFixed(1)}
              {" · "}
              {sel.kills_t}/{sel.deaths_t} · ADR {sel.adr_t.toFixed(1)}
            </dd>
            <dt>Damage (taken)</dt>
            <dd>
              {sel.damage} ({sel.damage_taken})
            </dd>
            <dt>HS% / UD</dt>
            <dd>
              {sel.hs_percent.toFixed(0)}% / {sel.utility_damage}
            </dd>
            <dt>Opening (FK/FD)</dt>
            <dd>
              {sel.first_kills} / {sel.first_deaths}
              {sel.entry_attempts > 0 ? ` · ${sel.entry_success.toFixed(0)}% entry` : ""}
            </dd>
            <dt>Trades (got / was)</dt>
            <dd>
              {sel.trade_kills} / {sel.trade_deaths}
            </dd>
            <dt>Flashes (time)</dt>
            <dd>
              {sel.enemies_flashed} ({sel.flash_time.toFixed(1)}s)
            </dd>
            <dt>Flash assists / HE kills</dt>
            <dd>
              {sel.flash_assists} / {sel.he_kills}
            </dd>
            <dt>Nades / survived</dt>
            <dd>
              {sel.nades} / {sel.survived}
            </dd>
            <dt>Clutches (W/A)</dt>
            <dd>
              {sel.clutch_wins}/{sel.clutch_attempts}
              {sel.clutch_attempts > 0
                ? ` · 1v1 ${sel.clutch_1v1} · 1v2 ${sel.clutch_1v2} · 1v3+ ${sel.clutch_1v3}`
                : ""}
            </dd>
            <dt>2K / 3K / 4K / Ace</dt>
            <dd>
              {sel.multi_kills_2} / {sel.multi_kills_3} / {sel.multi_kills_4} / {sel.aces}
            </dd>
            <dt>Plants / defuses</dt>
            <dd>
              {sel.plants} / {sel.defuses}
            </dd>
          </dl>
        </div>
      )}
    </div>
  );
}
