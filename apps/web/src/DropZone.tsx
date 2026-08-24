import { ImportNotesButton } from "./ImportNotesButton";
import { publicUrl } from "./publicUrl";
import type { ReviewProject } from "./projectStore";
import { prettyMap } from "./weapons";

interface Props {
  onFile: (file: File) => void;
  onExportNotes: () => void;
  onDeleteNotes: (key: string) => void;
  onWantDemo: (fileName: string) => void;
  parsing: boolean;
  progress: { current: number; total: number } | null;
  error: string | null;
  notice: string | null;
  saved: ReviewProject[];
}

function savedWhen(savedAt: number): string {
  if (!savedAt) return "unknown time";
  return new Date(savedAt).toLocaleString();
}

export function DropZone({
  onFile,
  onExportNotes,
  onDeleteNotes,
  onWantDemo,
  parsing,
  progress,
  error,
  notice,
  saved,
}: Props) {
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((100 * progress.current) / progress.total))
      : 0;

  return (
    <div className="home">
      <label
        className="drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files[0];
          if (file) onFile(file);
        }}
      >
        <input
          type="file"
          accept=".dem,.json,application/octet-stream,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
          }}
        />
        <img className="brand-mark" src={publicUrl("favicon.svg")} width={56} height={56} alt="" />
        <div className="drop-title">CS2 Analyzer</div>
        <p>
          Drop a Counter-Strike 2 <code>.dem</code> file here.
        </p>
        <p className="muted">Parsed entirely in your browser. Nothing is uploaded.</p>
        <ul className="feature-list">
          <li>Live radar, nades, tracking, and drawing</li>
          <li>Scoreboard, clutches, utility, weapons, and round history</li>
          <li>Kill feed, death lines, opening duels, nade summary, CSV export</li>
        </ul>
        {parsing && (
          <div className="progress">
            <div className="bar" style={{ width: `${pct}%` }} />
            <span>{pct}%</span>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        {notice && <p className="notice">{notice}</p>}
      </label>
      <div className="home-notes">
        <p className="muted">
          Notes auto-save in this browser. The demo is not stored — drop the same <code>.dem</code>{" "}
          to restore drawings. Export a JSON backup so a cache wipe does not eat them.
        </p>
        <div className="home-notes-actions">
          <button
            type="button"
            className="ghost"
            onClick={onExportNotes}
            disabled={saved.length === 0}
          >
            Export notes
          </button>
          <ImportNotesButton onFile={onFile} />
        </div>
        {saved.length > 0 && (
          <div className="saved-demos">
            <h2>Saved notes</h2>
            <ul>
              {saved.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    className="saved-demo"
                    onClick={() => onWantDemo(p.fileName)}
                  >
                    <span className="saved-demo-map">{prettyMap(p.mapName)}</span>
                    <span className="saved-demo-file">{p.fileName || "unnamed.dem"}</span>
                    <span className="saved-demo-meta">
                      {p.strokes.length} drawing{p.strokes.length === 1 ? "" : "s"} ·{" "}
                      {savedWhen(p.savedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ghost saved-demo-del"
                    title="Remove notes for this match"
                    onClick={() => onDeleteNotes(p.key)}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <footer className="credits">
        <p>Made by whiskeyo. Fan project — not affiliated with Valve or FACEIT.</p>
        <p>
          Radar overviews are Valve’s, vendored from{" "}
          <a href="https://github.com/MurkyYT/cs2-map-icons" target="_blank" rel="noreferrer">
            cs2-map-icons
          </a>
          . Weapon icons from{" "}
          <a
            href="https://github.com/ChetdeJong/cs2-killfeed-generator"
            target="_blank"
            rel="noreferrer"
          >
            cs2-killfeed-generator
          </a>{" "}
          (MIT) and{" "}
          <a href="https://github.com/Juknum/counter-strike-icons" target="_blank" rel="noreferrer">
            counter-strike-icons
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
