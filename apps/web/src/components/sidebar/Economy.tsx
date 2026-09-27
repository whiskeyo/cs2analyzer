import { useMemo } from "react";
import { formatMoney } from "@/lib/weapons/loadout";
import {
  ECONOMY_BUY_LABEL,
  ECONOMY_BUY_ORDER,
  formatBuyRecord,
  formatBuyWinRate,
  matchEconomy,
  type EconomyBuy,
  type EconomyCell,
} from "@/lib/match/economy";
import { currentRound } from "@/lib/replay/sample";
import type { Replay, Round } from "@/lib/replay/replayTypes";

interface Props {
  replay: Replay;
  tick: number;
  onJump: (tick: number) => void;
  activeRound?: Round | null;
}

export function Economy({ replay, tick, onJump, activeRound }: Props) {
  const economy = useMemo(() => matchEconomy(replay), [replay]);
  const live = activeRound ?? currentRound(replay, tick);
  const numbers = economy.rows[0]?.cells ?? [];

  if (economy.rounds.length === 0) {
    return (
      <section className="economy" aria-label="Economy">
        <h3 className="economy-heading">Economy</h3>
        <p className="muted tab-hint">No competitive rounds to chart.</p>
      </section>
    );
  }

  return (
    <section className="economy" aria-label="Economy">
      <h3 className="economy-heading">Economy</h3>
      <p className="tab-hint">
        Each team&apos;s buy at freeze end, and how often that buy won the round. Anti-eco is a
        force or full buy against an eco. A white edge marks the round winner.
      </p>
      <div className="economy-chart">
        <div className="economy-row" aria-hidden="true">
          <span className="economy-team-label" />
          <div className="economy-cells">
            {numbers.map((cell) => (
              <span key={cell.round} className="economy-slot">
                {cell.breakBefore ? <span className="economy-gap" /> : null}
                <span className="economy-num">{cell.round}</span>
              </span>
            ))}
          </div>
        </div>
        {economy.rows.map((row) => (
          <div key={row.team} className="economy-row">
            <span className="economy-team-label" title={row.team}>
              {row.team}
            </span>
            <div className="economy-cells">
              {row.cells.map((cell) => {
                const current = live != null && !live.is_knife && live.number === cell.round;
                return (
                  <span key={cell.round} className="economy-slot">
                    {cell.breakBefore ? <span className="economy-gap" aria-hidden="true" /> : null}
                    <button
                      type="button"
                      className={`economy-cell ${buyClass(cell.buy)}${cell.won ? " win" : ""}${current ? " on" : ""}`}
                      title={cellTitle(row.team, cell)}
                      aria-label={cellTitle(row.team, cell)}
                      onClick={() => onJump(cell.jumpTick)}
                    />
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <ul className="economy-legend">
        {ECONOMY_BUY_ORDER.map((buy) => (
          <li key={buy}>
            <span className={`economy-swatch ${buyClass(buy)}`} />
            {ECONOMY_BUY_LABEL[buy]}
          </li>
        ))}
      </ul>
      <div className="economy-rates">
        {economy.rates.map((team) => (
          <div key={team.team}>
            <p className="economy-team">{team.team}</p>
            {team.rows.length === 0 ? (
              <p className="muted tab-hint">No buy data at freeze.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Buy</th>
                    <th>Won</th>
                    <th>Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {team.rows.map((row) => (
                    <tr key={row.buy}>
                      <td>{ECONOMY_BUY_LABEL[row.buy]}</td>
                      <td title={`${row.wins} wins in ${row.rounds} rounds`}>
                        {formatBuyRecord(row.wins, row.rounds)}
                      </td>
                      <td>{formatBuyWinRate(row.wins, row.rounds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function buyClass(buy: EconomyBuy | null): string {
  if (buy === "anti-eco") return "buy-anti";
  if (buy == null) return "buy-none";
  return `buy-${buy}`;
}

function cellTitle(team: string, cell: EconomyCell): string {
  const buy = cell.buy ? ECONOMY_BUY_LABEL[cell.buy] : "No buy";
  const money =
    cell.averageEquipment == null ? "" : ` · ${formatMoney(Math.round(cell.averageEquipment))}`;
  let result = "no winner";
  if (cell.won) result = "won";
  else if (cell.decided) result = "lost";
  return `Round ${cell.round} · ${team} (${cell.side}) · ${buy}${money} · ${result}`;
}
