import { liveTeams } from "./stats";
import { LoadoutIcons, formatMoney } from "./loadout";
import { samplePlayers } from "./sample";
import type { Replay } from "./types";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onSelect: (index: number) => void;
}

function buyLabel(equip: number, alive: boolean): { id: string; text: string } {
  if (!alive) return { id: "dead", text: "dead" };
  if (equip < 2000) return { id: "eco", text: "eco" };
  if (equip < 3700) return { id: "force", text: "force" };
  return { id: "full", text: "full" };
}

export function Economy({ replay, tick, selected, onSelect }: Props) {
  const samples = samplePlayers(replay, tick);
  const teams = liveTeams(replay, tick);
  const rows = samples
    .filter((p) => p.present)
    .map((p) => ({
      p,
      name: replay.players[p.index]?.name ?? "?",
    }));
  const ct = rows.filter((r) => r.p.ct);
  const t = rows.filter((r) => !r.p.ct);
  const team = (title: string, list: typeof ct, side: "ct" | "t") => {
    const total = list.reduce((s, r) => s + r.p.money, 0);
    const eq = list.reduce((s, r) => s + r.p.equip, 0);
    return (
      <div className={`sb-team eco-team ${side}`}>
        <div className="sb-head">
          <span>{title}</span>
          <strong>
            {formatMoney(total)} <span className="eco-eq-sum">eq {formatMoney(eq)}</span>
          </strong>
        </div>
        <table className="eco-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>$</th>
              <th>Eq</th>
              <th>Buy</th>
              <th>Loadout</th>
            </tr>
          </thead>
          <tbody>
            {list.map(({ p, name }) => {
              const buy = buyLabel(p.equip, p.alive);
              return (
                <tr
                  key={p.index}
                  className={`sb-row ${p.ct ? "ct" : "t"}${selected === p.index ? " selected" : ""}${p.alive ? "" : " dead"}`}
                  onClick={() => onSelect(p.index)}
                >
                  <td>{name}</td>
                  <td className="eco-money">{formatMoney(p.money)}</td>
                  <td>{formatMoney(p.equip)}</td>
                  <td>
                    <span className={`buy ${buy.id}`}>{buy.text}</span>
                  </td>
                  <td>
                    <LoadoutIcons p={p} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      {team(teams.ctName, ct, "ct")}
      {team(teams.tName, t, "t")}
      <p className="muted tab-hint">Money, equipment value, and inventory at this tick.</p>
    </div>
  );
}
