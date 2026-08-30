import { NADE_LABEL, NADE_WEAPON } from "@/lib/match/roundEvents";
import { useApp } from "@/lib/state/appState";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";

/** Series util / action / util-set counts for the active habits bucket. */
export function SeriesBucketPanel() {
  const { session, habits } = useApp();
  if (!session.series || session.series.demos.length <= 1) return null;

  const { util, action, utilSets, filter } = habits;
  const bucket = `${filter.side} ${filter.kind}`;

  return (
    <section className="series-bucket">
      <h3 className="series-bucket-head">
        {session.series.focalTeam} · {bucket}
        {util && <span className="muted"> · {util.roundCount} rounds</span>}
      </h3>

      {utilSets && utilSets.entries.length > 0 && (
        <>
          <p className="tab-hint">First-wave util sets (freeze +8s)</p>
          <ul className="series-set-list">
            {utilSets.entries.slice(0, 8).map((entry) => (
              <li key={entry.key}>
                <span className="series-set-count">
                  {entry.count}/{utilSets.roundCount}
                </span>
                <span className="series-set-label">{entry.label}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {util && util.entries.length > 0 && (
        <>
          <p className="tab-hint">Util frequency</p>
          <ul className="series-freq-list">
            {util.entries.slice(0, 10).map((entry) => (
              <li key={`${entry.kind}|${entry.callout}`}>
                <span className="series-set-count">
                  {entry.count}/{util.roundCount}
                </span>
                <span className="series-set-label">
                  <WeaponIcon weapon={NADE_WEAPON[entry.kind]} />
                  {NADE_LABEL[entry.kind]} {entry.callout}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {action && action.entries.length > 0 && (
        <>
          <p className="tab-hint">Action beats</p>
          <ul className="series-freq-list">
            {action.entries.slice(0, 8).map((entry) => (
              <li key={entry.title}>
                <span className="series-set-count">
                  {entry.count}/{action.roundCount}
                </span>
                <span className="series-set-label">{entry.title}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {(!util || util.roundCount === 0) && (
        <p className="muted tab-hint">No rounds in this bucket across the series.</p>
      )}
    </section>
  );
}
