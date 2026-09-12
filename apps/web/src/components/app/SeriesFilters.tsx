import { roundKindLabel, useMessages } from "@/lib/i18n";
import { useApp } from "@/lib/state/appState";
import { seriesTeamCandidates } from "@/lib/parse/session";
import { isBucketOverlayActive, isMultiDemoSeries } from "@/lib/parse/seriesMode";
import type { RoundKind } from "@/lib/parse/roundTags";
import { filterHabitsNades } from "@/lib/parse/seriesOverlay";
import { HabitsNadeLegend } from "./HabitsNadeLegend";

/** Team, side, buy, and optional player filters for the habits overlay. */
export function SeriesFilters() {
  const { messages, t } = useMessages();
  const kinds: RoundKind[] = ["pistol", "eco", "force", "full"];
  const { session, habits } = useApp();
  const series = session.series;
  if (!isMultiDemoSeries(series)) return null;

  const teams = seriesTeamCandidates(series.demos);
  const { filter, overlayOn, focalPlayers, playerKey, aggregated } = habits;
  const overlayActive = isBucketOverlayActive(series, habits);
  const visibleNades =
    habits.overlay == null ? 0 : filterHabitsNades(habits.overlay.nades, habits.nadeFilter).length;

  return (
    <div className="series-filters">
      <span className="series-filters-label">{messages.analyzer.team}</span>
      <select
        className="series-team-select"
        aria-label={messages.analyzer.focalTeam}
        value={series.focalTeam}
        onChange={(e) => session.setFocalTeam(e.target.value)}
      >
        {teams.map((team) => (
          <option key={team.name} value={team.name}>
            {team.name} ({team.demoCount}/{series.demos.length})
          </option>
        ))}
      </select>
      <span className="series-filters-label">{messages.analyzer.side}</span>
      <div className="filters" role="toolbar" aria-label={messages.analyzer.habitsSide}>
        {(["CT", "T"] as const).map((side) => (
          <button
            key={side}
            type="button"
            className={`filter${filter.side === side ? " on" : ""}`}
            onClick={() => habits.setSide(side)}
          >
            {side}
          </button>
        ))}
      </div>
      <span className="series-filters-label">{messages.analyzer.buy}</span>
      <div className="filters" role="toolbar" aria-label={messages.analyzer.habitsBuy}>
        {kinds.map((id) => (
          <button
            key={id}
            type="button"
            className={`filter${filter.kind === id ? " on" : ""}`}
            onClick={() => habits.setKind(id)}
          >
            {roundKindLabel(messages, id)}
          </button>
        ))}
      </div>
      {focalPlayers.length > 0 && (
        <>
          <span className="series-filters-label">{messages.analyzer.player}</span>
          <select
            className="series-player-select"
            aria-label={messages.analyzer.filterPlayer}
            value={playerKey ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              habits.setPlayerKey(v || null);
            }}
          >
            <option value="">{messages.analyzer.allPlayers}</option>
            {focalPlayers.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </>
      )}
      {aggregated && (
        <>
          <label className="series-overlay-toggle">
            <input
              type="checkbox"
              checked={overlayOn}
              onChange={(e) => habits.setOverlayOn(e.target.checked)}
            />
            {messages.analyzer.overlay}
          </label>
          {overlayActive && (
            <>
              <label className="series-overlay-toggle">
                <input
                  type="checkbox"
                  checked={habits.overlayArrows}
                  onChange={(e) => habits.setOverlayArrows(e.target.checked)}
                />
                {messages.analyzer.arrows}
              </label>
              <label className="series-overlay-toggle">
                <input
                  type="checkbox"
                  checked={habits.overlayTrails}
                  onChange={(e) => habits.setOverlayTrails(e.target.checked)}
                />
                {messages.analyzer.trails}
              </label>
              <div className="filters" role="toolbar" aria-label={messages.analyzer.pathDisplay}>
                {(
                  [
                    { id: "trails", label: messages.analyzer.paths },
                    { id: "heatmap", label: messages.analyzer.heatmap },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    className={`filter${habits.overlayDisplay === mode.id ? " on" : ""}`}
                    onClick={() => habits.setOverlayDisplay(mode.id)}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </>
          )}
          {overlayActive && (
            <HabitsNadeLegend
              filter={habits.nadeFilter}
              nadesOn={habits.nadesOn}
              nadeOpacity={habits.nadeOpacity}
              onKind={habits.setNadeKind}
              onNadesOn={habits.setNadesOn}
              onOpacity={habits.setNadeOpacity}
            />
          )}
        </>
      )}
      {habits.overlay && (
        <span className="series-bucket-meta">
          {t(messages.analyzer.bucketMeta, {
            count: habits.overlay.roundCount,
            sec: habits.bucketPlaySec.toFixed(1),
            win: habits.overlay.windowSec.toFixed(0),
            paths:
              habits.overlayDisplay === "heatmap"
                ? messages.analyzer.bucketMetaHeat
                : habits.overlayTrails
                  ? t(messages.analyzer.bucketMetaPaths, { count: habits.overlay.trails.length })
                  : messages.analyzer.bucketMetaPathsOff,
            arrows: habits.overlayArrows
              ? t(messages.analyzer.bucketMetaArrows, { count: habits.overlay.trails.length })
              : messages.analyzer.bucketMetaArrowsOff,
            nades: visibleNades,
          })}
        </span>
      )}
    </div>
  );
}
