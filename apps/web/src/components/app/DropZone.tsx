import { useEffect, useMemo, useState, type DragEvent } from "react";
import { ImportNotesButton } from "@/components/sidebar/ImportNotesButton";
import { SAVED_NOTES_PAGE_SIZE } from "@/lib/shared/constants";
import { publicUrl } from "@/lib/shared/publicUrl";
import type { ReviewProject } from "@/lib/notes/projectStore";
import { formatScorecard, type SavedPlayerSnapshot } from "@/lib/stats/stats";
import { prettyMap } from "@/lib/weapons/weapons";

const REPO_URL = "https://github.com/whiskeyo/cs2analyzer";
const ISSUES_URL = `${REPO_URL}/issues`;
const STEAM_TRADE_URL =
  "https://steamcommunity.com/tradeoffer/new/?partner=69520211&token=YCinud5X";

interface Props {
  onFile: (file: File) => void;
  onExportNotes: () => void;
  onDeleteNotes: (key: string) => void;
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

function noteTitle(p: ReviewProject): string {
  const map = prettyMap(p.mapName);
  if (!p.scorecard) return map;
  return `${map}: ${formatScorecard(p.scorecard)}`;
}

function sortedSnapshots(rows: SavedPlayerSnapshot[]): SavedPlayerSnapshot[] {
  return [...rows].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}

function takeDroppedFile(e: DragEvent, onFile: (file: File) => void): void {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file) onFile(file);
}

export function DropZone({
  onFile,
  onExportNotes,
  onDeleteNotes,
  parsing,
  progress,
  error,
  notice,
  saved,
}: Props) {
  const [page, setPage] = useState(0);
  const [wantedDemo, setWantedDemo] = useState<string | null>(null);
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((100 * progress.current) / progress.total))
      : 0;

  const pageCount = Math.max(1, Math.ceil(saved.length / SAVED_NOTES_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = useMemo(() => {
    const start = safePage * SAVED_NOTES_PAGE_SIZE;
    return saved.slice(start, start + SAVED_NOTES_PAGE_SIZE);
  }, [saved, safePage]);

  useEffect(() => {
    if (!wantedDemo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWantedDemo(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wantedDemo]);

  return (
    <div className="home">
      <div className="home-main">
        <label
          className="drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => takeDroppedFile(e, onFile)}
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
          <img
            className="brand-mark"
            src={publicUrl("favicon.svg")}
            width={56}
            height={56}
            alt=""
          />
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
            Notes auto-save in this browser. The demo is not stored — drop the same{" "}
            <code>.dem</code> to restore drawings. Export a JSON backup so a cache wipe does not eat
            them.
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
                {pageItems.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      className="saved-demo"
                      onClick={() => setWantedDemo(p.fileName || "unnamed.dem")}
                    >
                      <span className="saved-demo-map">{noteTitle(p)}</span>
                      <span className="saved-demo-file">{p.fileName || "unnamed.dem"}</span>
                      <span className="saved-demo-meta">
                        {p.strokes.length} drawing{p.strokes.length === 1 ? "" : "s"} -{" "}
                        {savedWhen(p.savedAt)}
                      </span>
                      {p.playerStats && p.playerStats.length > 0 && (
                        <div className="saved-demo-stats">
                          <table>
                            <thead>
                              <tr>
                                <th>Player</th>
                                <th>K</th>
                                <th>D</th>
                                <th>ADR</th>
                                <th>KAST</th>
                                <th>R</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sortedSnapshots(p.playerStats).map((s, i) => (
                                <tr key={`${s.name}-${i}`}>
                                  <td>{s.name}</td>
                                  <td>{s.kills}</td>
                                  <td>{s.deaths}</td>
                                  <td>{s.adr}</td>
                                  <td>{s.kast}</td>
                                  <td>{s.rating.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
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
              {pageCount > 1 && (
                <div className="saved-demos-pager">
                  <button
                    type="button"
                    className="ghost"
                    disabled={safePage === 0}
                    onClick={() => setPage(safePage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    {safePage + 1} / {pageCount}
                  </span>
                  <button
                    type="button"
                    className="ghost"
                    disabled={safePage >= pageCount - 1}
                    onClick={() => setPage(safePage + 1)}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <footer className="credits">
        <p className="credits-links">
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <span aria-hidden="true">·</span>
          <a href={ISSUES_URL} target="_blank" rel="noreferrer">
            Issues
          </a>
          <span aria-hidden="true">·</span>
          <a href={STEAM_TRADE_URL} target="_blank" rel="noreferrer">
            Donate
          </a>
        </p>
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
      {wantedDemo && (
        <div className="home-modal" onClick={() => setWantedDemo(null)}>
          <div
            className="home-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="want-demo-title"
            onClick={(e) => e.stopPropagation()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              takeDroppedFile(e, (file) => {
                setWantedDemo(null);
                onFile(file);
              });
            }}
          >
            <h2 id="want-demo-title">Restore notes</h2>
            <p>
              Drop <code>{wantedDemo}</code> here to restore those drawings. The demo itself is not
              stored.
            </p>
            <button type="button" className="ghost" onClick={() => setWantedDemo(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
