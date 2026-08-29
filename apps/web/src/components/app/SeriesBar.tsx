import { useApp } from "@/lib/state/appState";
import { prettyMap } from "@/lib/weapons/weapons";

/** File list + focal team when several same-map demos are loaded. */
export function SeriesBar() {
  const { session } = useApp();
  const series = session.series;

  if (!series || series.demos.length <= 1) return null;

  const activeId = session.demo?.id ?? "";

  return (
    <div className="series-bar">
      <span className="series-bar-label">
        Series · {prettyMap(series.mapName)} · {series.focalTeam}
      </span>
      <ul className="series-bar-files">
        {series.demos.map((demo) => {
          const roundCount = series.tagsByDemo.get(demo.id)?.length ?? 0;
          return (
            <li key={demo.id}>
              <button
                type="button"
                className={demo.id === activeId ? "series-file active" : "series-file"}
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
