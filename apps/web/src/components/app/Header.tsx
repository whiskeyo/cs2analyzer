import { useEffect, useId, useRef, useState } from "react";
import { ImportNotesButton } from "@/components/sidebar/ImportNotesButton";
import { downloadBlob } from "@/lib/shared/download";
import { publicUrl } from "@/lib/shared/publicUrl";
import { computeStats, exportStatsCsv, matchEndTick } from "@/lib/stats/stats";
import { useApp } from "@/lib/state/appState";
import { isAggregatedView } from "@/lib/parse/seriesMode";
import { prettyMap } from "@/lib/weapons/weapons";
import type { Replay } from "@/lib/replay/replayTypes";
import { navigate, ROUTES, usePathname } from "@/lib/app/devNavigate";
import { isFaqPath, isLayoutsPath, isPlaybookPath } from "@/lib/app/routes";
import { PLAYBOOKS_CHANGED_EVENT } from "@/lib/playbook/events";
import { countPlaybooks, deleteAllPlaybooks } from "@/lib/playbook/playbookStore";
import {
  exportPlaybooks,
  importPlaybooksFromText,
  commitPlaybookImport,
} from "@/lib/playbook/transfer";
import type { PlaybookBundle } from "@/lib/playbook/transfer";
import type { ImportChoices, ImportConflict } from "@/lib/playbook/merge";
import { ImportMergeDialog } from "@/components/playbook/ImportMergeDialog";
import { SiteNav } from "./SiteNav";

const REMOVE_NOTES_CONFIRM = "yes, remove notes";
const REMOVE_PLAYBOOKS_CONFIRM = "yes, remove playbooks";

function downloadCsv(replay: Replay, fileName: string) {
  const csv = exportStatsCsv(replay, computeStats(replay, matchEndTick(replay)));
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
  const { session, review, habits, onFiles } = useApp();
  const replay = session.replay;
  const aggregated = replay != null && isAggregatedView(session.series, habits);
  const canExportNotes = replay != null || review.saved.length > 0;
  const canRemoveNotes = review.saved.length > 0;

  const pathname = usePathname();
  const onLayouts = import.meta.env.DEV && isLayoutsPath(pathname);
  const onFaq = isFaqPath(pathname);
  const onPlaybook = isPlaybookPath(pathname);
  const showMatchChrome = replay != null && !onFaq && !onLayouts && !onPlaybook;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [removeKind, setRemoveKind] = useState<"notes" | "playbooks" | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState("");
  const [playbookCount, setPlaybookCount] = useState(0);
  const [playbookFlash, setPlaybookFlash] = useState<string | null>(null);
  const [playbookFlashError, setPlaybookFlashError] = useState<string | null>(null);
  const [importMerge, setImportMerge] = useState<{
    conflicts: ImportConflict[];
    bundle: PlaybookBundle;
  } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const playbookImportRef = useRef<HTMLInputElement>(null);
  const removeTitleId = useId();
  const removeOpen = removeKind != null;
  const removePhrase = removeKind === "playbooks" ? REMOVE_PLAYBOOKS_CONFIRM : REMOVE_NOTES_CONFIRM;

  useEffect(() => {
    if (!settingsOpen) return;
    void countPlaybooks().then(setPlaybookCount);
  }, [settingsOpen]);

  useEffect(() => {
    const onChanged = () => {
      void countPlaybooks().then(setPlaybookCount);
    };
    window.addEventListener(PLAYBOOKS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PLAYBOOKS_CHANGED_EVENT, onChanged);
  }, []);

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
        setRemoveKind(null);
        setRemoveConfirm("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [removeOpen]);

  return (
    <>
      <header className="top">
        <div className="brand-row">
          <button
            type="button"
            className="brand"
            onClick={() => {
              session.close();
              navigate(ROUTES.home);
            }}
            aria-label="Home"
          >
            <img
              className="brand-mark"
              src={publicUrl("favicon.svg")}
              width={28}
              height={28}
              alt=""
            />
            <h1>CS2 Analyzer</h1>
          </button>
          <SiteNav />
          <span className="pre-release" tabIndex={0}>
            [pre-release testing]
            <span className="pre-release-tip" role="tooltip">
              Changes may not be backward compatible. Notes saved in this browser might stop working
              after newer versions.
            </span>
          </span>
          {onLayouts ? (
            <span className="dev-badge" title="Development-only tool; not shipped in production">
              [dev]
            </span>
          ) : null}
        </div>
        <div className="top-center">
          {onLayouts ? (
            <span className="file-meta">Callout Layout Editor</span>
          ) : replay && showMatchChrome ? (
            <span className="file-meta">
              {prettyMap(replay.header.map_name)}
              {session.fileName ? ` · ${session.fileName}` : ""} · {replay.kills.length} kills ·{" "}
              {replay.grenades.length} nades
            </span>
          ) : null}
        </div>
        <div className="top-actions">
          {replay && showMatchChrome ? (
            <button type="button" className="ghost" onClick={session.close}>
              New demo
            </button>
          ) : null}
          {replay && showMatchChrome ? (
            <button
              type="button"
              className="ghost"
              disabled={aggregated}
              title={aggregated ? "Export CSV is per-demo; switch off Aggregated" : undefined}
              onClick={() => downloadCsv(replay, session.fileName)}
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
                <div className="settings-menu-section">
                  <p className="settings-menu-label">Notes</p>
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
                      setRemoveKind("notes");
                      setRemoveConfirm("");
                    }}
                  >
                    Remove notes
                  </button>
                </div>
                <div className="settings-menu-section">
                  <p className="settings-menu-label">Playbook</p>
                  <button
                    type="button"
                    className="ghost"
                    disabled={playbookCount === 0}
                    onClick={() => {
                      void exportPlaybooks().then((result) => {
                        if (result.ok) {
                          setPlaybookFlashError(null);
                          setPlaybookFlash(result.message);
                        } else {
                          setPlaybookFlash(null);
                          setPlaybookFlashError(result.message);
                        }
                      });
                    }}
                  >
                    Export playbooks
                  </button>
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => playbookImportRef.current?.click()}
                  >
                    Import playbooks
                  </button>
                  <input
                    ref={playbookImportRef}
                    type="file"
                    accept=".json,application/json"
                    hidden
                    aria-label="Import playbooks file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      void file.text().then(async (text) => {
                        const result = await importPlaybooksFromText(text);
                        if (result.ok) {
                          setPlaybookFlashError(null);
                          setPlaybookFlash(result.message);
                          setPlaybookCount(await countPlaybooks());
                        } else if (result.conflicts && result.bundle) {
                          setSettingsOpen(false);
                          setImportMerge({ conflicts: result.conflicts, bundle: result.bundle });
                        } else {
                          setPlaybookFlash(null);
                          setPlaybookFlashError(result.message);
                        }
                      });
                    }}
                  />
                  <button
                    type="button"
                    className="danger"
                    disabled={playbookCount === 0}
                    onClick={() => {
                      setSettingsOpen(false);
                      setRemoveKind("playbooks");
                      setRemoveConfirm("");
                    }}
                  >
                    Remove all playbooks
                  </button>
                  {playbookFlash ? <p className="settings-menu-flash">{playbookFlash}</p> : null}
                  {playbookFlashError ? (
                    <p className="settings-menu-flash is-error">{playbookFlashError}</p>
                  ) : null}
                </div>
                {import.meta.env.DEV && !onLayouts ? (
                  <div className="settings-menu-section">
                    <p className="settings-menu-label">Development</p>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setSettingsOpen(false);
                        navigate(ROUTES.layouts);
                      }}
                    >
                      Layouts editor
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {removeOpen ? (
        <div
          className="home-modal"
          onClick={() => {
            setRemoveKind(null);
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
            <h2 id={removeTitleId}>
              {removeKind === "playbooks" ? "Remove all playbooks?" : "Remove all saved notes?"}
            </h2>
            <p>
              {removeKind === "playbooks"
                ? "This deletes every playbook stored in this browser. Export a JSON backup first if you might need them later."
                : "This deletes every drawing project stored in this browser. Export a JSON backup first if you might need them later."}
            </p>
            <p>
              Type <code>{removePhrase}</code> to confirm.
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
                  setRemoveKind(null);
                  setRemoveConfirm("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                disabled={removeConfirm !== removePhrase}
                onClick={() => {
                  const kind = removeKind;
                  setRemoveKind(null);
                  setRemoveConfirm("");
                  if (kind === "playbooks") {
                    void deleteAllPlaybooks();
                    setPlaybookCount(0);
                  } else {
                    void review.removeAllNotes();
                  }
                }}
              >
                {removeKind === "playbooks" ? "Remove all playbooks" : "Remove all notes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {importMerge ? (
        <ImportMergeDialog
          conflicts={importMerge.conflicts}
          onCancel={() => setImportMerge(null)}
          onConfirm={(choices: ImportChoices) => {
            const bundle = importMerge.bundle;
            setImportMerge(null);
            void commitPlaybookImport(bundle, choices).then(async (result) => {
              if (result.ok) {
                setPlaybookFlashError(null);
                setPlaybookFlash(result.message);
                setPlaybookCount(await countPlaybooks());
              } else {
                setPlaybookFlash(null);
                setPlaybookFlashError(result.message);
              }
            });
          }}
        />
      ) : null}
    </>
  );
}
