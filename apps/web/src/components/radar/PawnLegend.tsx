import type { LegendEntry } from "@/lib/radar/pawnLegend";

/** Colour → name list. Live Analyzer and Playbook HTML overlay share this markup. */
export function PawnLegend({ entries }: { entries: readonly LegendEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <ul className="playbook-legend" aria-label="Player colours">
      {entries.map((entry) => (
        <li key={entry.label}>
          <span className="playbook-legend-swatch" style={{ background: entry.color }} />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}
