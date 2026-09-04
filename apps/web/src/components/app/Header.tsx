import { useEffect, useId, useRef, useState } from "react";
import { ImportNotesButton } from "@/components/sidebar/ImportNotesButton";
import { downloadBlob } from "@/lib/shared/download";
import { publicUrl } from "@/lib/shared/publicUrl";
import { computeStats, exportStatsCsv } from "@/lib/stats/stats";
import { useApp } from "@/lib/state/appState";
import { isAggregatedView } from "@/lib/parse/seriesMode";
import { prettyMap } from "@/lib/weapons/weapons";
import type { Replay } from "@/lib/replay/replayTypes";

const REMOVE_NOTES_CONFIRM = "yes, remove notes";

function downloadCsv(replay: Replay, fileName: string, tick: number) {
  const csv = exportStatsCsv(replay, computeStats(replay, tick), tick);
  const base = fileName.replace(/\.dem$/i, "") || "demo";
  downloadBlob(`${base}-stats.csv`, "text/csv", csv);
}

function GearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 2h-3.8a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.55-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.7 8.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.82 14.64a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.68.22l2.39-.96c.5.39 1.04.7 1.63.94l.36 2.54c.05.24.26.42.5.42h3.8c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.55 1.63-.94l2.39.96c.25.12.54.02.68-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
      />
    </svg>
  );
}

/** Shared top bar for splash and viewer. */
export function Header() {
  const { session, playback, review, habits, onFiles } = useApp();
  const replay = session.replay;
  const aggregated = replay != null && isAggregatedView(session.series, habits);
  const canExportNotes = replay != null || review.saved.length > 0;
  const canRemoveNotes = review.saved.length > 0;

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState("");
  const settingsRef = useRef<HTMLDivElement>(null);
  const removeTitleId = useId();

  useEffect(() => {
    if (!settingsOpen) return;
    const onPointer = (e: MouseEvent) => {
      if (!settingsRef.current?.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSettingsOpen(false);
    };
    window.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [settingsOpen]);

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
    <>
      <header className="top">
        <button type="button" className="brand" onClick={session.close} aria-label="Home">
          <img
            className="brand-mark"
            src={publicUrl("favicon.svg")}
            width={28}
            height={28}
            alt=""
          />
          <h1>CS2 Analyzer</h1>
        </button>
        {replay ? (
          <span className="file-meta">
            {prettyMap(replay.header.map_name)}
            {session.fileName ? ` · ${session.fileName}` : ""} · {replay.kills.length} kills ·{" "}
            {replay.grenades.length} nades
          </span>
        ) : null}
        <div className="top-actions">
          {replay ? (
            <button type="button" className="ghost" onClick={session.close}>
              New demo
            </button>
          ) : null}
          {replay ? (
            <button
              type="button"
              className="ghost"
              disabled={aggregated}
              title={aggregated ? "Export CSV is per-demo; switch off Aggregated" : undefined}
              onClick={() => downloadCsv(replay, session.fileName, playback.tick)}
            >
              Export CSV
            </button>
          ) : null}
          <div className="settings" ref={settingsRef}>
            <button
              type="button"
              className="ghost settings-toggle"
              aria-label="Settings"
              aria-expanded={settingsOpen}
              aria-controls={settingsOpen ? "app-settings-menu" : undefined}
              onClick={() => setSettingsOpen((open) => !open)}
            >
              <GearIcon />
            </button>
            {settingsOpen ? (
              <div className="settings-menu" id="app-settings-menu">
                <button
                  type="button"
                  className="ghost"
                  disabled={!canExportNotes}
                  onClick={() => {
                    setSettingsOpen(false);
                    void review.exportNotes();
                  }}
                >
                  Export notes
                </button>
                <ImportNotesButton
                  onFile={(file) => {
                    setSettingsOpen(false);
                    onFiles([file]);
                  }}
                />
                <button
                  type="button"
                  className="danger"
                  disabled={!canRemoveNotes}
                  onClick={() => {
                    setSettingsOpen(false);
                    setRemoveOpen(true);
                    setRemoveConfirm("");
                  }}
                >
                  Remove notes
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {removeOpen ? (
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
            aria-labelledby={removeTitleId}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id={removeTitleId}>Remove all saved notes?</h2>
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
                  void review.removeAllNotes();
                }}
              >
                Remove all notes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
