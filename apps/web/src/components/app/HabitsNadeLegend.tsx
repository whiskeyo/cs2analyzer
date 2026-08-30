import { NADE_COLORS } from "@/lib/radar/radarFx";
import type { HabitsNadeFilter, HabitsNadeKind } from "@/lib/parse/seriesOverlay";

const KINDS: [HabitsNadeKind, string][] = [
  ["smoke", "Smoke"],
  ["molotov", "Molly"],
  ["flash", "Flash"],
  ["he", "HE"],
];

interface Props {
  filter: HabitsNadeFilter;
  onKind: (kind: HabitsNadeKind, on: boolean) => void;
}

/** Util kind toggles for the aggregated habits overlay. */
export function HabitsNadeLegend({ filter, onKind }: Props) {
  return (
    <div className="nade-legend series-nade-legend" role="toolbar" aria-label="Habits util kinds">
      {KINDS.map(([kind, label]) => (
        <button
          key={kind}
          type="button"
          className={filter[kind] ? "on" : ""}
          onClick={() => onKind(kind, !filter[kind])}
        >
          <i style={{ background: NADE_COLORS[kind] }} />
          {label}
        </button>
      ))}
    </div>
  );
}
