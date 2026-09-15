import type { MouseEvent, PointerEvent } from "react";
import type { ParseFileProgress } from "@/lib/parse/parsePool";
import { parseFileStateLabel, parsePoolSummary } from "@/lib/parse/parsePool";

interface Props {
  overallPct: number;
  files: ParseFileProgress[] | null;
  onCancel?: () => void;
}

function stopLabelActivation(e: MouseEvent | PointerEvent) {
  e.preventDefault();
  e.stopPropagation();
}

/** Overall plus per-demo bars while a series is parsing. */
export function ParseProgressPanel({ overallPct, files, onCancel }: Props) {
  const multi = files != null && files.length > 1;
  const summary = multi && files ? parsePoolSummary(files) : null;

  return (
    <div
      className="parse-progress-panel"
      onClick={stopLabelActivation}
      onPointerDown={stopLabelActivation}
    >
      <div className="parse-progress-toolbar">
        <div className="progress parse-progress-overall">
          <div className="bar" style={{ width: `${overallPct}%` }} />
          <span>{summary ? `${summary} · ${overallPct}%` : `${overallPct}%`}</span>
        </div>
        {onCancel && (
          <button
            type="button"
            className="ghost parse-progress-cancel"
            aria-label="Cancel parse"
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
      {multi && files && (
        <ul className="parse-progress-files">
          {files.map((file) => (
            <li key={file.index} className={`parse-file parse-file-${file.state}`}>
              <span className="parse-file-name" title={file.name}>
                {file.name}
              </span>
              <div className="progress parse-file-bar">
                <div className="bar" style={{ width: `${file.pct}%` }} />
              </div>
              <span className="parse-file-pct">{parseFileStateLabel(file)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
