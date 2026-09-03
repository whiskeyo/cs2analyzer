import { NADE_COLORS } from "@/lib/radar/radarFx";
import type { SummaryFilter } from "@/lib/notes/types";
import type { GrenadeKind } from "@/lib/replay/replayTypes";

const KINDS: [GrenadeKind, string][] = [
  ["smoke", "Smoke"],
  ["molotov", "Molly"],
  ["incendiary", "Inc"],
  ["flash", "Flash"],
  ["he", "HE"],
  ["decoy", "Decoy"],
];

interface Props {
  filter: SummaryFilter;
  onFilter: (next: SummaryFilter | ((prev: SummaryFilter) => SummaryFilter)) => void;
}

/** Side and kind toggles for the round-summary nade overlay. */
export function NadeLegend({ filter, onFilter }: Props) {
  return (
    <div className="nade-legend">
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
          className={filter.kinds[kind] ? "on" : ""}
          onClick={() => onFilter((f) => ({ ...f, kinds: { ...f.kinds, [kind]: !f.kinds[kind] } }))}
        >
          <i style={{ background: NADE_COLORS[kind] }} />
          {label}
        </button>
      ))}
    </div>
  );
}
