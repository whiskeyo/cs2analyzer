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
  nadesOn: boolean;
  nadeOpacity: number;
  onKind: (kind: HabitsNadeKind, on: boolean) => void;
  onNadesOn: (on: boolean) => void;
  onOpacity: (opacity: number) => void;
}

/** Util kind toggles, master off, and opacity for the aggregated habits overlay. */
export function HabitsNadeLegend({
  filter,
  nadesOn,
  nadeOpacity,
  onKind,
  onNadesOn,
  onOpacity,
}: Props) {
  return (
    <div className="habits-nade-controls">
      <div className="nade-legend series-nade-legend" role="toolbar" aria-label="Habits util kinds">
        <button
          type="button"
          className="habits-nade-all"
          title={nadesOn ? "Hide all util" : "Show util"}
          aria-label={nadesOn ? "Hide all util" : "Show util"}
          onClick={() => onNadesOn(!nadesOn)}
        >
          ✕
        </button>
        {KINDS.map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            className={filter[kind] && nadesOn ? "on" : ""}
            disabled={!nadesOn}
            onClick={() => onKind(kind, !filter[kind])}
          >
            <i style={{ background: NADE_COLORS[kind] }} />
            {label}
          </button>
        ))}
      </div>
      <label className="habits-nade-opacity">
        <span>Util α</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(nadeOpacity * 100)}
          disabled={!nadesOn}
          aria-label="Util opacity"
          onChange={(e) => onOpacity(Number(e.target.value) / 100)}
        />
      </label>
    </div>
  );
}
