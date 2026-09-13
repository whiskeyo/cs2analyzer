import type { UserSettings } from "@/lib/settings/userSettings";

function radarGrayValueText(amount: number, paper: boolean): string {
  if (paper) {
    return "Paper";
  }
  if (amount <= 0) {
    return "Color";
  }
  if (amount >= 1) {
    return "Gray";
  }
  return `${Math.round(amount * 100)}% gray`;
}

/** Color–Gray slider plus a Paper pick. Same Preferences island as the old slider. */
export function UserSettingsRadarMap({
  radarGray,
  radarPaper,
  onChange,
}: {
  radarGray: number;
  radarPaper: boolean;
  onChange: (patch: Partial<Pick<UserSettings, "radarGray" | "radarPaper">>) => void;
}) {
  return (
    <>
      <div className="settings-field">
        <span>Map</span>
        <span className="settings-range-end">Color</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(radarGray * 100)}
          aria-label="Radar map color"
          aria-valuetext={radarGrayValueText(radarGray, radarPaper)}
          disabled={radarPaper}
          onChange={(e) => onChange({ radarGray: Number(e.target.value) / 100, radarPaper: false })}
        />
        <span className="settings-range-end">Gray</span>
        <span className="floor-picks">
          <button
            type="button"
            className={radarPaper ? "on" : ""}
            aria-pressed={radarPaper}
            aria-label="Paper map"
            onClick={() => onChange({ radarPaper: !radarPaper })}
          >
            Paper
          </button>
        </span>
      </div>
      <p className="settings-hint">
        Color–Gray desaturates the map PNG. Paper inverts it to a light layout and draws a wall
        outline so interiors stay readable on a light PDF. Tokens, nades, and ink stay in color.
        Analyzer, Playbook, and PDF stills share this.
      </p>
    </>
  );
}
