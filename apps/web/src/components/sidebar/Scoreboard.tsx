import { memo } from "react";
import { useMessages } from "@/lib/i18n";
import {
  computeStats,
  currentSide,
  formatAdr,
  formatKast,
  liveScoreboardPlayers,
  liveTeams,
  teamEntryShare,
} from "@/lib/stats/stats";
import { playerLabel } from "@/lib/replay/playerLabel";
import { samplePlayers } from "@/lib/replay/sample";
import type { PlayerStats, Replay } from "@/lib/replay/replayTypes";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onSelect: (index: number) => void;
}

function rowClass(stats: PlayerStats, side: string, selected: number | null): string {
  return `sb-row ${side === "CT" ? "ct" : "t"}${selected === stats.player ? " selected" : ""}`;
}

export const Scoreboard = memo(function Scoreboard({ replay, tick, selected, onSelect }: Props) {
  const { messages, t: tr } = useMessages();
  const stats = computeStats(replay, tick);
  const teams = liveTeams(replay, tick);
  const sampled = samplePlayers(replay, tick);

  const live = new Set(liveScoreboardPlayers(replay, tick));
  const withSide = stats
    .filter((s) => live.has(s.player))
    .map((s) => ({
      s,
      side: currentSide(replay, s.player, tick),
    }));
  const ct = withSide.filter((x) => x.side === "CT").sort((a, b) => b.s.rating - a.s.rating);
  const terror = withSide.filter((x) => x.side === "T").sort((a, b) => b.s.rating - a.s.rating);

  const table = (title: string, rows: typeof ct, teamScore: number) => (
    <div className="sb-team">
      <div className="sb-head">
        <span>{title}</span>
        <strong>{teamScore}</strong>
      </div>
      <table>
        <thead>
          <tr>
            <th>{messages.sidebar.scorePlayer}</th>
            <th>$</th>
            <th>{messages.sidebar.scoreKills}</th>
            <th>{messages.sidebar.scoreDeaths}</th>
            <th>{messages.sidebar.scoreAssists}</th>
            <th>ADR</th>
            <th>KAST</th>
            <th>{messages.sidebar.scoreRating}</th>
            <th>{messages.sidebar.scoreEntry}</th>
            <th>CT</th>
            <th>T</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ s, side }) => (
            <tr
              key={s.player}
              className={rowClass(s, side, selected)}
              onClick={() => onSelect(s.player)}
            >
              <td>{playerLabel(replay.players[s.player])}</td>
              <td className="eco-money">${sampled[s.player]?.money ?? 0}</td>
              <td>{s.kills}</td>
              <td>{s.deaths}</td>
              <td>{s.assists}</td>
              <td>{formatAdr(s.adr)}</td>
              <td>{formatKast(s.kast)}</td>
              <td>{s.rating.toFixed(2)}</td>
              <td className="sb-entry">
                <span className="entry-main">
                  {s.entry_attempts > 0 ? `${s.first_kills}/${s.entry_attempts}` : "—"}
                </span>
                <span className="entry-pct">
                  {s.entry_attempts > 0 ? `${s.entry_success.toFixed(0)}%` : "\u00a0"}
                </span>
              </td>
              <td className="sb-split">
                {s.kills_ct}-{s.deaths_ct}
              </td>
              <td className="sb-split">
                {s.kills_t}-{s.deaths_t}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const sel = selected != null ? stats.find((s) => s.player === selected) : null;
  const selPlayer = selected != null ? replay.players[selected] : null;
  const share = selected != null ? teamEntryShare(stats, replay.players, selected) : null;

  return (
    <div>
      {table(teams.ctName, ct, teams.ct)}
      {table(teams.tName, terror, teams.t)}
      {sel && selPlayer && (
        <div className="detail">
          <h3>{playerLabel(selPlayer)}</h3>
          <p className="steam">
            {selPlayer.is_bot
              ? messages.sidebar.bot
              : selPlayer.steam_id
                ? String(selPlayer.steam_id)
                : ""}
          </p>
          <dl>
            <dt>{messages.sidebar.detailKda}</dt>
            <dd>
              {sel.kills} / {sel.deaths} / {sel.assists} ({sel.kd.toFixed(2)})
            </dd>
            <dt>{messages.sidebar.detailRatingImpact}</dt>
            <dd>
              {sel.rating.toFixed(2)} / {sel.impact.toFixed(2)}
            </dd>
            <dt>{messages.sidebar.detailPerRound}</dt>
            <dd>
              {sel.kills_per_round.toFixed(2)} / {sel.deaths_per_round.toFixed(2)}
            </dd>
            <dt>{messages.sidebar.detailSideSplit}</dt>
            <dd>
              {sel.kills_ct}/{sel.deaths_ct} · ADR {formatAdr(sel.adr_ct)}
              {" · "}
              {sel.kills_t}/{sel.deaths_t} · ADR {formatAdr(sel.adr_t)}
            </dd>
            <dt>{messages.sidebar.detailDamage}</dt>
            <dd>
              {sel.damage} ({sel.damage_taken})
            </dd>
            <dt>{messages.sidebar.detailHsUtil}</dt>
            <dd>
              {sel.headshot_percent.toFixed(0)}% / {sel.utility_damage}
            </dd>
            <dt>{messages.sidebar.detailOpening}</dt>
            <dd>
              {sel.first_kills} / {sel.first_deaths}
              {sel.entry_attempts > 0
                ? tr(messages.sidebar.entrySuccess, { pct: sel.entry_success.toFixed(0) })
                : ""}
              {share && share.teamAttempts > 0
                ? tr(messages.sidebar.teamEntryShare, {
                    pct: share.pct.toFixed(0),
                    attempts: share.attempts,
                    teamAttempts: share.teamAttempts,
                  })
                : ""}
            </dd>
            <dt>{messages.sidebar.detailTrades}</dt>
            <dd>
              {sel.trade_kills} / {sel.trade_deaths}
            </dd>
            <dt>{messages.sidebar.detailFlashes}</dt>
            <dd>
              {sel.enemies_flashed} ({sel.flash_time.toFixed(1)}s)
            </dd>
            <dt>{messages.sidebar.detailFlashAssists}</dt>
            <dd>
              {sel.flash_assists} /{" "}
              {sel.rounds > 0 ? (sel.utility_damage / sel.rounds).toFixed(1) : "0.0"}
            </dd>
            <dt>{messages.sidebar.detailNadesSurvived}</dt>
            <dd>
              {sel.nades} / {sel.survived}
            </dd>
            <dt>{messages.sidebar.detailClutches}</dt>
            <dd>
              {[
                `${sel.clutch_1v1}/${sel.clutch_1v1_attempts}`,
                `${sel.clutch_1v2}/${sel.clutch_1v2_attempts}`,
                `${sel.clutch_1v3}/${sel.clutch_1v3_attempts}`,
                `${sel.clutch_1v4}/${sel.clutch_1v4_attempts}`,
                `${sel.clutch_1v5}/${sel.clutch_1v5_attempts}`,
              ].join(" / ")}
            </dd>
            <dt>{messages.sidebar.detailMultis}</dt>
            <dd>
              {sel.multi_kills_2} / {sel.multi_kills_3} / {sel.multi_kills_4} / {sel.aces}
            </dd>
            <dt>{messages.sidebar.detailPlants}</dt>
            <dd>
              {sel.plants} / {sel.defuses}
            </dd>
          </dl>
        </div>
      )}
    </div>
  );
});
