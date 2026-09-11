import type { ParseFileProgress } from "@/lib/parse/parsePool";
import { t, type Messages } from "@/lib/i18n/messages";
import { useMessages } from "@/lib/i18n/useMessages";

interface Props {
  overallPct: number;
  files: ParseFileProgress[] | null;
}

function fileStatusLabel(file: ParseFileProgress, messages: Messages): string {
  if (file.state === "done") {
    return messages.parse.done;
  }
  if (file.state === "error") {
    return messages.parse.error;
  }
  if (file.state === "queued") {
    return messages.parse.queued;
  }
  return t(messages.parse.percent, { pct: file.pct });
}

/** Overall plus per-demo bars while a series is parsing. */
export function ParseProgressPanel({ overallPct, files }: Props) {
  const { messages, t: translate } = useMessages();
  const multi = files != null && files.length > 1;
  if (!multi) {
    return (
      <div className="progress">
        <div className="bar" style={{ width: `${overallPct}%` }} />
        <span>{translate(messages.parse.percent, { pct: overallPct })}</span>
      </div>
    );
  }

  return (
    <div className="parse-progress-panel">
      <div className="progress parse-progress-overall">
        <div className="bar" style={{ width: `${overallPct}%` }} />
        <span>{translate(messages.parse.overall, { pct: overallPct })}</span>
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
            <span className="parse-file-pct">{fileStatusLabel(file, messages)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
