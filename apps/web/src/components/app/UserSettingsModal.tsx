import { useEffect, useId, useState } from "react";
import { ColorPalette } from "@/components/notes/ColorPalette";
import { NadeLegend } from "@/components/radar/NadeLegend";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import type { FloorMode, MapLayers } from "@/lib/notes/types";
import { parsePoolHardwareCap } from "@/lib/parse/parsePool";
import { MAX_LEAD_IN_SEC, MIN_LEAD_IN_SEC, clampLeadInSec } from "@/lib/match/roundEvents";
import { useUserSettings } from "@/lib/settings/useUserSettings";
import {
  NOTE_MOMENT_MAX_SECONDS,
  NOTE_MOMENT_MIN_SECONDS,
  PARSE_POOL_MIN,
  PARSE_POOL_SOFT_WARN,
  PLAYBACK_SPEEDS,
  SAVED_NOTES_PAGE_SIZE_MAX,
  SAVED_NOTES_PAGE_SIZE_MIN,
  SERIES_MAX_FILES,
  SERIES_MIN_FILES,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
} from "@/lib/shared/constants";

const LAYER_LABELS: { key: keyof MapLayers; label: string }[] = [
  { key: "grenades", label: "Nades" },
  { key: "shots", label: "Shots" },
  { key: "deaths", label: "Deaths" },
  { key: "openings", label: "FK" },
  { key: "names", label: "Names" },
  { key: "cone", label: "Cone" },
  { key: "heatmap", label: "Heat" },
  { key: "summary", label: "Summary" },
];

const FLOOR_MODES: { id: FloorMode; label: string }[] = [
  { id: "auto", label: "Auto" },
  { id: "upper", label: "Upper" },
  { id: "lower", label: "Lower" },
];

export function UserSettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, update, reset } = useUserSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  const titleId = useId();
  const confirmTitleId = useId();
  const poolMax = parsePoolHardwareCap();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") {
        return;
      }
      if (confirmReset) {
        setConfirmReset(false);
        return;
      }
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmReset, onClose]);

  return (
    <div className="home-modal settings-modal" onClick={onClose}>
      <div
        className="home-modal-card settings-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>Preferences</h2>
        <p className="settings-modal-lead">
          Stored in this browser. Reset restores shipped defaults and does not delete notes or
          playbooks.
        </p>

        <section className="settings-section">
          <h3>Performance</h3>
          <label className="settings-field">
            <span>Parse workers</span>
            <input
              type="range"
              min={PARSE_POOL_MIN}
              max={poolMax}
              step={1}
              value={Math.min(settings.parsePoolMax, poolMax)}
              aria-label="Parse workers"
              aria-valuetext={`${Math.min(settings.parsePoolMax, poolMax)}`}
              onChange={(e) => void update({ parsePoolMax: Number(e.target.value) })}
            />
            <output>{Math.min(settings.parsePoolMax, poolMax)}</output>
          </label>
          <p className="settings-hint">
            Each worker loads a full demo parser in memory. Higher = faster multi-drop, lower =
            safer on laptops. Applies on the next multi-file drop.
          </p>
          {settings.parsePoolMax > PARSE_POOL_SOFT_WARN ? (
            <p className="settings-warn">
              More than {PARSE_POOL_SOFT_WARN} workers can use a lot of RAM on laptops.
            </p>
          ) : null}
          <label className="settings-field">
            <span>Max demos per drop</span>
            <input
              type="number"
              min={SERIES_MIN_FILES}
              max={SERIES_MAX_FILES}
              aria-label="Max demos per drop"
              value={settings.seriesMaxFiles}
              onChange={(e) => void update({ seriesMaxFiles: Number(e.target.value) })}
            />
          </label>
        </section>

        <section className="settings-section">
          <h3>Layout</h3>
          <label className="settings-field">
            <span>Sidebar width</span>
            <input
              type="range"
              min={SIDEBAR_MIN_WIDTH}
              max={SIDEBAR_MAX_WIDTH}
              step={8}
              aria-label="Sidebar width"
              value={settings.sidebarWidth}
              onChange={(e) => void update({ sidebarWidth: Number(e.target.value) })}
            />
            <output>{settings.sidebarWidth}px</output>
          </label>
          <label className="settings-field">
            <span>Saved notes page size</span>
            <input
              type="number"
              min={SAVED_NOTES_PAGE_SIZE_MIN}
              max={SAVED_NOTES_PAGE_SIZE_MAX}
              aria-label="Saved notes page size"
              value={settings.savedNotesPageSize}
              onChange={(e) => void update({ savedNotesPageSize: Number(e.target.value) })}
            />
          </label>
        </section>

        <section className="settings-section">
          <h3>Drawing</h3>
          <p className="settings-hint">
            Defaults for new demos. Open notes keep their own palette.
          </p>
          <div className="settings-drawing">
            <ColorPalette
              paletteId={settings.defaultPaletteId}
              color={settings.defaultColor}
              onPalette={(id) => {
                const preset = COLOR_PRESETS.find((row) => row.id === id);
                const nextColor =
                  preset && !(preset.colors as readonly string[]).includes(settings.defaultColor)
                    ? preset.colors[0]
                    : settings.defaultColor;
                void update({ defaultPaletteId: id, defaultColor: nextColor });
              }}
              onColor={(color) => void update({ defaultColor: color })}
            />
          </div>
        </section>

        <section className="settings-section">
          <h3>Radar</h3>
          <p className="settings-hint">Applied when a demo loads. Toolbar toggles stay per-demo.</p>
          <div className="settings-field">
            <span>Default floor</span>
            <span className="floor-picks">
              {FLOOR_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={settings.defaultFloorMode === mode.id ? "on" : ""}
                  onClick={() => void update({ defaultFloorMode: mode.id })}
                >
                  {mode.label}
                </button>
              ))}
            </span>
          </div>
          <fieldset className="settings-layers">
            <legend>Default layers</legend>
            {LAYER_LABELS.map((row) => (
              <label key={row.key}>
                <input
                  type="checkbox"
                  checked={settings.defaultLayers[row.key]}
                  onChange={() =>
                    void update({
                      defaultLayers: {
                        ...settings.defaultLayers,
                        [row.key]: !settings.defaultLayers[row.key],
                      },
                    })
                  }
                />
                {row.label}
              </label>
            ))}
          </fieldset>
          <div className="settings-summary">
            <p className="settings-field-label">Default nade summary</p>
            <NadeLegend
              filter={settings.defaultSummaryFilter}
              onFilter={(next) => {
                const value =
                  typeof next === "function" ? next(settings.defaultSummaryFilter) : next;
                void update({ defaultSummaryFilter: value });
              }}
            />
          </div>
        </section>

        <section className="settings-section">
          <h3>Playback</h3>
          <label className="settings-field">
            <span>Default speed</span>
            <select
              aria-label="Default speed"
              value={settings.defaultPlaybackSpeed}
              onChange={(e) => void update({ defaultPlaybackSpeed: Number(e.target.value) })}
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}×
                </option>
              ))}
            </select>
          </label>
          <label className="settings-field">
            <span>Event lead-in</span>
            <input
              type="number"
              min={MIN_LEAD_IN_SEC}
              max={MAX_LEAD_IN_SEC}
              step={0.5}
              aria-label="Event lead-in"
              value={settings.eventLeadInSec}
              onChange={(e) =>
                void update({
                  eventLeadInSec: clampLeadInSec(Number(e.target.value)),
                })
              }
            />
            <span>s</span>
          </label>
          <label className="settings-field">
            <span>Moment length</span>
            <input
              type="number"
              min={NOTE_MOMENT_MIN_SECONDS}
              max={NOTE_MOMENT_MAX_SECONDS}
              step={0.5}
              aria-label="Moment length"
              value={settings.noteMomentSec}
              onChange={(e) => void update({ noteMomentSec: Number(e.target.value) })}
            />
            <span>s</span>
          </label>
        </section>

        <div className="home-modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            Close
          </button>
          <button type="button" className="danger" onClick={() => setConfirmReset(true)}>
            Reset all settings
          </button>
        </div>
      </div>

      {confirmReset ? (
        <div
          className="home-modal settings-reset-confirm"
          onClick={(e) => {
            e.stopPropagation();
            setConfirmReset(false);
          }}
        >
          <div
            className="home-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={confirmTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={confirmTitleId}>Reset all settings?</h2>
            <p>
              This restores shipped defaults. Saved notes, linked demos, and playbooks are not
              deleted.
            </p>
            <div className="home-modal-actions">
              <button type="button" className="ghost" onClick={() => setConfirmReset(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  void reset().then(() => setConfirmReset(false));
                }}
              >
                Reset all
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
