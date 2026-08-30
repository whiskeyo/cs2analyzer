import type { CSSProperties } from "react";
import { useApp } from "@/lib/state/appState";
import { prettyMap } from "@/lib/weapons/weapons";

/** File list + focal team when several same-map demos are loaded. */
export function SeriesBar() {
  const { session, habits } = useApp();
  const series = session.series;

  if (!series || series.demos.length <= 1) return null;

  const activeId = session.demo?.id ?? "";
  const { aggregated } = habits;

  return (
    <div className="series-bar">
      <span className="series-bar-label">
        Series · {prettyMap(series.mapName)} · {series.focalTeam}
      </span>
      <div className="filters series-bar-mode" role="toolbar" aria-label="Series view">
        <button
          type="button"
          className={`filter${aggregated ? " on" : ""}`}
          onClick={() => habits.setSeriesView(aggregated ? "demos" : "aggregated")}
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
                onClick={() => session.selectDemo(demo.id)}
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
