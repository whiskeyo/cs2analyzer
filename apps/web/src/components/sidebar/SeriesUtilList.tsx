import { useMessages } from "@/lib/i18n";
import { NADE_WEAPON } from "@/lib/match/roundEvents";
import { utilRowTone } from "@/lib/match/utility";
import type { SeriesUtilThrow } from "@/lib/parse/seriesAnalysis";
import type { HabitsTrail } from "@/lib/parse/seriesOverlay";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";
import { UtilThrowDetail } from "./UtilThrowDetail";

interface Props {
  rows: SeriesUtilThrow[];
  playerName: string | null;
  onJump: (target: Pick<HabitsTrail, "demoId" | "jumpTick">) => void;
  onClearFollow?: () => void;
}

/** Cross-demo util throws for the habits bucket (optional single player). */
export function SeriesUtilList({ rows, playerName, onJump, onClearFollow }: Props) {
  const { messages, t, tNodes } = useMessages();
  const name = playerName ?? messages.sidebar.seriesFocalTeam;
  const summary = t(messages.sidebar.seriesUtilThrown, {
    count: rows.length,
    demos: new Set(rows.map((r) => r.demoId)).size,
  });

  return (
    <div className="review">
      <p className="tab-hint">
        {tNodes(messages.sidebar.seriesUtilHeader, { who: <strong>{name}</strong>, summary })}
      </p>
      {rows.length === 0 ? (
        <p className="muted tab-hint">{messages.sidebar.seriesUtilEmpty}</p>
      ) : (
        <ul className="review-notes">
          {rows.map((row, i) => {
            const callout = row.location ?? row.site ?? "—";
            const tone = utilRowTone(row);
            return (
              <li key={`${row.demoId}-${row.tick}-${row.thrower}-${row.kind}-${i}`}>
                <button
                  type="button"
                  className={`review-note${tone ? ` ${tone}` : ""}`}
                  onClick={() => {
                    onClearFollow?.();
                    onJump({ demoId: row.demoId, jumpTick: row.jumpTick });
                  }}
                >
                  <span className="pill review-round">{row.roundLabel}</span>
                  <span className="review-copy">
                    <span className="review-title util-nade-title">
                      <WeaponIcon weapon={NADE_WEAPON[row.kind]} />
                      {row.fileName} · {row.throwerName} · {callout}
                    </span>
                    <UtilThrowDetail row={row} />
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
