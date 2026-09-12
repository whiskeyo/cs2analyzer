import { nadeLabel, useMessages } from "@/lib/i18n";
import { NADE_WEAPON } from "@/lib/match/roundEvents";
import { useApp } from "@/lib/state/appState";
import { isMultiDemoSeries } from "@/lib/parse/seriesMode";
import { WeaponIcon } from "@/components/weapons/WeaponIcon";

/** Series util / action / util-set counts for the active habits bucket. */
export function SeriesBucketPanel() {
  const { messages, t } = useMessages();
  const { session, habits } = useApp();
  if (!isMultiDemoSeries(session.series)) return null;

  const { util, action, utilSets, filter } = habits;
  const bucket = `${filter.side} ${filter.kind}`;

  return (
    <section className="series-bucket">
      <h3 className="series-bucket-head">
        {session.series.focalTeam} · {bucket}
        {util && (
          <span className="muted">
            {t(messages.sidebar.seriesRoundCount, { count: util.roundCount })}
          </span>
        )}
      </h3>

      {utilSets && utilSets.entries.length > 0 && (
        <>
          <p className="tab-hint">{messages.sidebar.firstWaveSets}</p>
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
          <p className="tab-hint">{messages.sidebar.utilFrequency}</p>
          <ul className="series-freq-list">
            {util.entries.slice(0, 10).map((entry) => (
              <li key={`${entry.kind}|${entry.callout}`}>
                <span className="series-set-count">
                  {entry.count}/{util.roundCount}
                </span>
                <span className="series-set-label">
                  <WeaponIcon weapon={NADE_WEAPON[entry.kind]} />
                  {nadeLabel(messages, entry.kind)} {entry.callout}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {action && action.entries.length > 0 && (
        <>
          <p className="tab-hint">{messages.sidebar.actionBeats}</p>
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
        <p className="muted tab-hint">{messages.sidebar.emptyBucket}</p>
      )}
    </section>
  );
}
