import { utilityThrough } from "./utility";
import type { Replay } from "./types";

interface Props {
  replay: Replay;
  tick: number;
  selected: number | null;
  onJump: (tick: number) => void;
  onSelect: (index: number) => void;
}

export function Utility({ replay, tick, selected, onJump, onSelect }: Props) {
  const u = utilityThrough(replay, tick, selected);
  const who = selected != null ? (replay.players[selected]?.name ?? "Player") : "Match";

  return (
    <div className="review">
      <p className="tab-hint">
        <strong>{who}</strong> — blinds that landed, HE damage, smokes in site.
      </p>
      <h3 className="util-head">
        Flashes that blinded{" "}
        <span className="muted">
          {u.enemyFlashCount} enemy · {u.flashes.length} total
        </span>
      </h3>
      {u.flashes.length === 0 ? (
        <p className="muted tab-hint">No full blinds through this tick.</p>
      ) : (
        <ul className="review-notes">
          {u.flashes.map((f, i) => (
            <li key={`${f.tick}-${f.victim}-${i}`}>
              <button
                type="button"
                className={`review-note ${f.enemy ? "good" : ""}`}
                onClick={() => {
                  if (f.attacker >= 0) onSelect(f.attacker);
                  onJump(f.tick);
                }}
              >
                <span className="pill review-round">{f.roundLabel}</span>
                <span className="review-copy">
                  <span className="review-title">
                    {f.attackerName} blinded {f.victimName} {f.duration.toFixed(1)}s
                  </span>
                  <span className="review-detail">{f.enemy ? "enemy" : "team"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3 className="util-head">
        HE damage <span className="muted">{u.heDamage} total</span>
      </h3>
      {u.he.length === 0 ? (
        <p className="muted tab-hint">No enemy HE damage through this tick.</p>
      ) : (
        <ul className="review-notes">
          {u.he.map((h, i) => (
            <li key={`${h.tick}-${h.victim}-${i}`}>
              <button
                type="button"
                className="review-note"
                onClick={() => {
                  if (h.attacker >= 0) onSelect(h.attacker);
                  onJump(h.tick);
                }}
              >
                <span className="pill review-round">{h.roundLabel}</span>
                <span className="review-copy">
                  <span className="review-title">
                    {h.attackerName} → {h.victimName} {h.damage}
                  </span>
                  <span className="review-detail">HE</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h3 className="util-head">
        Smokes{" "}
        <span className="muted">
          {u.smokesInSite}/{u.smokesThrown} in site · A {u.smokesA} · B {u.smokesB}
        </span>
      </h3>
      {u.smokes.length === 0 ? (
        <p className="muted tab-hint">No smokes thrown through this tick.</p>
      ) : (
        <ul className="review-notes">
          {u.smokes.map((s, i) => (
            <li key={`${s.tick}-${s.thrower}-${i}`}>
              <button
                type="button"
                className={`review-note ${s.inSite ? "good" : ""}`}
                onClick={() => {
                  onSelect(s.thrower);
                  onJump(s.tick);
                }}
              >
                <span className="pill review-round">{s.roundLabel}</span>
                <span className="review-copy">
                  <span className="review-title">
                    {s.throwerName} · {s.site ?? "—"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
