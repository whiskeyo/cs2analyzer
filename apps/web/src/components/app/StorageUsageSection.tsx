import { useEffect, useId, useState } from "react";
import {
  categoryBarPercents,
  emptyCs2DatabaseUsage,
  formatLocalDatabaseUsageLabel,
  formatMegabytes,
  measureCs2DatabaseUsage,
  readOriginStorageEstimate,
  requestPersistentStorage,
  STORAGE_CATEGORY_IDS,
  STORAGE_CATEGORY_LABELS,
  type Cs2DatabaseUsage,
  type OriginStorageEstimate,
} from "@/lib/storage/usage";

export function UserSettingsStorageSection() {
  const barId = useId();
  const [origin, setOrigin] = useState<OriginStorageEstimate | null>(null);
  const [db, setDb] = useState<Cs2DatabaseUsage | null>(null);
  const [persistBusy, setPersistBusy] = useState(false);
  const [persistNote, setPersistNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([readOriginStorageEstimate(), measureCs2DatabaseUsage()])
      .then(([nextOrigin, nextDb]) => {
        if (cancelled) return;
        setOrigin(nextOrigin);
        setDb(nextDb);
      })
      .catch(() => {
        if (cancelled) return;
        setOrigin({
          usageBytes: null,
          quotaBytes: null,
          persisted: null,
          persistSupported: false,
        });
        setDb(emptyCs2DatabaseUsage());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const usedBytes = origin?.usageBytes ?? db?.totalBytes ?? 0;
  const quotaBytes = origin?.quotaBytes ?? null;
  const usageLabel = formatLocalDatabaseUsageLabel(usedBytes, quotaBytes);
  const categories = db?.categories ?? [];
  const percents = categoryBarPercents(categories);
  const barSummary = categories
    .map((row) => `${row.label} ${formatMegabytes(row.bytes)} MB`)
    .join(", ");

  return (
    <section className="settings-section">
      <h3>Local database</h3>
      <p className="settings-usage-total">{usageLabel}</p>
      <div className="settings-usage-bar" role="img" aria-labelledby={barId}>
        {categories.map((row, index) => {
          const width = percents[index] ?? 0;
          if (width <= 0) return null;
          return (
            <span
              key={row.id}
              className={`settings-usage-seg is-${row.id}`}
              style={{ width: `${width}%` }}
              title={`${row.label}: ${formatMegabytes(row.bytes)} MB`}
            />
          );
        })}
      </div>
      <p id={barId} className="visually-hidden">
        {barSummary || "No saved data yet"}
      </p>
      <ul className="settings-usage-legend">
        {STORAGE_CATEGORY_IDS.map((id) => {
          const row = categories.find((item) => item.id === id);
          const bytes = row?.bytes ?? 0;
          return (
            <li key={id}>
              <span className={`settings-usage-swatch is-${id}`} aria-hidden="true" />
              {STORAGE_CATEGORY_LABELS[id]}: {formatMegabytes(bytes)} MB
            </li>
          );
        })}
      </ul>
      <p className="settings-hint">
        This browser owns the storage cap for this site — pages cannot raise it. Parse workers and
        max demos per drop (above) limit RAM, not this database. Export notes and playbooks from the
        Settings menu, then Remove, to free space.
      </p>
      {origin?.persisted ? (
        <p className="settings-hint">This browser marked this site’s saved data as persistent.</p>
      ) : null}
      {origin?.persistSupported && origin.persisted !== true ? (
        <button
          type="button"
          className="ghost"
          disabled={persistBusy}
          onClick={() => {
            setPersistBusy(true);
            void requestPersistentStorage()
              .then((ok) => {
                if (ok) {
                  setPersistNote(null);
                  setOrigin((prev) => (prev ? { ...prev, persisted: true } : prev));
                  return;
                }
                setPersistNote("The browser declined. Quota is still managed by the browser.");
              })
              .finally(() => setPersistBusy(false));
          }}
        >
          Keep data in this browser
        </button>
      ) : null}
      {persistNote ? <p className="settings-hint">{persistNote}</p> : null}
    </section>
  );
}
