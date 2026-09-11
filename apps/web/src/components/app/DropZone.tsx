import { useEffect, useMemo, useState, type DragEvent, type ReactNode } from "react";
import { ParseProgressPanel } from "@/components/app/ParseProgressPanel";
import { Credits } from "@/components/app/Credits";
import { prefetchParser } from "@/lib/parse/ensureParser";
import type { ParseFileProgress } from "@/lib/parse/parsePool";
import { SAVED_NOTES_PAGE_SIZE } from "@/lib/shared/constants";
import { publicUrl } from "@/lib/shared/publicUrl";
import { noteDrawingCount } from "@/lib/notes/note";
import {
  demoFilePickerAvailable,
  filesFromDataTransfer,
  pickOpenFiles,
  rememberDemoFileHandles,
  type ReviewProject,
} from "@/lib/notes/projectStore";
import { formatAdr, formatKast, type SavedPlayerSnapshot } from "@/lib/stats/stats";
import { prettyMap } from "@/lib/weapons/weapons";
import { useMessages } from "@/lib/i18n/useMessages";
import { localeTag } from "@/lib/i18n/locales";
import { t, type Messages } from "@/lib/i18n/messages";
import { ScorecardLabel } from "./ScorecardLabel";

interface Props {
  onFiles: (files: File[]) => void;
  onDeleteNotes: (key: string) => void;
  onTryOpenSaved: (project: ReviewProject) => Promise<File | null>;
  onLinkDemoFile: (project: ReviewProject) => void;
  parsing: boolean;
  progress: { current: number; total: number } | null;
  parseFiles: ParseFileProgress[] | null;
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

function savedWhen(savedAt: number, locale: string, unknownTime: string): string {
  if (!savedAt) return unknownTime;
  return new Date(savedAt).toLocaleString(locale);
}

function drawingCountLabel(notes: ReviewProject["notes"], messages: Messages): string {
  const count = noteDrawingCount(notes);
  return t(count === 1 ? messages.drop.drawingOne : messages.drop.drawingOther, { count });
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

async function takeDroppedFiles(e: DragEvent, onFiles: (files: File[]) => void): Promise<void> {
  e.preventDefault();
  const { files, handles } = await filesFromDataTransfer(e.dataTransfer);
  rememberDemoFileHandles(handles);
  if (files.length > 0) onFiles(files);
}

function takePickedFiles(
  files: File[],
  handles: Iterable<FileSystemFileHandle>,
  onFiles: (files: File[]) => void,
): void {
  rememberDemoFileHandles(handles);
  if (files.length > 0) onFiles(files);
}

export function DropZone({
  onFiles,
  onDeleteNotes,
  onTryOpenSaved,
  onLinkDemoFile,
  parsing,
  progress,
  parseFiles,
  error,
  notice,
  saved,
  showSavedNotes = false,
  pageSize = SAVED_NOTES_PAGE_SIZE,
  beside,
  below,
  children,
}: Props) {
  const { locale, messages, t } = useMessages();
  const [page, setPage] = useState(0);
  const [wantedDemo, setWantedDemo] = useState<string | null>(null);
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
      if (e.key === "Escape") setWantedDemo(null);
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
      onDrop={(e) => void takeDroppedFiles(e, onFiles)}
      onClick={(e) => {
        if (!demoFilePickerAvailable()) return;
        e.preventDefault();
        void pickOpenFiles().then((picked) => {
          if (!picked) return;
          takePickedFiles(picked.files, picked.handles, onFiles);
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
      <div className="drop-title">{messages.drop.title}</div>
      <p className="drop-blurb">
        {messages.drop.blurbBefore}
        <code>.dem</code>
        {messages.drop.blurbAfter}
      </p>
      <p className="muted">{messages.drop.parsedLocal}</p>
      {parsing && (
        <div className="drop-parse">
          <ParseProgressPanel overallPct={overallPct} files={parseFiles} />
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
            {messages.drop.savedLeadBefore}
            <code>.dem</code>
            {messages.drop.savedLeadAfter}
          </p>
          {saved.length > 0 && (
            <div className="saved-demos">
              <h2>{messages.drop.savedTitle}</h2>
              <ul>
                {pageItems.map((p) => (
                  <li key={p.key}>
                    <button
                      type="button"
                      className="saved-demo"
                      onClick={() => {
                        void onTryOpenSaved(p).then((file) => {
                          if (file) onFiles([file]);
                          else setWantedDemo(p.fileName || messages.drop.unnamedDemo);
                        });
                      }}
                    >
                      <span className="saved-demo-map">{noteTitle(p)}</span>
                      <span className="saved-demo-file">
                        {p.fileName || messages.drop.unnamedDemo}
                      </span>
                      <span className="saved-demo-meta">
                        {drawingCountLabel(p.notes, messages)}
                        {p.fileSizeBytes ? ` · ${formatDemoSize(p.fileSizeBytes)}` : ""}
                        {p.linkedFileLabel
                          ? ` · ${t(messages.drop.linked, { label: p.linkedFileLabel })}`
                          : ""}{" "}
                        · {savedWhen(p.savedAt, localeTag(locale), messages.drop.unknownTime)}
                      </span>
                      {p.playerStats && p.playerStats.length > 0 && (
                        <div className="saved-demo-stats">
                          <table>
                            <thead>
                              <tr>
                                <th>{messages.drop.player}</th>
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
                          title={messages.drop.linkDemoTitle}
                          onClick={() => onLinkDemoFile(p)}
                        >
                          {messages.drop.linkDemo}
                        </button>
                      )}
                      <button
                        type="button"
                        className="ghost saved-demo-del"
                        title={messages.drop.deleteNotesTitle}
                        onClick={() => onDeleteNotes(p.key)}
                      >
                        {messages.drop.deleteNotes}
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
                    {messages.drop.previous}
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
                    {messages.drop.next}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
      <Credits />
      {wantedDemo && (
        <div className="home-modal" onClick={() => setWantedDemo(null)}>
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
              void takeDroppedFiles(e, (files) => {
                setWantedDemo(null);
                onFiles(files);
              });
            }}
          >
            <h2 id="want-demo-title">{messages.drop.restoreTitle}</h2>
            <p>
              {messages.drop.restoreBefore} <code>{wantedDemo}</code>
              {messages.drop.restoreAfter}
            </p>
            <button type="button" className="ghost" onClick={() => setWantedDemo(null)}>
              {messages.drop.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
