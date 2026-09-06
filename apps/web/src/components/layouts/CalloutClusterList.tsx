import { useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import type { LayoutCallout, MapLayout } from "@/lib/layouts/types";
import { calloutColor } from "@/lib/layouts/layout";
import {
  canGroupIds,
  canUngroupIds,
  clusterCallouts,
  dropCalloutsOn,
  groupCallouts,
  groupLabel,
  idsForDrag,
  ungroupCallouts,
  type CalloutDropDest,
} from "@/lib/layouts/groups";
import {
  eventElement,
  isDragControl,
  lockCalloutDrag,
  parseDrag,
  unlockCalloutDrag,
  type CalloutDrag,
} from "@/lib/layouts/drag";
import { GroupNameField } from "@/components/layouts/GroupNameField";

interface Props {
  layout: MapLayout;
  selectedIds: string[];
  onSelectedIds: (ids: string[]) => void;
  onCallouts: (callouts: LayoutCallout[]) => void;
  onRenameGroup: (fromId: string, name: string) => void;
  onNudgeGroup: (id: string, delta: -1 | 1) => void;
}

export function CalloutClusterList({
  layout,
  selectedIds,
  onSelectedIds,
  onCallouts,
  onRenameGroup,
  onNudgeGroup,
}: Props) {
  const [open, setOpen] = useState<string[]>([]);
  const [dragging, setDragging] = useState<CalloutDrag | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const dragRef = useRef<CalloutDrag | null>(null);
  const skipClick = useRef(false);
  const dragged = useRef(false);
  const downOn = useRef<EventTarget | null>(null);
  const selected = selectedIds.filter((id) => layout.callouts.some((c) => c.id === id));
  const primary = selected[selected.length - 1] ?? null;
  const canGroup = canGroupIds(layout.callouts, selected);
  const canUngroup = canUngroupIds(layout.callouts, selected);
  const clusters = clusterCallouts(layout.callouts, layout.groups);
  const groupedIds = clusters.flatMap((c) => (c.group ? [c.group] : []));

  const startDrag = (e: ReactDragEvent, ids: string[]) => {
    if (isDragControl(downOn.current)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    dragged.current = false;
    skipClick.current = false;
    const payload: CalloutDrag = { ids };
    dragRef.current = payload;
    setDragging(payload);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
  };

  const endDrag = () => {
    skipClick.current = dragged.current;
    dragged.current = false;
    dragRef.current = null;
    setDragging(null);
    setDropOn(null);
    window.setTimeout(() => {
      skipClick.current = false;
    }, 80);
  };

  const dropAt = (e: ReactDragEvent, dest: CalloutDropDest) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = dragRef.current ?? parseDrag(e.dataTransfer.getData("text/plain"));
    if (!payload) {
      endDrag();
      return;
    }
    onCallouts(dropCalloutsOn(layout.callouts, payload.ids, dest));
    onSelectedIds([]);
    endDrag();
  };

  const allowDrop = (e: ReactDragEvent, key: string, ok: boolean) => {
    if (!ok) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dropOn !== key) setDropOn(key);
  };

  const toggle = (id: string) => {
    onSelectedIds(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };

  const toggleAll = (ids: string[]) => {
    const allOn = ids.every((id) => selected.includes(id));
    if (allOn) onSelectedIds(selected.filter((id) => !ids.includes(id)));
    else onSelectedIds([...new Set([...selected, ...ids])]);
  };

  return (
    <div
      className={dragging ? "callouts-dragging" : undefined}
      onPointerDownCapture={(e) => {
        downOn.current = eventElement(e.target) ?? e.target;
      }}
    >
      <h2>Callouts</h2>
      <p className="muted">
        Ctrl+click to multi-select. G groups, U ungroups (two or more). Drag onto a group, the top
        slot to ungroup, or the bottom slot to make a new group. Double-click a group name to
        rename. Use ↑↓ on a group to set Action / Util chip order.
      </p>
      {layout.callouts.length === 0 ? (
        <p className="muted">
          Polygon: click vertices, Enter to close. Rect/circle: click and drag.
        </p>
      ) : (
        <>
          <div className="callout-actions">
            <button
              type="button"
              disabled={!canGroup}
              title="Group (G)"
              onClick={() => {
                onCallouts(groupCallouts(layout.callouts, selected));
                onSelectedIds([]);
              }}
            >
              Group
            </button>
            <button
              type="button"
              disabled={!canUngroup}
              title="Ungroup (U)"
              onClick={() => {
                onCallouts(ungroupCallouts(layout.callouts, selected));
                onSelectedIds([]);
              }}
            >
              Ungroup
            </button>
          </div>
          <div
            className={`callout-drop-slot${dropOn === "out" ? " on" : ""}`}
            onDragOver={(e) => allowDrop(e, "out", true)}
            onDrop={(e) => dropAt(e, { kind: "ungroup" })}
          >
            Drop at top to ungroup
          </div>
          {clusters.map((cluster) => {
            const groupId = cluster.group;
            const memberIds = cluster.callouts.map((c) => c.id);
            const foldedAway = groupId != null && !open.includes(groupId);
            const dropKey = `g-${groupId ?? "loose"}`;
            const groupIndex = groupId ? groupedIds.indexOf(groupId) : -1;
            return (
              <div
                key={cluster.group ?? "loose"}
                className={`callout-cluster${cluster.group ? "" : " callout-loose"}${
                  dropOn === dropKey ? " callout-drop" : ""
                }`}
                draggable={Boolean(cluster.group)}
                onPointerDownCapture={(e) => {
                  lockCalloutDrag(e.currentTarget, e.target, Boolean(cluster.group));
                }}
                onPointerUp={(e) => unlockCalloutDrag(e.currentTarget, Boolean(cluster.group))}
                onPointerCancel={(e) => unlockCalloutDrag(e.currentTarget, Boolean(cluster.group))}
                onDragStart={(e) => {
                  if (!cluster.group) return;
                  startDrag(e, memberIds);
                }}
                onDrag={() => {
                  dragged.current = true;
                }}
                onDragEnd={(e) => {
                  unlockCalloutDrag(e.currentTarget, Boolean(cluster.group));
                  endDrag();
                }}
                onDragOver={(e) => {
                  if (!cluster.group) return;
                  const ids = dragRef.current?.ids ?? [];
                  const self =
                    ids.length === memberIds.length && memberIds.every((id) => ids.includes(id));
                  allowDrop(e, dropKey, !self);
                }}
                onDrop={(e) => {
                  if (cluster.group) dropAt(e, { kind: "into", group: cluster.group });
                }}
              >
                {groupId ? (
                  <div
                    className="callout-cluster-head"
                    onDragOver={(e) => {
                      const ids = dragRef.current?.ids ?? [];
                      const self =
                        ids.length === memberIds.length &&
                        memberIds.every((id) => ids.includes(id));
                      allowDrop(e, dropKey, !self);
                    }}
                    onDrop={(e) => {
                      dropAt(e, { kind: "into", group: groupId });
                    }}
                  >
                    <button
                      type="button"
                      className="callout-cluster-fold"
                      draggable={false}
                      aria-expanded={!foldedAway}
                      aria-label={foldedAway ? "Show group members" : "Hide group members"}
                      title={foldedAway ? "Show group members" : "Hide group members"}
                      onClick={() => {
                        setOpen((cur) =>
                          cur.includes(groupId)
                            ? cur.filter((name) => name !== groupId)
                            : [...cur, groupId],
                        );
                      }}
                    >
                      {foldedAway ? "▸" : "▾"}
                    </button>
                    <label className="callout-pick">
                      <input
                        type="checkbox"
                        checked={memberIds.every((id) => selected.includes(id))}
                        onChange={() => toggleAll(memberIds)}
                        aria-label={`Select ${groupLabel(groupId)}`}
                      />
                    </label>
                    <GroupNameField key={groupId} groupId={groupId} onRenameGroup={onRenameGroup} />
                    <span className="callout-cluster-count">{cluster.callouts.length}</span>
                    <span className="callout-cluster-order">
                      <button
                        type="button"
                        className="callout-cluster-nudge"
                        draggable={false}
                        disabled={groupIndex <= 0}
                        aria-label={`Move ${groupLabel(groupId)} up`}
                        title="Move group up"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNudgeGroup(groupId, -1);
                        }}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="callout-cluster-nudge"
                        draggable={false}
                        disabled={groupIndex >= groupedIds.length - 1}
                        aria-label={`Move ${groupLabel(groupId)} down`}
                        title="Move group down"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNudgeGroup(groupId, 1);
                        }}
                      >
                        ↓
                      </button>
                    </span>
                  </div>
                ) : null}
                {!foldedAway && (
                  <ul className="callout-list">
                    {cluster.callouts.map((c) => (
                      <li
                        key={c.id}
                        className={`callout-row${selected.includes(c.id) ? " on" : ""}`}
                        draggable
                        onDragStart={(e) => startDrag(e, idsForDrag(c.id, selected))}
                        onDrag={() => {
                          dragged.current = true;
                        }}
                        onDragEnd={endDrag}
                      >
                        <label className="callout-pick">
                          <input
                            type="checkbox"
                            checked={selected.includes(c.id)}
                            onChange={() => toggle(c.id)}
                            aria-label={`Select ${c.name}`}
                          />
                        </label>
                        <div
                          className={
                            selected.includes(c.id)
                              ? c.id === primary
                                ? "pick on"
                                : "pick selected"
                              : "pick"
                          }
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            if (skipClick.current) {
                              skipClick.current = false;
                              return;
                            }
                            if (e.ctrlKey || e.metaKey) {
                              e.preventDefault();
                              toggle(c.id);
                              return;
                            }
                            onSelectedIds([c.id]);
                          }}
                          onKeyDown={(e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            onSelectedIds([c.id]);
                          }}
                          style={{ borderLeftColor: calloutColor(c.id) }}
                        >
                          <span>{c.name}</span>
                          <span className="muted">{c.floor === "lower" ? "lower" : "upper"}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
          <div
            className={`callout-drop-slot${dropOn === "new" ? " on" : ""}`}
            onDragOver={(e) => allowDrop(e, "new", true)}
            onDrop={(e) => dropAt(e, { kind: "new-group" })}
          >
            Drop at bottom to make a new group
          </div>
        </>
      )}
    </div>
  );
}
