import { useState } from "react";
import type { DragEvent as ReactDragEvent, MutableRefObject } from "react";
import { roundClock } from "@/lib/match/roundEvents";
import {
  clusterNoteRound,
  groupLabel,
  looseDrawingIndexes,
  overlayJumpTick,
  overlayWindow,
  removeStrokesAt,
  setStrokesHidden,
  squashLooseDrawings,
  strokeTitle,
  strokeWindowKind,
  type NoteDropDest,
  type NoteRound,
} from "@/lib/notes";
import { indexesForDrag, lockNoteDrag, unlockNoteDrag, type NoteDrag } from "@/lib/notes/drag";
import { MomentInOut, roundWindowEnd } from "@/components/sidebar/NoteClocks";
import { BookmarkTitleField } from "./BookmarkTitleField";
import { GroupNameField } from "./GroupNameField";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import type { Stroke } from "@/lib/notes/types";

interface NoteRoundListProps {
  replay: Replay;
  rounds: NoteRound[];
  strokes: Stroke[];
  selected: number[];
  dragging: NoteDrag | null;
  dropOn: string | null;
  skipClick: MutableRefObject<boolean>;
  tps: number;
  onJump: (tick: number) => void;
  onStrokes: (next: Stroke[]) => void;
  toggle: (index: number) => void;
  toggleAll: (indexes: number[]) => void;
  startDrag: (e: ReactDragEvent, round: number, indexes: number[]) => void;
  markDrag: () => void;
  endDrag: () => void;
  dropAt: (e: ReactDragEvent, dest: NoteDropDest) => void;
  allowDrop: (e: ReactDragEvent, key: string, sameRound: boolean) => void;
  setEdge: (index: number, edge: "start" | "end", rnd: Round | undefined) => void;
  setClock: (index: number, edge: "start" | "end", seconds: number, rnd: Round | undefined) => void;
  clearWindow: (index: number) => void;
}

export function NoteRoundList({
  replay,
  rounds,
  strokes,
  selected,
  dragging,
  dropOn,
  skipClick,
  tps,
  onJump,
  onStrokes,
  toggle,
  toggleAll,
  startDrag,
  markDrag,
  endDrag,
  dropAt,
  allowDrop,
  setEdge,
  setClock,
  clearWindow,
}: NoteRoundListProps) {
  const [open, setOpen] = useState<string[]>([]);

  return (
    <>
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
                    if (!cluster.group) {
                      return;
                    }
                    startDrag(e, g.round, memberIdx);
                  }}
                  onDrag={markDrag}
                  onDragEnd={(e) => {
                    unlockNoteDrag(e.currentTarget, Boolean(cluster.group));
                    endDrag();
                  }}
                  onDragOver={(e) => {
                    if (cluster.group) {
                      allowDrop(e, dropKey, canDropInto);
                    }
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
                          if (!id) {
                            return;
                          }
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
                        onClear={() => clearWindow(head.index)}
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
                                if (e.key !== "Enter" && e.key !== " ") {
                                  return;
                                }
                                e.preventDefault();
                                onJump(itemAt);
                              }}
                            >
                              <span className="note-swatch" style={{ background: st.color }} />
                              <span className="review-copy">
                                {st.type === "bookmark" ? (
                                  <BookmarkTitleField
                                    index={index}
                                    title={strokeTitle(st)}
                                    strokes={strokes}
                                    onStrokes={onStrokes}
                                  />
                                ) : (
                                  <span className="review-title">{strokeTitle(st)}</span>
                                )}
                                <span className="review-detail">
                                  {rnd ? `${roundClock(rnd, itemAt, tps)} · ` : ""}
                                  {strokeWindowKind(itemWin)}
                                  {st.hidden ? " · Hidden" : ""}
                                </span>
                              </span>
                            </div>
                            <label
                              className={`note-eye${st.hidden ? " off" : ""}`}
                              title={
                                st.type === "bookmark"
                                  ? st.hidden
                                    ? "Show on timeline"
                                    : "Hide on timeline"
                                  : st.hidden
                                    ? "Show on radar"
                                    : "Hide on radar"
                              }
                            >
                              <input
                                type="checkbox"
                                checked={!st.hidden}
                                aria-label={
                                  st.type === "bookmark"
                                    ? st.hidden
                                      ? "Show on timeline"
                                      : "Hide on timeline"
                                    : st.hidden
                                      ? "Show on radar"
                                      : "Hide on radar"
                                }
                                onChange={() =>
                                  onStrokes(setStrokesHidden(strokes, [index], !st.hidden))
                                }
                              />
                              {st.hidden ? "○" : "●"}
                            </label>
                            {st.type === "bookmark" && (
                              <button
                                type="button"
                                className="note-remove"
                                title="Remove bookmark"
                                aria-label="Remove bookmark"
                                onClick={() => onStrokes(removeStrokesAt(strokes, [index]))}
                              >
                                ×
                              </button>
                            )}
                            {cluster.group == null && (
                              <MomentInOut
                                win={itemWin}
                                round={rnd}
                                tps={tps}
                                roundEndTick={windowEnd}
                                onSetEdge={(edge) => setEdge(index, edge, rnd)}
                                onClear={() => clearWindow(index)}
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
    </>
  );
}
