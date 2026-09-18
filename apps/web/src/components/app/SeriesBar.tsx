import type { CSSProperties } from "react";
import { useApp } from "@/lib/state/appState";
import { showSeriesBar } from "@/lib/parse/seriesMode";
import {
  tutorialLocksSeriesToAggregatedFull,
  TUTORIAL_AGGREGATED_LOCK_NOTICE,
} from "@/lib/tutorial/activeRound";
import { prettyMap } from "@/lib/weapons/weapons";

/** File list + focal team when several demos are loaded for habits. */
export function SeriesBar() {
  const { session, habits, status } = useApp();
  if (!showSeriesBar(session)) return null;

  const series = session.series;
  const tutorialLock = tutorialLocksSeriesToAggregatedFull(series);

  const activeId = session.demo?.id ?? "";
  const { aggregated } = habits;
  const multiMap = session.mapGroups.length > 1;

  return (
    <div className="series-bar">
      <span className="series-bar-label">Series</span>
      {multiMap ? (
        <select
          className="series-map-select"
          aria-label="Map for series habits"
          value={session.selectedMapName ?? series.mapName}
          onChange={(e) => session.selectMap(e.target.value)}
        >
          {session.mapGroups.map((group) => (
            <option key={group.mapName} value={group.mapName}>
              {prettyMap(group.mapName)} ({group.demos.length})
            </option>
          ))}
        </select>
      ) : (
        <span className="series-bar-map">{prettyMap(series.mapName)}</span>
      )}
      <span className="series-bar-label">{series.focalTeam}</span>
      <div className="filters series-bar-mode" role="toolbar" aria-label="Series view">
        <button
          type="button"
          className={`filter${aggregated ? " on" : ""}`}
          data-tutorial="aggregated"
          onClick={() => {
            if (tutorialLock && aggregated) {
              status.setNotice(TUTORIAL_AGGREGATED_LOCK_NOTICE);
              return;
            }
            habits.setSeriesView(aggregated ? "demos" : "aggregated");
          }}
        >
          Aggregated
        </button>
      </div>
      <ul className="series-bar-files">
        {series.demos.map((demo) => {
          const roundCount = series.tagsByDemo.get(demo.id)?.length ?? 0;
          const demoColor = habits.demoColors.get(demo.id);
          return (
            <li key={demo.id}>
              <button
                type="button"
                className={demo.id === activeId ? "series-file active" : "series-file"}
                style={demoColor ? ({ "--demo-color": demoColor } as CSSProperties) : undefined}
                title={`${roundCount} tagged rounds · already parsed`}
                onClick={() => {
                  if (tutorialLock) {
                    status.setNotice(TUTORIAL_AGGREGATED_LOCK_NOTICE);
                    return;
                  }
                  if (aggregated) habits.setSeriesView("demos");
                  session.selectDemo(demo.id);
                }}
              >
                {demo.fileName}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
