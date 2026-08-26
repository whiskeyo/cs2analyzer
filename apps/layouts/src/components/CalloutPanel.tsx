import type { LayoutCallout, MapLayout } from "@/lib/types";
import { calloutColor } from "@/lib/layout";

interface Props {
  layout: MapLayout;
  selectedId: string | null;
  jsonText: string;
  jsonError: string | null;
  dirty: boolean;
  saveNote: string | null;
  onSelect: (id: string | null) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onJsonText: (text: string) => void;
  onApplyJson: () => void;
  onSave: () => void;
  onDownload: () => void;
  onImportFile: (file: File) => void;
}

export function CalloutPanel({
  layout,
  selectedId,
  jsonText,
  jsonError,
  dirty,
  saveNote,
  onSelect,
  onRename,
  onDelete,
  onJsonText,
  onApplyJson,
  onSave,
  onDownload,
  onImportFile,
}: Props) {
  const selected = layout.callouts.find((c) => c.id === selectedId) ?? null;
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

      <h2>Callouts</h2>
      {layout.callouts.length === 0 ? (
        <p className="muted">
          Polygon: click vertices, Enter to close. Rect/circle: click and drag.
        </p>
      ) : (
        <ul className="callout-list">
          {layout.callouts.map((c) => (
            <CalloutRow
              key={c.id}
              callout={c}
              selected={c.id === selectedId}
              onSelect={() => onSelect(c.id)}
            />
          ))}
        </ul>
      )}

      {selected ? (
        <div className="selected">
          <label>
            Name
            <input value={selected.name} onChange={(e) => onRename(selected.id, e.target.value)} />
          </label>
          <p className="muted">
            {selected.floor === "lower" ? "Lower" : "Upper"} · {selected.polygon.length} vertices ·{" "}
            {selected.id}
          </p>
          <button type="button" className="danger" onClick={() => onDelete(selected.id)}>
            Delete
          </button>
        </div>
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

function CalloutRow({
  callout,
  selected,
  onSelect,
}: {
  callout: LayoutCallout;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        className={selected ? "on" : undefined}
        onClick={onSelect}
        style={{ borderLeftColor: calloutColor(callout.id) }}
      >
        <span>{callout.name}</span>
        <span className="muted">{callout.floor === "lower" ? "lower" : "upper"}</span>
      </button>
    </li>
  );
}
