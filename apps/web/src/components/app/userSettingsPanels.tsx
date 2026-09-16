import type { PdfPhotos, PdfTheme } from "@/lib/settings/userSettings";
import {
  PATH_BRANCH_MERGE_MAX,
  PATH_BRANCH_MERGE_MIN,
  PATH_BRANCH_MIN_SHARE_MAX,
  PATH_BRANCH_MIN_SHARE_MIN,
  PATH_BRANCH_PERCENT_SCALE,
  PATH_BRANCH_STEP_GAP,
  PATH_BRANCH_STEP_MAX,
  PATH_BRANCH_STEP_MIN,
  SERIES_HABITS_WINDOW_MAX_SECONDS,
  SERIES_HABITS_WINDOW_MIN_SECONDS,
} from "@/lib/shared/constants";
import { PDF_PHOTO_MODES, PDF_THEME_MODES } from "./userSettingsOptions";

export function UserSettingsOverallFields({
  trailWindowSec,
  mergeDistance,
  stepDistance,
  minShare,
  onChange,
}: {
  trailWindowSec: number;
  mergeDistance: number;
  stepDistance: number;
  minShare: number;
  onChange: (patch: {
    habitsTrailWindowSec?: number;
    pathBranchMergeDistance?: number;
    pathBranchStepDistance?: number;
    pathBranchMinShare?: number;
  }) => void;
}) {
  const sharePercent = Math.round(minShare * PATH_BRANCH_PERCENT_SCALE);
  const stepMax = Math.min(
    PATH_BRANCH_STEP_MAX,
    Math.max(PATH_BRANCH_STEP_MIN, mergeDistance - PATH_BRANCH_STEP_GAP),
  );
  return (
    <>
      <label className="settings-field">
        <span>Habits trail</span>
        <input
          type="range"
          min={SERIES_HABITS_WINDOW_MIN_SECONDS}
          max={SERIES_HABITS_WINDOW_MAX_SECONDS}
          step={1}
          aria-label="Habits trail"
          aria-valuetext={`${trailWindowSec} seconds`}
          value={trailWindowSec}
          onChange={(e) => onChange({ habitsTrailWindowSec: Number(e.target.value) })}
        />
        <output>{trailWindowSec}s</output>
      </label>
      <p className="settings-hint">
        Seconds after freeze on the aggregated habits overlay. Applies immediately.
      </p>
      <p className="settings-field-label">Aggregated Overall</p>
      <label className="settings-field">
        <span title="How close samples stay one trunk">Merge</span>
        <input
          type="number"
          min={PATH_BRANCH_MERGE_MIN}
          max={PATH_BRANCH_MERGE_MAX}
          step={16}
          aria-label="Overall merge"
          title="How close samples stay one trunk (world units)"
          value={mergeDistance}
          onChange={(e) => onChange({ pathBranchMergeDistance: Number(e.target.value) })}
        />
        <span>u</span>
      </label>
      <p className="settings-hint">How close samples stay one trunk (world units).</p>
      <label className="settings-field">
        <span title="Resample distance along each run">Step</span>
        <input
          type="number"
          min={PATH_BRANCH_STEP_MIN}
          max={stepMax}
          step={16}
          aria-label="Overall step"
          title="Resample along each run. Kept below merge so forks can still split."
          value={stepDistance}
          onChange={(e) => onChange({ pathBranchStepDistance: Number(e.target.value) })}
        />
        <span>u</span>
      </label>
      <p className="settings-hint">
        Resample along each run. Step stays below merge so overlapping samples can still split.
      </p>
      <label className="settings-field">
        <span title="Hide rare forks">Min share</span>
        <input
          type="range"
          min={PATH_BRANCH_MIN_SHARE_MIN * PATH_BRANCH_PERCENT_SCALE}
          max={PATH_BRANCH_MIN_SHARE_MAX * PATH_BRANCH_PERCENT_SCALE}
          step={1}
          aria-label="Overall min share"
          aria-valuetext={`${sharePercent} percent`}
          title="Hide forks rarer than this percent of scoped runs"
          value={sharePercent}
          onChange={(e) =>
            onChange({ pathBranchMinShare: Number(e.target.value) / PATH_BRANCH_PERCENT_SCALE })
          }
        />
        <output>{sharePercent}%</output>
      </label>
      <p className="settings-hint">Hide rare Overall forks (percent of scoped runs).</p>
    </>
  );
}

export function UserSettingsPdfSection({
  pdfTheme,
  pdfPhotos,
  onTheme,
  onPhotos,
}: {
  pdfTheme: PdfTheme;
  pdfPhotos: PdfPhotos;
  onTheme: (theme: PdfTheme) => void;
  onPhotos: (photos: PdfPhotos) => void;
}) {
  return (
    <section className="settings-section">
      <h3>Playbook PDF</h3>
      <p className="settings-hint">
        Dark matches the app. Light is paper-friendly. Radar stills sit on the page color — no extra
        panel behind the map. Without photos skips embedded lineup pictures; pins stay.
      </p>
      <div className="settings-field">
        <span>Page theme</span>
        <span className="floor-picks">
          {PDF_THEME_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={pdfTheme === mode.id ? "on" : ""}
              aria-pressed={pdfTheme === mode.id}
              aria-label={`${mode.label} PDF`}
              onClick={() => onTheme(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </span>
      </div>
      <div className="settings-field">
        <span>Photos</span>
        <span className="floor-picks">
          {PDF_PHOTO_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className={pdfPhotos === mode.id ? "on" : ""}
              aria-pressed={pdfPhotos === mode.id}
              aria-label={mode.label}
              onClick={() => onPhotos(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </span>
      </div>
    </section>
  );
}

export function UserSettingsResetDialog({
  titleId,
  onCancel,
  onConfirm,
}: {
  titleId: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="home-modal settings-reset-confirm"
      onClick={(e) => {
        e.stopPropagation();
        onCancel();
      }}
    >
      <div
        className="home-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId}>Reset all settings?</h2>
        <p>
          This restores shipped defaults. Saved notes, linked demos, and playbooks are not deleted.
        </p>
        <div className="home-modal-actions">
          <button type="button" className="ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            Reset all
          </button>
        </div>
      </div>
    </div>
  );
}
