import { NADE_WEAPON } from "@/lib/match/roundEvents";
import { throwDetail } from "@/lib/match/utility";
import type { SeriesUtilThrow } from "@/lib/parse/seriesAnalysis";
import type { HabitsTrail } from "@/lib/parse/seriesOverlay";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";

interface Props {
  rows: SeriesUtilThrow[];
  playerName: string | null;
  onJump: (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => void;
}

/** Cross-demo util throws for the habits bucket (optional single player). */
export function SeriesUtilList({ rows, playerName, onJump }: Props) {
  const who = playerName ?? "Focal team";
  const summary = `${rows.length} thrown across ${new Set(rows.map((r) => r.demoId)).size} demos`;

  return (
    <div className="review">
      <p className="tab-hint">
        <strong>{who}</strong> — {summary}
      </p>
      {rows.length === 0 ? (
        <p className="muted tab-hint">No nades in this bucket for the current filters.</p>
      ) : (
        <ul className="review-notes">
          {rows.map((row, i) => {
            const detail = throwDetail(row);
            const callout = row.location ?? row.site ?? "—";
            const lit =
              row.inSite ||
              row.blinds.some((blind) => blind.enemy) ||
              row.hits.some((hit) => hit.enemy);
            return (
              <li key={`${row.demoId}-${row.tick}-${row.thrower}-${row.kind}-${i}`}>
                <button
                  type="button"
                  className={`review-note ${lit ? "good" : ""}`}
                  onClick={() => onJump({ demoId: row.demoId, jumpTick: row.jumpTick })}
                >
                  <span className="pill review-round">{row.roundLabel}</span>
                  <span className="review-copy">
                    <span className="review-title util-nade-title">
                      <WeaponIcon weapon={NADE_WEAPON[row.kind]} />
                      {row.fileName} · {row.throwerName} · {callout}
                    </span>
                    {detail ? <span className="review-detail">{detail}</span> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
