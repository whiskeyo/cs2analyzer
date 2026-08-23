import { useState } from "react";
import { Action } from "./Action";
import { Review } from "./Review";
import { currentRound } from "./sample";
import { Scoreboard } from "./Scoreboard";
import { computeStats, weaponBreakdown } from "./stats";
import type { Replay } from "./types";
import { WeaponIcon } from "./WeaponIcon";
import { winReasonLabel } from "./weapons";

type Tab = "score" | "player" | "action" | "rounds" | "weapons";

const TAB_LABEL: Record<Tab, string> = {
  score: "Score",
  player: "Review",
  action: "Action",
  rounds: "Rounds",
  weapons: "Weapons",
};

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

  return (
    <aside className="sidebar">
      <div className="tabs">
        {(["score", "player", "action", "rounds", "weapons"] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "on" : ""}
            onClick={() => setTab(id)}
          >
            {TAB_LABEL[id]}
          </button>
        ))}
      </div>
      {tab === "score" && (
        <Scoreboard replay={replay} tick={tick} selected={selected} onSelect={onSelect} />
      )}
      {tab === "player" && (
        <Review replay={replay} tick={tick} selected={selected} onJump={onJump} />
      )}
      {tab === "action" && <Action replay={replay} tick={tick} onJump={onJump} />}
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
      {selected == null && tab === "score" && (
        <p className="muted tab-hint">
          Click a player for full stats. Click again on the map to deselect.
        </p>
      )}
      {tab === "score" && selected != null && (
        <p className="muted tab-hint">
          {stats.find((s) => s.player === selected)?.rating.toFixed(2)} rating through this tick
        </p>
      )}
    </aside>
  );
}
