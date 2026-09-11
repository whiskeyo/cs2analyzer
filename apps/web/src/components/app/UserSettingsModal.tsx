import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { ColorPalette } from "@/components/notes/ColorPalette";
import { NadeLegend } from "@/components/radar/NadeLegend";
import { COLOR_PRESETS } from "@/lib/notes/palettes";
import type { FloorMode, MapLayers } from "@/lib/notes/types";
import { parsePoolHardwareCap } from "@/lib/parse/parsePool";
import { MAX_LEAD_IN_SEC, MIN_LEAD_IN_SEC, clampLeadInSec } from "@/lib/match/roundEvents";
import { LOCALES, localeEndonym, parseLocale } from "@/lib/i18n/locales";
import { useMessages } from "@/lib/i18n/useMessages";
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

export function UserSettingsModal({ onClose }: { onClose: () => void }) {
  const { settings, update, reset } = useUserSettings();
  const { messages, t } = useMessages();
  const p = messages.preferences;
  const [confirmReset, setConfirmReset] = useState(false);
  const layerLabels: { key: keyof MapLayers; label: string }[] = [
    { key: "grenades", label: p.layerGrenades },
    { key: "shots", label: p.layerShots },
    { key: "deaths", label: p.layerDeaths },
    { key: "openings", label: p.layerOpenings },
    { key: "names", label: p.layerNames },
    { key: "cone", label: p.layerCone },
    { key: "heatmap", label: p.layerHeatmap },
    { key: "summary", label: p.layerSummary },
  ];
  const floorModes: { id: FloorMode; label: string }[] = [
    { id: "auto", label: p.floorAuto },
    { id: "upper", label: p.floorUpper },
    { id: "lower", label: p.floorLower },
  ];
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

  return createPortal(
    <div
      className="home-modal settings-modal"
      onPointerDown={(e) => {
        // Leftover `click` from unmounting the gear menu must not dismiss.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="home-modal-card settings-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>{p.title}</h2>
        <p className="settings-modal-lead">{p.lead}</p>

        <section className="settings-section">
          <h3>{p.language}</h3>
          <label className="settings-field">
            <span>{p.language}</span>
            <select
              className="settings-locale-select"
              aria-label={p.language}
              value={settings.locale}
              onChange={(e) => void update({ locale: parseLocale(e.target.value) })}
            >
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {localeEndonym(code)}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="settings-section">
          <h3>{p.performance}</h3>
          <label className="settings-field">
            <span>{p.parseWorkers}</span>
            <input
              type="range"
              min={PARSE_POOL_MIN}
              max={poolMax}
              step={1}
              value={Math.min(settings.parsePoolMax, poolMax)}
              aria-label={p.parseWorkers}
              aria-valuetext={`${Math.min(settings.parsePoolMax, poolMax)}`}
              onChange={(e) => void update({ parsePoolMax: Number(e.target.value) })}
            />
            <output>{Math.min(settings.parsePoolMax, poolMax)}</output>
          </label>
          <p className="settings-hint">{p.parseWorkersHint}</p>
          {settings.parsePoolMax > PARSE_POOL_SOFT_WARN ? (
            <p className="settings-warn">
              {t(p.parseWorkersWarn, { count: PARSE_POOL_SOFT_WARN })}
            </p>
          ) : null}
          <label className="settings-field">
            <span>{p.maxDemos}</span>
            <input
              type="number"
              min={SERIES_MIN_FILES}
              max={SERIES_MAX_FILES}
              aria-label={p.maxDemos}
              value={settings.seriesMaxFiles}
              onChange={(e) => void update({ seriesMaxFiles: Number(e.target.value) })}
            />
          </label>
          <p className="settings-hint">{p.maxDemosHint}</p>
        </section>

        <section className="settings-section">
          <h3>{p.layout}</h3>
          <label className="settings-field">
            <span>{p.sidebarWidth}</span>
            <input
              type="range"
              min={SIDEBAR_MIN_WIDTH}
              max={SIDEBAR_MAX_WIDTH}
              step={8}
              aria-label={p.sidebarWidth}
              value={settings.sidebarWidth}
              onChange={(e) => void update({ sidebarWidth: Number(e.target.value) })}
            />
            <output>{settings.sidebarWidth}px</output>
          </label>
          <label className="settings-field">
            <span>{p.savedNotesPageSize}</span>
            <input
              type="number"
              min={SAVED_NOTES_PAGE_SIZE_MIN}
              max={SAVED_NOTES_PAGE_SIZE_MAX}
              aria-label={p.savedNotesPageSize}
              value={settings.savedNotesPageSize}
              onChange={(e) => void update({ savedNotesPageSize: Number(e.target.value) })}
            />
          </label>
        </section>

        <section className="settings-section">
          <h3>{p.drawing}</h3>
          <p className="settings-hint">{p.drawingHint}</p>
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
          <h3>{p.radar}</h3>
          <p className="settings-hint">{p.radarHint}</p>
          <div className="settings-field">
            <span>{p.defaultFloor}</span>
            <span className="floor-picks">
              {floorModes.map((mode) => (
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
            <legend>{p.defaultLayers}</legend>
            {layerLabels.map((row) => (
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
            <p className="settings-field-label">{p.defaultNadeSummary}</p>
            <NadeLegend
              embedded
              ariaLabel={p.defaultNadeSummary}
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
          <h3>{p.playback}</h3>
          <p className="settings-hint">{p.playbackHint}</p>
          <label className="settings-field">
            <span>{p.defaultSpeed}</span>
            <select
              aria-label={p.defaultSpeed}
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
            <span>{p.eventLeadIn}</span>
            <input
              type="number"
              min={MIN_LEAD_IN_SEC}
              max={MAX_LEAD_IN_SEC}
              step={0.5}
              aria-label={p.eventLeadIn}
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
            <span>{p.momentLength}</span>
            <input
              type="number"
              min={NOTE_MOMENT_MIN_SECONDS}
              max={NOTE_MOMENT_MAX_SECONDS}
              step={0.5}
              aria-label={p.momentLength}
              value={settings.noteMomentSec}
              onChange={(e) => void update({ noteMomentSec: Number(e.target.value) })}
            />
            <span>s</span>
          </label>
        </section>

        <div className="home-modal-actions">
          <button type="button" className="ghost" onClick={onClose}>
            {p.close}
          </button>
          <button type="button" className="danger" onClick={() => setConfirmReset(true)}>
            {p.resetAll}
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
            <h2 id={confirmTitleId}>{p.resetTitle}</h2>
            <p>{p.resetBody}</p>
            <div className="home-modal-actions">
              <button type="button" className="ghost" onClick={() => setConfirmReset(false)}>
                {p.cancel}
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  void reset().then(() => setConfirmReset(false));
                }}
              >
                {p.resetConfirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
