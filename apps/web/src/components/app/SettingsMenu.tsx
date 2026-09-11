import { useEffect, useId, useRef, useState } from "react";
import { ImportNotesButton } from "@/components/sidebar/ImportNotesButton";
import { useApp } from "@/lib/state/appState";
import { useNavigate } from "react-router";
import { ROUTES, usePathname } from "@/lib/app/devNavigate";
import { isLayoutsPath } from "@/lib/app/routes";
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
import { RemoveConfirmDialog, type RemoveKind } from "./RemoveConfirmDialog";
import { UserSettingsModal } from "./UserSettingsModal";

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

/** Gear menu: notes and playbook import/export, plus the confirm/merge dialogs. */
export function SettingsMenu() {
  const { session, review, onFiles } = useApp();
  const replay = session.replay;
  const canExportNotes = replay != null || review.saved.length > 0;
  const canRemoveNotes = review.saved.length > 0;

  const navigate = useNavigate();
  const pathname = usePathname();
  const onLayouts = import.meta.env.DEV && isLayoutsPath(pathname);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [removeKind, setRemoveKind] = useState<RemoveKind | null>(null);
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
              <p className="settings-menu-label">App</p>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setSettingsOpen(false);
                  setPrefsOpen(true);
                }}
              >
                Preferences
              </button>
            </div>
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
      {prefsOpen ? <UserSettingsModal onClose={() => setPrefsOpen(false)} /> : null}
      {removeKind ? (
        <RemoveConfirmDialog
          kind={removeKind}
          confirm={removeConfirm}
          titleId={removeTitleId}
          onConfirmChange={setRemoveConfirm}
          onCancel={() => {
            setRemoveKind(null);
            setRemoveConfirm("");
          }}
          onConfirm={() => {
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
        />
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
