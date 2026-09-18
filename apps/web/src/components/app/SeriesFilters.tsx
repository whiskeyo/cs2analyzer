import { useApp } from "@/lib/state/appState";
import { seriesTeamCandidates } from "@/lib/parse/session";
import { isBucketOverlayActive, isMultiDemoSeries } from "@/lib/parse/seriesMode";
import type { RoundKind } from "@/lib/parse/roundTags";
import { filterHabitsNades } from "@/lib/parse/seriesOverlay";
import { isTutorialSeriesSession } from "@/lib/tutorial/activeRound";
import { HabitsNadeLegend } from "./HabitsNadeLegend";

const KINDS: { id: RoundKind; label: string }[] = [
  { id: "pistol", label: "Pistol" },
  { id: "eco", label: "Eco" },
  { id: "force", label: "Force" },
  { id: "full", label: "Full" },
];

/** Team, side, buy, and optional player filters for the habits overlay. */
export function SeriesFilters() {
  const { session, habits } = useApp();
  const series = session.series;
  if (!isMultiDemoSeries(series)) return null;

  const teams = seriesTeamCandidates(series.demos);
  const { filter, overlayOn, focalPlayers, playerKey, aggregated } = habits;
  const overlayActive = isBucketOverlayActive(series, habits);
  const tutorialSeries = series.demos.some((demo) => isTutorialSeriesSession(demo.id));
  const visibleNades =
    habits.overlay == null ? 0 : filterHabitsNades(habits.overlay.nades, habits.nadeFilter).length;

  return (
    <div className="series-filters">
      <span className="series-filters-label">Team</span>
      <select
        className="series-team-select"
        aria-label="Focal team for habits"
        value={series.focalTeam}
        onChange={(e) => session.setFocalTeam(e.target.value)}
      >
        {teams.map((team) => (
          <option key={team.name} value={team.name}>
            {team.name} ({team.demoCount}/{series.demos.length})
          </option>
        ))}
      </select>
      <span className="series-filters-label">Side</span>
      <div className="filters" role="toolbar" aria-label="Habits side">
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
      <span className="series-filters-label">Buy</span>
      <div className="filters" role="toolbar" aria-label="Habits buy type">
        {KINDS.map((k) => {
          const enabled = !tutorialSeries || k.id === "full";
          return (
            <button
              key={k.id}
              type="button"
              className={`filter${filter.kind === k.id ? " on" : ""}${enabled ? "" : " is-inactive"}`}
              disabled={!enabled}
              title={enabled ? undefined : "Tutorial uses Aggregated full only"}
              onClick={() => habits.setKind(k.id)}
            >
              {k.label}
            </button>
          );
        })}
      </div>
      {focalPlayers.length > 0 && (
        <>
          <span className="series-filters-label">Player</span>
          <select
            className="series-player-select"
            aria-label="Filter habits by player"
            value={playerKey ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              habits.setPlayerKey(v || null);
            }}
          >
            <option value="">All players</option>
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
            Overlay
          </label>
          {overlayActive && (
            <>
              <label className="series-overlay-toggle">
                <input
                  type="checkbox"
                  checked={habits.overlayArrows}
                  onChange={(e) => habits.setOverlayArrows(e.target.checked)}
                />
                Arrows
              </label>
              <label className="series-overlay-toggle">
                <input
                  type="checkbox"
                  checked={habits.overlayTrails}
                  onChange={(e) => habits.setOverlayTrails(e.target.checked)}
                />
                Trails
              </label>
              <div className="filters" role="toolbar" aria-label="Habits path display">
                {(
                  [
                    { id: "trails", label: "Paths" },
                    { id: "overall", label: "Overall" },
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
          {habits.overlay.roundCount} rounds · freeze +{habits.bucketPlaySec.toFixed(1)}s /{" "}
          {habits.overlay.windowSec.toFixed(0)}s ·{" "}
          {habits.overlayDisplay === "overall"
            ? `${habits.overlay.branches.length} branches`
            : habits.overlayTrails
              ? `${habits.overlay.trails.length} paths`
              : "paths off"}{" "}
          · {habits.overlayArrows ? `${habits.overlay.trails.length} arrows` : "arrows off"} · ·{" "}
          {visibleNades} nades
        </span>
      )}
    </div>
  );
}
