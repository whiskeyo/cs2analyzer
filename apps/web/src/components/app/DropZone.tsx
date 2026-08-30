import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { ImportNotesButton } from "@/components/sidebar/ImportNotesButton";
import { ParseProgressPanel } from "@/components/app/ParseProgressPanel";
import type { ParseFileProgress } from "@/lib/parse/parsePool";
import { SAVED_NOTES_PAGE_SIZE } from "@/lib/shared/constants";
import { publicUrl } from "@/lib/shared/publicUrl";
import type { ReviewProject } from "@/lib/notes/projectStore";
import { demoFilePickerAvailable } from "@/lib/notes/projectStore";
import { formatAdr, formatKast, type SavedPlayerSnapshot } from "@/lib/stats/stats";
import { prettyMap } from "@/lib/weapons/weapons";
import { ScorecardLabel } from "./ScorecardLabel";

const REPO_URL = "https://github.com/whiskeyo/cs2analyzer";
const ISSUES_URL = `${REPO_URL}/issues`;
const STEAM_TRADE_URL =
  "https://steamcommunity.com/tradeoffer/new/?partner=69520211&token=YCinud5X";
const REMOVE_NOTES_CONFIRM = "yes, remove notes";

interface Props {
  onFiles: (files: File[]) => void;
  onExportNotes: () => void;
  onRemoveAllNotes: () => void;
  onDeleteNotes: (key: string) => void;
  onTryOpenSaved: (project: ReviewProject) => Promise<File | null>;
  onLinkDemoFile: (project: ReviewProject) => void;
  parsing: boolean;
  progress: { current: number; total: number } | null;
  parseFiles: ParseFileProgress[] | null;
  error: string | null;
  notice: string | null;
  saved: ReviewProject[];
}

function savedWhen(savedAt: number): string {
  if (!savedAt) return "unknown time";
  return new Date(savedAt).toLocaleString();
}

function formatDemoSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const mb = bytes / (1024 * 1024);
  if (mb < 1024) return `${mb.toFixed(mb >= 10 ? 0 : 1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

function noteTitle(p: ReviewProject): ReactNode {
  const map = prettyMap(p.mapName);
  if (!p.scorecard) return map;
  return <ScorecardLabel mapLabel={map} scorecard={p.scorecard} />;
}

function sortedSnapshots(rows: SavedPlayerSnapshot[]): SavedPlayerSnapshot[] {
  return [...rows].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}

function takeDroppedFiles(e: DragEvent, onFiles: (files: File[]) => void): void {
  e.preventDefault();
  const files = [...e.dataTransfer.files];
  if (files.length > 0) onFiles(files);
}

export function DropZone({
  onFiles,
  onExportNotes,
  onRemoveAllNotes,
  onDeleteNotes,
  onTryOpenSaved,
  onLinkDemoFile,
  parsing,
  progress,
  parseFiles,
  error,
  notice,
  saved,
}: Props) {
  const [page, setPage] = useState(0);
  const [wantedDemo, setWantedDemo] = useState<string | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState("");
  const overallPct =
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

  useEffect(() => {
    if (!removeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setRemoveOpen(false);
        setRemoveConfirm("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeOpen]);

  return (
    <div className="home">
      <div className="home-main">
        <label
          className="drop"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => takeDroppedFiles(e, onFiles)}
        >
          <input
            type="file"
            accept=".dem,.json,application/octet-stream,application/json"
            multiple
            hidden
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              if (files.length > 0) onFiles(files);
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
            Drop one Counter-Strike 2 <code>.dem</code> to watch, or several on the same map for
            habits.
          </p>
          <p className="muted">Parsed entirely in your browser. Nothing is uploaded.</p>
          <ul className="feature-list">
            <li>Live radar, nades, tracking, and drawing</li>
            <li>Scoreboard, clutches, utility, weapons, and round history</li>
            <li>Kill feed, death lines, opening duels, nade summary, CSV export</li>
          </ul>
          {parsing && (
            <div className="drop-parse">
              <ParseProgressPanel overallPct={overallPct} files={parseFiles} />
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
            <ImportNotesButton onFile={(file) => onFiles([file])} />
            <button
              type="button"
              className="danger"
              onClick={() => setRemoveOpen(true)}
              disabled={saved.length === 0}
            >
              Remove notes
            </button>
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
                      onClick={() => {
                        void onTryOpenSaved(p).then((file) => {
                          if (file) onFiles([file]);
                          else setWantedDemo(p.fileName || "unnamed.dem");
                        });
                      }}
                    >
                      <span className="saved-demo-map">{noteTitle(p)}</span>
                      <span className="saved-demo-file">{p.fileName || "unnamed.dem"}</span>
                      <span className="saved-demo-meta">
                        {p.strokes.length} drawing{p.strokes.length === 1 ? "" : "s"}
                        {p.fileSizeBytes ? ` · ${formatDemoSize(p.fileSizeBytes)}` : ""}
                        {p.linkedFileLabel ? ` · linked: ${p.linkedFileLabel}` : ""} ·{" "}
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
                                  <td>{formatAdr(s.adr)}</td>
                                  <td>{formatKast(s.kast)}</td>
                                  <td>{s.rating.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </button>
                    {demoFilePickerAvailable() && (
                      <button
                        type="button"
                        className="ghost saved-demo-link"
                        title="Link this demo file so Open can load it without re-dropping"
                        onClick={() => onLinkDemoFile(p)}
                      >
                        Link demo
                      </button>
                    )}
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
      {removeOpen && (
        <div
          className="home-modal"
          onClick={() => {
            setRemoveOpen(false);
            setRemoveConfirm("");
          }}
        >
          <div
            className="home-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-notes-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="remove-notes-title">Remove all saved notes?</h2>
            <p>
              This deletes every drawing project stored in this browser. Export a JSON backup first
              if you might need them later.
            </p>
            <p>
              Type <code>{REMOVE_NOTES_CONFIRM}</code> to confirm.
            </p>
            <input
              className="remove-notes-input"
              type="text"
              value={removeConfirm}
              autoComplete="off"
              spellCheck={false}
              aria-label="Confirmation phrase"
              onChange={(e) => setRemoveConfirm(e.target.value)}
            />
            <div className="home-modal-actions">
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setRemoveOpen(false);
                  setRemoveConfirm("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                disabled={removeConfirm !== REMOVE_NOTES_CONFIRM}
                onClick={() => {
                  setRemoveOpen(false);
                  setRemoveConfirm("");
                  onRemoveAllNotes();
                }}
              >
                Remove all notes
              </button>
            </div>
          </div>
        </div>
      )}
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
              takeDroppedFiles(e, (files) => {
                setWantedDemo(null);
                onFiles(files);
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
