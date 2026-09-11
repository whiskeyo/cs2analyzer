import { nadeLabel } from "@/lib/i18n/labels";
import { useMessages } from "@/lib/i18n/useMessages";
import { NADE_COLORS } from "@/lib/radar/radarFx";
import type { HabitsNadeFilter, HabitsNadeKind } from "@/lib/parse/seriesOverlay";

const KINDS: HabitsNadeKind[] = ["smoke", "molotov", "flash", "he"];

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
  const { messages } = useMessages();
  return (
    <div className="habits-nade-controls">
      <div
        className="nade-legend series-nade-legend"
        role="toolbar"
        aria-label={messages.analyzer.utilKinds}
      >
        <button
          type="button"
          className="habits-nade-all"
          title={nadesOn ? messages.analyzer.hideAllUtil : messages.analyzer.showUtil}
          aria-label={nadesOn ? messages.analyzer.hideAllUtil : messages.analyzer.showUtil}
          onClick={() => onNadesOn(!nadesOn)}
        >
          ✕
        </button>
        {KINDS.map((kind) => (
          <button
            key={kind}
            type="button"
            className={filter[kind] && nadesOn ? "on" : ""}
            disabled={!nadesOn}
            onClick={() => onKind(kind, !filter[kind])}
          >
            <i style={{ background: NADE_COLORS[kind] }} />
            {nadeLabel(messages, kind)}
          </button>
        ))}
      </div>
      <label className="habits-nade-opacity">
        <span>{messages.analyzer.utilOpacity}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(nadeOpacity * 100)}
          disabled={!nadesOn}
          aria-label={messages.analyzer.utilOpacityAria}
          onChange={(e) => onOpacity(Number(e.target.value) / 100)}
        />
      </label>
    </div>
  );
}
