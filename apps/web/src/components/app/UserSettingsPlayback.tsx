import {
  CLIP_EXPORT_SIZE_DEFAULT,
  CLIP_EXPORT_SIZE_HIGH,
  type ClipExportSize,
} from "@/lib/export/constants";
import { MAX_LEAD_IN_SEC, MIN_LEAD_IN_SEC, clampLeadInSec } from "@/lib/match/roundEvents";
import type { UserSettings, UserSettingsPatch } from "@/lib/settings/userSettings";
import {
  NOTE_MOMENT_MAX_SECONDS,
  NOTE_MOMENT_MIN_SECONDS,
  PLAYBACK_SPEEDS,
} from "@/lib/shared/constants";
import { UserSettingsOverallFields } from "./userSettingsPanels";

export function UserSettingsPlayback({
  settings,
  update,
}: {
  settings: UserSettings;
  update: (patch: UserSettingsPatch) => Promise<UserSettings>;
}) {
  return (
    <section className="settings-section">
      <h3>Playback</h3>
      <p className="settings-hint">
        Default speed applies when a demo loads. Lead-in, moment length, habits trail, and Overall
        path knobs apply immediately.
      </p>
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
        <span>Clip resolution</span>
        <select
          aria-label="Clip resolution"
          value={settings.clipExportSize}
          onChange={(e) => {
            const size: ClipExportSize =
              Number(e.target.value) === CLIP_EXPORT_SIZE_HIGH
                ? CLIP_EXPORT_SIZE_HIGH
                : CLIP_EXPORT_SIZE_DEFAULT;
            void update({ clipExportSize: size });
          }}
        >
          <option value={CLIP_EXPORT_SIZE_DEFAULT}>1080×1080</option>
          <option value={CLIP_EXPORT_SIZE_HIGH}>1440×1440</option>
        </select>
      </label>
      <p className="settings-hint">Square radar clips at 30 fps. Applies to the next export.</p>
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
      <UserSettingsOverallFields
        trailWindowSec={settings.habitsTrailWindowSec}
        mergeDistance={settings.pathBranchMergeDistance}
        stepDistance={settings.pathBranchStepDistance}
        minShare={settings.pathBranchMinShare}
        onChange={(patch) => void update(patch)}
      />
      <label className="settings-check">
        <input
          type="checkbox"
          checked={settings.skipKnifeOnOpen}
          aria-label="Skip knife round when a demo loads"
          onChange={() => void update({ skipKnifeOnOpen: !settings.skipKnifeOnOpen })}
        />
        Skip knife round when a demo loads
      </label>
    </section>
  );
}
