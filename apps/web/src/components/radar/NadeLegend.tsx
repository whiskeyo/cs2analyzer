import { NADE_COLORS } from "@/lib/radar/radarFx";
import type { SummaryFilter } from "@/lib/notes/types";
import { type GrenadeKind } from "@/lib/replay/replayTypes";

const KINDS: [GrenadeKind, string][] = [
  ["smoke", "Smoke"],
  ["molotov", "Molly"],
  ["flash", "Flash"],
  ["he", "HE"],
  ["decoy", "Decoy"],
];

function kindOn(filter: SummaryFilter, kind: GrenadeKind): boolean {
  return filter.kinds[kind];
}

function toggleKind(filter: SummaryFilter, kind: GrenadeKind): SummaryFilter {
  const on = !filter.kinds[kind];
  if (kind === "molotov") {
    return { ...filter, kinds: { ...filter.kinds, molotov: on, incendiary: on } };
  }
  return { ...filter, kinds: { ...filter.kinds, [kind]: on } };
}

interface Props {
  filter: SummaryFilter;
  onFilter: (next: SummaryFilter | ((prev: SummaryFilter) => SummaryFilter)) => void;
  /** In-form chips; skip the radar HUD `position: absolute` pin. */
  embedded?: boolean;
  /** Toolbar name when `embedded`. Defaults to the English Preferences label. */
  ariaLabel?: string;
}

/** Side and kind toggles for the round-summary nade overlay. */
export function NadeLegend({ filter, onFilter, embedded = false, ariaLabel }: Props) {
  return (
    <div
      className={embedded ? "nade-legend nade-legend-embedded" : "nade-legend"}
      role={embedded ? "toolbar" : undefined}
      aria-label={embedded ? (ariaLabel ?? "Default nade summary") : undefined}
    >
      <button
        type="button"
        className={filter.t ? "on" : ""}
        onClick={() => onFilter((f) => ({ ...f, t: !f.t }))}
      >
        T
      </button>
      <button
        type="button"
        className={filter.ct ? "on" : ""}
        onClick={() => onFilter((f) => ({ ...f, ct: !f.ct }))}
      >
        CT
      </button>
      {KINDS.map(([kind, label]) => (
        <button
          key={kind}
          type="button"
          className={kindOn(filter, kind) ? "on" : ""}
          onClick={() => onFilter((f) => toggleKind(f, kind))}
        >
          <i style={{ background: NADE_COLORS[kind] }} />
          {label}
        </button>
      ))}
    </div>
  );
}
