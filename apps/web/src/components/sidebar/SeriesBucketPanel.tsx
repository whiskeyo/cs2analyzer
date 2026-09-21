import { NADE_LABEL, NADE_WEAPON } from "@/lib/match/roundEvents";
import { formatGroupHitPercent, type SeriesGroupHits } from "@/lib/parse/seriesGroupHits";
import { useApp } from "@/lib/state/appState";
import { isMultiDemoSeries } from "@/lib/parse/seriesMode";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";

/** Series util / action / util-set counts for the active habits bucket. */
export function SeriesBucketPanel() {
  const { session, habits } = useApp();
  if (!isMultiDemoSeries(session.series)) return null;

  const { util, action, utilSets, filter } = habits;
  const bucket = `${filter.side} ${filter.kind}`;

  return (
    <section className="series-bucket">
      <h3 className="series-bucket-head">
        {session.series.focalTeam} · {bucket}
        {util && <span className="muted"> · {util.roundCount} rounds</span>}
      </h3>

      <GroupHits hits={habits.groupHits} />

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

/** Share of bucket rounds where this side entered each layout filter group. */
function GroupHits({ hits }: { hits: SeriesGroupHits | null | undefined }) {
  if (!hits || hits.roundCount === 0 || hits.entries.length === 0) return null;
  return (
    <>
      <p className="tab-hint">Share of rounds this side entered each layout group</p>
      <ul className="series-group-list" aria-label="Layout group hits">
        {hits.entries.map((entry) => (
          <li key={entry.id} className="series-group-row">
            <span className="series-group-label" title={entry.label}>
              {entry.label}
            </span>
            <span className="series-group-track" aria-hidden="true">
              <span className="series-group-fill" style={{ width: `${entry.share * 100}%` }} />
            </span>
            <span className="series-group-count">
              {formatGroupHitPercent(entry.count, hits.roundCount)}
              <span className="muted">
                {entry.count}/{hits.roundCount}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
