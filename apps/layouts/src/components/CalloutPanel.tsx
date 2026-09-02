import type { LayoutCallout, MapLayout } from "@/lib/types";
import { CalloutClusterList } from "@/components/CalloutClusterList";
import { CalloutSelected } from "@/components/CalloutSelected";

interface Props {
  layout: MapLayout;
  selectedIds: string[];
  jsonText: string;
  jsonError: string | null;
  dirty: boolean;
  saveNote: string | null;
  onSelectedIds: (ids: string[]) => void;
  onCallouts: (callouts: LayoutCallout[]) => void;
  onRename: (id: string, name: string) => void;
  onRenameGroup: (fromId: string, name: string) => void;
  onNudge: (id: string, delta: -1 | 1) => void;
  onNudgeGroup: (id: string, delta: -1 | 1) => void;
  onDelete: (ids: string[]) => void;
  onRemoveRegion: (id: string, regionIndex: number) => void;
  onJsonText: (text: string) => void;
  onApplyJson: () => void;
  onSave: () => void;
  onDownload: () => void;
  onImportFile: (file: File) => void;
}

export function CalloutPanel({
  layout,
  selectedIds,
  jsonText,
  jsonError,
  dirty,
  saveNote,
  onSelectedIds,
  onCallouts,
  onRename,
  onRenameGroup,
  onNudge,
  onNudgeGroup,
  onDelete,
  onRemoveRegion,
  onJsonText,
  onApplyJson,
  onSave,
  onDownload,
  onImportFile,
}: Props) {
  const selected = selectedIds.filter((id) => layout.callouts.some((c) => c.id === id));
  const primary = selected[selected.length - 1] ?? null;
  const selectedCallout = layout.callouts.find((c) => c.id === primary) ?? null;
  const selectedIndex = selectedCallout
    ? layout.callouts.findIndex((c) => c.id === selectedCallout.id)
    : -1;

  return (
    <aside className="panel">
      <div className="panel-actions">
        <button type="button" className="primary" disabled={!dirty} onClick={onSave}>
          Save to folder
        </button>
        <button type="button" onClick={onDownload}>
          Download
        </button>
        <label className="import">
          Import
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      {saveNote ? <p className="save-note">{saveNote}</p> : null}
      {dirty ? (
        <p className="muted">
          Unsaved — Save to folder writes apps/web/public/layouts/{layout.map}.json
        </p>
      ) : null}

      <CalloutClusterList
        layout={layout}
        selectedIds={selectedIds}
        onSelectedIds={onSelectedIds}
        onCallouts={onCallouts}
        onRenameGroup={onRenameGroup}
        onNudgeGroup={onNudgeGroup}
      />

      {selectedCallout ? (
        <CalloutSelected
          callout={selectedCallout}
          selectedIds={selected}
          selectedIndex={selectedIndex}
          calloutCount={layout.callouts.length}
          onRename={onRename}
          onNudge={onNudge}
          onDelete={onDelete}
          onRemoveRegion={onRemoveRegion}
        />
      ) : null}

      <h2>JSON</h2>
      <textarea
        className="json"
        spellCheck={false}
        value={jsonText}
        onChange={(e) => onJsonText(e.target.value)}
      />
      {jsonError ? <p className="error">{jsonError}</p> : null}
      <button type="button" onClick={onApplyJson}>
        Apply JSON
      </button>
    </aside>
  );
}
