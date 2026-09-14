import type { PdfPhotos, PdfTheme } from "@/lib/settings/userSettings";
import { PDF_PHOTO_MODES, PDF_THEME_MODES } from "./userSettingsOptions";

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
