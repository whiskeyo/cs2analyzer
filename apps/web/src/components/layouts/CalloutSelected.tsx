import type { LayoutCallout } from "@/lib/layouts/types";
import { calloutShapeSummary, regionLabel } from "@/lib/layouts/layout";

export function CalloutSelected({
  callout,
  selectedIds,
  selectedIndex,
  calloutCount,
  onRename,
  onNudge,
  onDelete,
  onRemoveRegion,
}: {
  callout: LayoutCallout;
  selectedIds: string[];
  selectedIndex: number;
  calloutCount: number;
  onRename: (id: string, name: string) => void;
  onNudge: (id: string, delta: -1 | 1) => void;
  onDelete: (ids: string[]) => void;
  onRemoveRegion: (id: string, regionIndex: number) => void;
}) {
  return (
    <div className="selected">
      <label>
        Name
        <input value={callout.name} onChange={(e) => onRename(callout.id, e.target.value)} />
      </label>
      <div className="selected-order">
        <button type="button" disabled={selectedIndex <= 0} onClick={() => onNudge(callout.id, -1)}>
          ↑
        </button>
        <button
          type="button"
          disabled={selectedIndex < 0 || selectedIndex >= calloutCount - 1}
          onClick={() => onNudge(callout.id, 1)}
        >
          ↓
        </button>
        <span className="muted">List order</span>
      </div>
      <p className="muted">
        {callout.floor === "lower" ? "Lower" : "Upper"} · {callout.id}
      </p>
      <p className="muted">
        {calloutShapeSummary(callout)}
        {selectedIds.length === 1 ? " — draw another shape to add a disconnected area" : ""}
      </p>
      {callout.regions.length > 1 ? (
        <ul className="callout-regions">
          {callout.regions.map((region, i) => (
            <li key={`${callout.id}-r${i}`}>
              <span>{regionLabel(region)}</span>
              <button
                type="button"
                className="danger"
                onClick={() => onRemoveRegion(callout.id, i)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="danger" onClick={() => onDelete(selectedIds)}>
        Delete
      </button>
    </div>
  );
}
