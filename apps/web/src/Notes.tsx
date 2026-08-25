import { useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";
import { NOTE_GROUP_NAME_MAX, NOTE_MOMENT_STEP_SECONDS, tickRate } from "./constants";
import {
  canGroupIndexes,
  clearMomentWindow,
  clusterNoteRound,
  dropStrokesOn,
  groupLabel,
  groupStrokes,
  looseDrawingIndexes,
  notesByRound,
  overlayJumpTick,
  overlayWindow,
  renameGroup,
  setMomentClockEdge,
  setMomentEdge,
  setStrokesHidden,
  squashLooseDrawings,
  squashStrokes,
  strokeTitle,
  ungroupStrokes,
  type NoteDropDest,
} from "./overlay";
import { roundClock } from "./roundEvents";
import { roundScrubRange } from "./roundTimeline";
import type { Replay, Round, Stroke } from "./types";

interface Props {
  replay: Replay;
  tick: number;
  strokes: Stroke[];
  onJump: (tick: number) => void;
  onStrokes: (next: Stroke[]) => void;
}

interface NoteDrag {
  round: number;
  indexes: number[];
}

function indexesForDrag(index: number, selected: number[], strokes: Stroke[]): number[] {
  if (selected.includes(index)) {
    const round = strokes[index]?.round;
    return selected.filter((i) => strokes[i]?.round === round);
  }
  return [index];
}

function eventElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof Node) return target.parentElement;
  return null;
}

function isDragControl(target: EventTarget | null): boolean {
  const el = eventElement(target);
  if (!el) return false;
  return Boolean(
    el.closest(
      "input, textarea, select, label.note-pick, .note-io, .note-eye, .note-cluster-fold, .note-cluster-count",
    ),
  );
}

function setRowsDraggable(cluster: HTMLElement, on: boolean) {
  cluster.querySelectorAll<HTMLElement>(".note-row").forEach((row) => {
    row.draggable = on;
  });
}

/** Freeze folder vs row before HTML5's move threshold, so a downward grab still picks up the box. */
function lockNoteDrag(cluster: HTMLElement, target: EventTarget | null, folder: boolean) {
  const el = eventElement(target);
  if (isDragControl(el)) return;
  const row = el?.closest(".note-row");
  if (row instanceof HTMLElement && cluster.contains(row)) {
    cluster.draggable = false;
    setRowsDraggable(cluster, false);
    row.draggable = true;
    return;
  }
  if (!folder) return;
  cluster.draggable = true;
  setRowsDraggable(cluster, false);
}

function unlockNoteDrag(cluster: HTMLElement, folder: boolean) {
  cluster.draggable = folder;
  setRowsDraggable(cluster, true);
}

function parseDrag(raw: string): NoteDrag | null {
  try {
    const v = JSON.parse(raw) as NoteDrag;
    if (typeof v.round === "number" && Array.isArray(v.indexes)) return v;
  } catch {
    return null;
  }
  return null;
}

function roundWindowEnd(rnd: Round | undefined, replay: Replay): number {
  const fallback =
    replay.header.playback_ticks || replay.ticks.ticks[replay.ticks.ticks.length - 1] || 0;
  return roundScrubRange(rnd, replay.rounds, {
    min: rnd?.start_tick ?? 0,
    max: fallback,
  }).max;
}

function MomentEdgeField({
  label,
  seconds,
  maxSeconds,
  clock,
  onChange,
  onPlayhead,
}: {
  label: string;
  seconds: number;
  maxSeconds: number;
  clock: string;
  onChange: (seconds: number) => void;
  onPlayhead: () => void;
}) {
  const sec = Math.round(seconds);
  const cap = maxSeconds > 0 ? maxSeconds : Number.POSITIVE_INFINITY;
  const nudge = (dir: number) => {
    onChange(Math.min(cap, Math.max(0, sec + dir * NOTE_MOMENT_STEP_SECONDS)));
  };
  return (
    <span className="note-edge">
      <span className="note-edge-label">{label}</span>
      <span className="note-clock">
        <button
          type="button"
          className="note-clock-read"
          title={`${clock} — double-click sets the playhead`}
          onDoubleClick={(e) => {
            e.preventDefault();
            onPlayhead();
          }}
        >
          {clock}
        </button>
        <span className="note-clock-spin">
          <button
            type="button"
            aria-label={`${label} later`}
            title="Later"
            onClick={() => nudge(1)}
          >
            ▲
          </button>
          <button
            type="button"
            aria-label={`${label} earlier`}
            title="Earlier"
            onClick={() => nudge(-1)}
          >
            ▼
          </button>
        </span>
      </span>
    </span>
  );
}

function MomentInOut({
  win,
  round,
  tps,
  roundEndTick,
  onSetEdge,
  onClear,
  onClockEdge,
}: {
  win: { start: number; end: number } | null;
  round: Round | undefined;
  tps: number;
  roundEndTick: number;
  onSetEdge: (edge: "start" | "end") => void;
  onClear: () => void;
  onClockEdge: (edge: "start" | "end", seconds: number) => void;
}) {
  const origin = round ? round.freeze_end_tick || round.start_tick : 0;
  const start = win?.start ?? origin;
  const end = win?.end ?? (roundEndTick > origin ? roundEndTick : origin);
  const maxSeconds = tps > 0 && roundEndTick > origin ? (roundEndTick - origin) / tps : 0;
  const startSec = tps > 0 ? Math.max(0, (start - origin) / tps) : 0;
  const endSec = tps > 0 ? Math.max(0, (end - origin) / tps) : 0;
  return (
    <span className="note-io">
      <MomentEdgeField
        label="Start"
        seconds={startSec}
        maxSeconds={maxSeconds}
        clock={round ? roundClock(round, start, tps) : "In"}
        onChange={(seconds) => onClockEdge("start", seconds)}
        onPlayhead={() => onSetEdge("start")}
      />
      <MomentEdgeField
        label="End"
        seconds={endSec}
        maxSeconds={maxSeconds}
        clock={round ? roundClock(round, end, tps) : "Out"}
        onChange={(seconds) => onClockEdge("end", seconds)}
        onPlayhead={() => onSetEdge("end")}
      />
      {win && (
        <button type="button" title="Show for the whole round" onClick={onClear}>
          Round
        </button>
      )}
    </span>
  );
}

function GroupNameField({
  groupId,
  strokes,
  onStrokes,
}: {
  groupId: string;
  strokes: Stroke[];
  onStrokes: (next: Stroke[]) => void;
}) {
  const shown = groupLabel(groupId);
  const [draft, setDraft] = useState(shown);
  const [editing, setEditing] = useState(false);
  const skipBlur = useRef(false);

  const commit = () => {
    if (skipBlur.current) {
      skipBlur.current = false;
      setEditing(false);
      return;
    }
    const next = draft.trim();
    setEditing(false);
    if (!next) {
      setDraft(shown);
      return;
    }
    if (next === groupId || next === shown) {
      setDraft(shown);
      return;
    }
    onStrokes(renameGroup(strokes, groupId, next));
  };

  if (!editing) {
    return (
      <span
        className="note-group-name"
        title="Double-click to rename"
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setDraft(shown);
          setEditing(true);
        }}
      >
        {shown}
      </span>
    );
  }

  return (
    <input
      className="note-group-name"
      value={draft}
      maxLength={NOTE_GROUP_NAME_MAX}
      aria-label="Layer name"
      draggable={false}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          skipBlur.current = true;
          setDraft(shown);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function Notes({ replay, tick, strokes, onJump, onStrokes }: Props) {
  const rounds = useMemo(() => notesByRound(strokes), [strokes]);
  const tps = tickRate(replay);
  const [picked, setPicked] = useState<number[]>([]);
  const [open, setOpen] = useState<string[]>([]);
  const [dragging, setDragging] = useState<NoteDrag | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const dragRef = useRef<NoteDrag | null>(null);
  const skipClick = useRef(false);
  const dragged = useRef(false);
  const downOn = useRef<EventTarget | null>(null);
  const selected = picked.filter((i) => strokes[i] != null);
  const canGroup = canGroupIndexes(strokes, selected);
  const canUngroup = selected.some((i) => strokes[i]?.group);

  const startDrag = (e: ReactDragEvent, round: number, indexes: number[]) => {
    if (isDragControl(downOn.current)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.stopPropagation();
    dragged.current = false;
    skipClick.current = false;
    const payload: NoteDrag = { round, indexes };
    dragRef.current = payload;
    setDragging(payload);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
  };

  const markDrag = () => {
    dragged.current = true;
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

  const dropAt = (e: ReactDragEvent, dest: NoteDropDest) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = dragRef.current ?? parseDrag(e.dataTransfer.getData("text/plain"));
    if (!payload || payload.round !== dest.round) {
      endDrag();
      return;
    }
    onStrokes(dropStrokesOn(strokes, payload.indexes, dest));
    setPicked([]);
    endDrag();
  };

  const allowDrop = (e: ReactDragEvent, key: string, sameRound: boolean) => {
    if (!dragRef.current || !sameRound) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dropOn !== key) setDropOn(key);
  };

  const toggle = (index: number) => {
    setPicked((cur) => (cur.includes(index) ? cur.filter((i) => i !== index) : [...cur, index]));
  };

  const toggleAll = (indexes: number[]) => {
    setPicked((cur) => {
      const allOn = indexes.every((i) => cur.includes(i));
      if (allOn) return cur.filter((i) => !indexes.includes(i));
      return [...new Set([...cur, ...indexes])];
    });
  };

  const setEdge = (index: number, edge: "start" | "end", rnd: Round | undefined) => {
    onStrokes(
      setMomentEdge(
        strokes,
        index,
        edge,
        tick,
        rnd?.start_tick ?? 0,
        roundWindowEnd(rnd, replay),
        tps,
      ),
    );
  };

  const setClock = (
    index: number,
    edge: "start" | "end",
    seconds: number,
    rnd: Round | undefined,
  ) => {
    const origin = rnd ? rnd.freeze_end_tick || rnd.start_tick : 0;
    onStrokes(
      setMomentClockEdge(
        strokes,
        index,
        edge,
        seconds,
        origin,
        rnd?.start_tick ?? 0,
        roundWindowEnd(rnd, replay),
        tps,
      ),
    );
  };

  if (rounds.length === 0) {
    return (
      <p className="muted tab-hint">
        Draw or add a text box on the radar. Use Moment to time it. Squash drawings into a layer so
        the list stays short.
      </p>
    );
  }

  return (
    <div
      className={`review${dragging ? " notes-dragging" : ""}`}
      onPointerDownCapture={(e) => {
        downOn.current = eventElement(e.target) ?? e.target;
      }}
    >
      <p className="tab-hint">
        Drag a layer or a note. Drop on the top slot to ungroup, on the bottom slot to make a new
        group, or onto a layer box to add it there. Double-click a layer name to rename. Start/End
        clocks use the arrows (0:59 then 1:00). Double-click a clock to pin it to the playhead. The
        eye hides a note on the radar.
      </p>
      <div className="notes-actions">
        <button
          type="button"
          disabled={!canGroup}
          onClick={() => {
            onStrokes(squashStrokes(strokes, selected));
            setPicked([]);
          }}
        >
          Squash
        </button>
        <button
          type="button"
          disabled={!canGroup}
          onClick={() => {
            onStrokes(groupStrokes(strokes, selected));
            setPicked([]);
          }}
        >
          Group
        </button>
        <button
          type="button"
          disabled={!canUngroup}
          onClick={() => {
            onStrokes(ungroupStrokes(strokes, selected));
            setPicked([]);
          }}
        >
          Ungroup
        </button>
      </div>
      {rounds.map((g) => {
        const rnd = replay.rounds.find((r) => r.number === g.round);
        const windowEnd = roundWindowEnd(rnd, replay);
        const jump = rnd ? overlayJumpTick(strokes, rnd) : 0;
        const clusters = clusterNoteRound(g.items);
        const looseDraw = looseDrawingIndexes(strokes, g.round);
        const sameRound = dragging?.round === g.round;
        return (
          <div key={g.round} className="notes-round">
            <div className="notes-round-head">
              <p className="notes-round-label">{rnd?.is_knife ? "Knife" : `Round ${g.round}`}</p>
              {looseDraw.length >= 2 && (
                <button
                  type="button"
                  onClick={() => onStrokes(squashLooseDrawings(strokes, g.round))}
                >
                  Squash drawings
                </button>
              )}
            </div>
            {sameRound && (
              <div
                className={`note-drop-slot${dropOn === `out-${g.round}` ? " on" : ""}`}
                onDragOver={(e) => allowDrop(e, `out-${g.round}`, true)}
                onDrop={(e) => dropAt(e, { round: g.round, kind: "ungroup" })}
              >
                Drop at top to ungroup
              </div>
            )}
            {clusters.map((cluster) => {
              const foldedAway = cluster.group != null && !open.includes(cluster.group);
              const memberIdx = cluster.items.map((item) => item.index);
              const head = cluster.items[0];
              const headStroke = head?.stroke;
              const win = headStroke ? overlayWindow(headStroke, strokes) : null;
              const at = win?.start ?? rnd?.freeze_end_tick ?? rnd?.start_tick ?? jump;
              const dropKey = `g-${g.round}-${cluster.group ?? "loose"}`;
              const groupHidden =
                cluster.group != null && cluster.items.every((item) => item.stroke.hidden);
              const draggingThisLayer =
                cluster.group != null &&
                dragging != null &&
                dragging.indexes.length === memberIdx.length &&
                memberIdx.every((i) => dragging.indexes.includes(i));
              const canDropInto = Boolean(cluster.group) && sameRound && !draggingThisLayer;
              return (
                <div
                  key={cluster.group ?? "loose"}
                  className={`note-cluster${cluster.group ? "" : " note-loose"}${
                    dropOn === dropKey && canDropInto ? " note-drop" : ""
                  }`}
                  draggable={Boolean(cluster.group)}
                  onPointerDownCapture={(e) => {
                    lockNoteDrag(e.currentTarget, e.target, Boolean(cluster.group));
                  }}
                  onPointerUp={(e) => unlockNoteDrag(e.currentTarget, Boolean(cluster.group))}
                  onPointerCancel={(e) => unlockNoteDrag(e.currentTarget, Boolean(cluster.group))}
                  onDragStart={(e) => {
                    if (!cluster.group) return;
                    startDrag(e, g.round, memberIdx);
                  }}
                  onDrag={markDrag}
                  onDragEnd={(e) => {
                    unlockNoteDrag(e.currentTarget, Boolean(cluster.group));
                    endDrag();
                  }}
                  onDragOver={(e) => {
                    if (cluster.group) allowDrop(e, dropKey, canDropInto);
                  }}
                  onDrop={(e) => {
                    if (cluster.group) {
                      dropAt(e, { round: g.round, kind: "into", group: cluster.group });
                    }
                  }}
                >
                  {cluster.group && head && (
                    <div
                      className="note-cluster-head"
                      onDragOver={(e) => allowDrop(e, dropKey, canDropInto)}
                      onDrop={(e) => {
                        if (cluster.group) {
                          dropAt(e, { round: g.round, kind: "into", group: cluster.group });
                        }
                      }}
                    >
                      <button
                        type="button"
                        className="note-cluster-fold"
                        aria-expanded={!foldedAway}
                        aria-label={foldedAway ? "Show layer members" : "Hide layer members"}
                        title={foldedAway ? "Show layer members" : "Hide layer members"}
                        onClick={() => {
                          const id = cluster.group;
                          if (!id) return;
                          setOpen((cur) =>
                            cur.includes(id) ? cur.filter((name) => name !== id) : [...cur, id],
                          );
                        }}
                      >
                        {foldedAway ? "▸" : "▾"}
                      </button>
                      <label className="note-pick">
                        <input
                          type="checkbox"
                          checked={memberIdx.every((i) => selected.includes(i))}
                          onChange={() => toggleAll(memberIdx)}
                          aria-label={`Select ${groupLabel(cluster.group)}`}
                        />
                      </label>
                      <GroupNameField
                        key={cluster.group}
                        groupId={cluster.group}
                        strokes={strokes}
                        onStrokes={onStrokes}
                      />
                      <button
                        type="button"
                        className="note-cluster-count"
                        title="Jump to layer"
                        onClick={() => onJump(at)}
                      >
                        {cluster.items.length}
                      </button>
                      <label
                        className={`note-eye${groupHidden ? " off" : ""}`}
                        title={groupHidden ? "Show layer on radar" : "Hide layer on radar"}
                      >
                        <input
                          type="checkbox"
                          checked={!groupHidden}
                          aria-label={groupHidden ? "Show layer on radar" : "Hide layer on radar"}
                          onChange={() =>
                            onStrokes(setStrokesHidden(strokes, memberIdx, !groupHidden))
                          }
                        />
                        {groupHidden ? "○" : "●"}
                      </label>
                    </div>
                  )}
                  {cluster.group && head && (
                    <div className="note-cluster-io">
                      <MomentInOut
                        win={win}
                        round={rnd}
                        tps={tps}
                        roundEndTick={windowEnd}
                        onSetEdge={(edge) => setEdge(head.index, edge, rnd)}
                        onClear={() => onStrokes(clearMomentWindow(strokes, head.index))}
                        onClockEdge={(edge, seconds) => setClock(head.index, edge, seconds, rnd)}
                      />
                    </div>
                  )}
                  {!foldedAway && (
                    <ul className="review-notes">
                      {cluster.items.map(({ index, stroke: st }) => {
                        const itemWin = overlayWindow(st, strokes);
                        const itemAt =
                          itemWin?.start ?? rnd?.freeze_end_tick ?? rnd?.start_tick ?? jump;
                        return (
                          <li
                            key={index}
                            className={`note-row${selected.includes(index) ? " on" : ""}${
                              st.hidden ? " dim" : ""
                            }`}
                            draggable
                            onDragStart={(e) =>
                              startDrag(e, g.round, indexesForDrag(index, selected, strokes))
                            }
                            onDrag={markDrag}
                            onDragEnd={endDrag}
                          >
                            <label className="note-pick">
                              <input
                                type="checkbox"
                                checked={selected.includes(index)}
                                onChange={() => toggle(index)}
                                aria-label={`Select ${strokeTitle(st)}`}
                              />
                            </label>
                            <div
                              className="review-note"
                              role="button"
                              tabIndex={0}
                              aria-label={strokeTitle(st)}
                              onClick={() => {
                                if (skipClick.current) {
                                  skipClick.current = false;
                                  return;
                                }
                                onJump(itemAt);
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter" && e.key !== " ") return;
                                e.preventDefault();
                                onJump(itemAt);
                              }}
                            >
                              <span className="note-swatch" style={{ background: st.color }} />
                              <span className="review-copy">
                                <span className="review-title">{strokeTitle(st)}</span>
                                <span className="review-detail">
                                  {rnd ? `${roundClock(rnd, itemAt, tps)} · ` : ""}
                                  {itemWin ? "Moment" : "Whole round"}
                                  {st.hidden ? " · Hidden" : ""}
                                </span>
                              </span>
                            </div>
                            <label
                              className={`note-eye${st.hidden ? " off" : ""}`}
                              title={st.hidden ? "Show on radar" : "Hide on radar"}
                            >
                              <input
                                type="checkbox"
                                checked={!st.hidden}
                                aria-label={st.hidden ? "Show on radar" : "Hide on radar"}
                                onChange={() =>
                                  onStrokes(setStrokesHidden(strokes, [index], !st.hidden))
                                }
                              />
                              {st.hidden ? "○" : "●"}
                            </label>
                            {cluster.group == null && (
                              <MomentInOut
                                win={itemWin}
                                round={rnd}
                                tps={tps}
                                roundEndTick={windowEnd}
                                onSetEdge={(edge) => setEdge(index, edge, rnd)}
                                onClear={() => onStrokes(clearMomentWindow(strokes, index))}
                                onClockEdge={(edge, seconds) => setClock(index, edge, seconds, rnd)}
                              />
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
            {sameRound && (
              <div
                className={`note-drop-slot${dropOn === `new-${g.round}` ? " on" : ""}`}
                onDragOver={(e) => allowDrop(e, `new-${g.round}`, true)}
                onDrop={(e) => dropAt(e, { round: g.round, kind: "new-group" })}
              >
                Drop at bottom to make a new group
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
