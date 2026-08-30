import type { ParseFileProgress } from "@/lib/parse/parsePool";

interface Props {
  overallPct: number;
  files: ParseFileProgress[] | null;
}

/** Overall plus per-demo bars while a series is parsing. */
export function ParseProgressPanel({ overallPct, files }: Props) {
  const multi = files != null && files.length > 1;
  if (!multi) {
    return (
      <div className="progress">
        <div className="bar" style={{ width: `${overallPct}%` }} />
        <span>{overallPct}%</span>
      </div>
    );
  }

  return (
    <div className="parse-progress-panel">
      <div className="progress parse-progress-overall">
        <div className="bar" style={{ width: `${overallPct}%` }} />
        <span>Overall {overallPct}%</span>
      </div>
      <ul className="parse-progress-files">
        {files.map((file) => (
          <li key={file.index} className={`parse-file parse-file-${file.state}`}>
            <span className="parse-file-name" title={file.name}>
              {file.name}
            </span>
            <div className="progress parse-file-bar">
              <div className="bar" style={{ width: `${file.pct}%` }} />
            </div>
            <span className="parse-file-pct">
              {file.state === "done"
                ? "done"
                : file.state === "error"
                  ? "err"
                  : file.state === "queued"
                    ? "…"
                    : `${file.pct}%`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
