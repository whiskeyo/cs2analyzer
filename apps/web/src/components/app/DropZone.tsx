import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ParseProgressPanel } from "@/components/app/ParseProgressPanel";
import { Credits } from "@/components/app/Credits";
import { prefetchParser } from "@/lib/parse/ensureParser";
import type { ParseFileProgress } from "@/lib/parse/parsePool";
import { SAVED_NOTES_PAGE_SIZE } from "@/lib/shared/constants";
import { publicUrl } from "@/lib/shared/publicUrl";
import { noteDrawingCount } from "@/lib/notes/note";
import { takeDroppedDemoFiles, takePickedDemoFiles } from "@/lib/parse/demoDrop";
import {
  demoFilePickerAvailable,
  pickDemoFileHandle,
  pickOpenFiles,
  rememberDemoFileHandles,
  type ReviewProject,
} from "@/lib/notes/projectStore";
import { formatAdr, formatKast, type SavedPlayerSnapshot } from "@/lib/stats/stats";
import { prettyMap } from "@/lib/weapons/weapons";
import { ScorecardLabel } from "./ScorecardLabel";

interface Props {
  onFiles: (files: File[]) => void;
  onDeleteNotes: (key: string) => void;
  onTryOpenSaved: (project: ReviewProject) => Promise<File | null>;
  onLinkDemoFile: (project: ReviewProject) => void;
  parsing: boolean;
  progress: { current: number; total: number } | null;
  parseFiles: ParseFileProgress[] | null;
  onCancelParse?: () => void;
  error: string | null;
  notice: string | null;
  saved: ReviewProject[];
  showSavedNotes?: boolean;
  pageSize?: number;
  /** Optional sibling of the drop card. */
  beside?: ReactNode;
  /** Optional content under the drop row. */
  below?: ReactNode;
  children?: ReactNode;
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

function drawingCountLabel(notes: ReviewProject["notes"]): string {
  const count = noteDrawingCount(notes);
  return `${count} drawing${count === 1 ? "" : "s"}`;
}

function noteTitle(p: ReviewProject): ReactNode {
  const map = prettyMap(p.mapName);
  if (!p.scorecard) return map;
  return <ScorecardLabel mapLabel={map} scorecard={p.scorecard} />;
}

function sortedSnapshots(rows: SavedPlayerSnapshot[]): SavedPlayerSnapshot[] {
  return [...rows].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}

export function DropZone({
  onFiles,
  onDeleteNotes,
  onTryOpenSaved,
  onLinkDemoFile,
  parsing,
  progress,
  parseFiles,
  onCancelParse,
  error,
  notice,
  saved,
  showSavedNotes = false,
  pageSize = SAVED_NOTES_PAGE_SIZE,
  beside,
  below,
  children,
}: Props) {
  const [page, setPage] = useState(0);
  const [wantedDemo, setWantedDemo] = useState<{ fileName: string; linked: boolean } | null>(null);
  const [restoreHint, setRestoreHint] = useState<string | null>(null);
  const overallPct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((100 * progress.current) / progress.total))
      : 0;

  const pageCount = Math.max(1, Math.ceil(saved.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = useMemo(() => {
    const start = safePage * pageSize;
    return saved.slice(start, start + pageSize);
  }, [saved, safePage, pageSize]);

  useEffect(() => {
    if (!wantedDemo) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setWantedDemo(null);
        setRestoreHint(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [wantedDemo]);

  const drop = (
    <label
      className="drop"
      onPointerEnter={() => prefetchParser()}
      onPointerDown={() => prefetchParser()}
      onDragEnter={() => prefetchParser()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => void takeDroppedDemoFiles(e, onFiles)}
      onClick={(e) => {
        if (!demoFilePickerAvailable()) return;
        e.preventDefault();
        void pickOpenFiles().then((picked) => {
          if (!picked) return;
          takePickedDemoFiles(picked.files, picked.handles, onFiles);
        });
      }}
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
      <img className="brand-mark" src={publicUrl("favicon.svg")} width={56} height={56} alt="" />
      <div className="drop-title">Drop a demo</div>
      <p className="drop-blurb">
        One Counter-Strike 2 <code>.dem</code> to watch the match, or several for habits (same map,
        or mixed maps with a map picker).
      </p>
      <p className="muted">Parsed entirely in your browser.</p>
      {parsing && (
        <div className="drop-parse">
          <ParseProgressPanel overallPct={overallPct} files={parseFiles} onCancel={onCancelParse} />
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {notice && <p className="notice">{notice}</p>}
    </label>
  );

  return (
    <div className="home">
      <div className="home-hero">
        {children}
        {beside ? (
          <div className="home-shortcuts">
            {drop}
            {beside}
          </div>
        ) : (
          drop
        )}
        {below}
      </div>
      {showSavedNotes ? (
        <div className="home-notes">
          <p className="muted">
            Notes auto-save in this browser. The demo is not stored — drop the same{" "}
            <code>.dem</code> to restore drawings. Export a JSON backup from Settings so a cache
            wipe does not eat them.
          </p>
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
                          else {
                            setRestoreHint(null);
                            setWantedDemo({
                              fileName: p.fileName || "unnamed.dem",
                              linked: Boolean(p.linkedFileLabel),
                            });
                          }
                        });
                      }}
                    >
                      <span className="saved-demo-map">{noteTitle(p)}</span>
                      <span className="saved-demo-file">{p.fileName || "unnamed.dem"}</span>
                      <span className="saved-demo-meta">
                        {drawingCountLabel(p.notes)}
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
                    <div className="saved-demo-actions">
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
                    </div>
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
      ) : null}
      <Credits />
      {wantedDemo && (
        <div
          className="home-modal"
          onClick={() => {
            setWantedDemo(null);
            setRestoreHint(null);
          }}
        >
          <div
            className="home-modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="want-demo-title"
            onClick={(e) => e.stopPropagation()}
            onPointerEnter={() => prefetchParser()}
            onDragEnter={() => prefetchParser()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              void takeDroppedDemoFiles(e, (files) => {
                setWantedDemo(null);
                setRestoreHint(null);
                onFiles(files);
              });
            }}
          >
            <h2 id="want-demo-title">Restore notes</h2>
            <p>
              {wantedDemo.linked ? (
                <>
                  This browser no longer has permission to read the linked demo. Pick{" "}
                  <code>{wantedDemo.fileName}</code> again, or drop it here.
                </>
              ) : (
                <>
                  Drop <code>{wantedDemo.fileName}</code> here to restore those drawings. The demo
                  itself is not stored.
                </>
              )}
            </p>
            {restoreHint && <p className="error">{restoreHint}</p>}
            <div className="home-modal-actions">
              {demoFilePickerAvailable() && (
                <button
                  type="button"
                  className="ghost"
                  onClick={() => {
                    void pickDemoFileHandle().then(async (handle) => {
                      if (!handle) return;
                      if (handle.name !== wantedDemo.fileName) {
                        setRestoreHint(`Pick ${wantedDemo.fileName} — selected ${handle.name}.`);
                        return;
                      }
                      rememberDemoFileHandles([handle]);
                      const file = await handle.getFile();
                      setWantedDemo(null);
                      setRestoreHint(null);
                      onFiles([file]);
                    });
                  }}
                >
                  Pick demo
                </button>
              )}
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setWantedDemo(null);
                  setRestoreHint(null);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
