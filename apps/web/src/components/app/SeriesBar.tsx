import type { CSSProperties } from "react";
import { useMessages } from "@/lib/i18n/useMessages";
import { useApp } from "@/lib/state/appState";
import { showSeriesBar } from "@/lib/parse/seriesMode";
import { prettyMap } from "@/lib/weapons/weapons";

/** File list + focal team when several demos are loaded for habits. */
export function SeriesBar() {
  const { messages, t } = useMessages();
  const { session, habits } = useApp();
  if (!showSeriesBar(session)) return null;

  const series = session.series;

  const activeId = session.demo?.id ?? "";
  const { aggregated } = habits;
  const multiMap = session.mapGroups.length > 1;

  return (
    <div className="series-bar">
      <span className="series-bar-label">{messages.analyzer.series}</span>
      {multiMap ? (
        <select
          className="series-map-select"
          aria-label={messages.analyzer.mapSelect}
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
      <div
        className="filters series-bar-mode"
        role="toolbar"
        aria-label={messages.analyzer.seriesView}
      >
        <button
          type="button"
          className={`filter${aggregated ? " on" : ""}`}
          onClick={() => habits.setSeriesView(aggregated ? "demos" : "aggregated")}
        >
          {messages.analyzer.aggregated}
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
                title={t(messages.analyzer.taggedRounds, { count: roundCount })}
                onClick={() => {
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
