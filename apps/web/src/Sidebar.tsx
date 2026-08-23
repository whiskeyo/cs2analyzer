import { useState } from "react";
import { Economy } from "./Economy";
import { Review } from "./Review";
import { currentRound } from "./sample";
import { Scoreboard } from "./Scoreboard";
import { computeStats, weaponBreakdown } from "./stats";
import type { Replay } from "./types";
import { WeaponIcon } from "./WeaponIcon";
import { winReasonLabel } from "./weapons";

type Tab = "score" | "eco" | "review" | "rounds" | "weapons" | "kills";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onSelect: (index: number | null) => void;
  onJump: (tick: number) => void;
}

export function Sidebar({ replay, tick, selected, onSelect, onJump }: Props) {
  const [tab, setTab] = useState<Tab>("score");
  const round = currentRound(replay, tick);
  const stats = computeStats(replay, tick);
  const weapons = weaponBreakdown(replay, tick, selected);
  const roundKills = replay.kills.filter((k) => {
    if (!round) return false;
    return k.tick >= round.start_tick && k.tick <= Math.min(round.end_tick, tick);
  });

  return (
    <aside className="sidebar">
      <div className="tabs">
        {(["score", "eco", "review", "rounds", "weapons", "kills"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "on" : ""}
            onClick={() => setTab(id)}
          >
            {id === "score" ? "Score" : id[0].toUpperCase() + id.slice(1)}
          </button>
        ))}
      </div>
      {tab === "score" && (
        <Scoreboard replay={replay} tick={tick} selected={selected} onSelect={onSelect} />
      )}
      {tab === "eco" && (
        <Economy replay={replay} tick={tick} selected={selected} onSelect={onSelect} />
      )}
      {tab === "review" && (
        <Review replay={replay} tick={tick} selected={selected} onJump={onJump} />
      )}
      {tab === "rounds" && (
        <ul className="round-list">
          {replay.rounds.map((r) => (
            <li key={r.start_tick}>
              <button
                type="button"
                className={`round-item${round?.start_tick === r.start_tick ? " on" : ""}`}
                onClick={() => onJump(r.freeze_end_tick || r.start_tick)}
              >
                <span className={`pill ${r.winner === "CT" ? "ct" : r.winner === "T" ? "t" : ""}`}>
                  {r.is_knife ? "Knife" : `R${r.number}`}
                </span>
                <span className="round-meta">
                  {r.winner ?? "—"} · {winReasonLabel(r.win_reason)}
                </span>
                <span className="round-score">
                  {r.score_ct}-{r.score_t}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {tab === "weapons" && (
        <div>
          <p className="muted tab-hint">
            {selected != null
              ? replay.players[selected]?.name
              : "Select a player or view match totals"}
            {selected != null && (
              <>
                {" "}
                <button type="button" className="link" onClick={() => onSelect(null)}>
                  (all)
                </button>
              </>
            )}
          </p>
          <table>
            <thead>
              <tr>
                <th>Weapon</th>
                <th>K</th>
                <th>HS</th>
                <th>DMG</th>
              </tr>
            </thead>
            <tbody>
              {weapons.map((w) => (
                <tr key={w.weapon}>
                  <td className="wep-cell">
                    <WeaponIcon weapon={w.raw} />
                    <span>{w.weapon}</span>
                  </td>
                  <td>{w.kills}</td>
                  <td>{w.kills ? `${Math.round((100 * w.hs) / w.kills)}%` : "—"}</td>
                  <td>{w.damage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "kills" && (
        <ul className="kill-list">
          {roundKills.length === 0 && <li className="muted">No kills this round yet.</li>}
          {roundKills.map((k, i) => (
            <li key={`${k.tick}-${i}`}>
              <button type="button" className="kill-item" onClick={() => onJump(k.tick)}>
                <span className="kill-who">
                  {replay.players[k.attacker]?.name ?? "World"}
                  {k.headshot ? (
                    <img className="hs-icon" src="/weapons/headshot.svg" alt="HS" />
                  ) : null}
                </span>
                <span className="kill-gun">
                  <WeaponIcon weapon={k.weapon} />
                </span>
                <span className="kill-who victim">{replay.players[k.victim]?.name ?? "?"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {selected == null && tab === "score" && (
        <p className="muted tab-hint">Click a player for full stats. Click again on the map to deselect.</p>
      )}
      {tab === "score" && selected != null && (
        <p className="muted tab-hint">
          {stats.find((s) => s.player === selected)?.rating.toFixed(2)} rating through this tick
        </p>
      )}
    </aside>
  );
}
