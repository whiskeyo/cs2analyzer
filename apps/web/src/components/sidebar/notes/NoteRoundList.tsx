import { useState } from "react";
import type { DragEvent as ReactDragEvent, MutableRefObject } from "react";
import {
  clusterNote,
  groupLabel,
  isPenOrArrow,
  itemWindow,
  overlayJumpTick,
  setGroupHidden,
  squashLooseDrawings,
} from "@/lib/notes";
import { lockNoteDrag, picksEqual, unlockNoteDrag, type NotePick } from "@/lib/notes/drag";
import type { NoteDrag } from "@/lib/notes/drag";
import type { NoteItemRef } from "@/lib/notes/noteGroups";
import { updateRoundNote } from "@/lib/notes/roundNotes";
import { useMessages } from "@/lib/i18n";
import { MomentInOut, roundWindowEnd } from "@/components/sidebar/NoteClocks";
import { GroupNameField } from "./GroupNameField";
import { NoteListRow } from "./NoteListRow";
import type { Replay, Round } from "@/lib/replay/replayTypes";
import type { Note, RoundNote } from "@/lib/notes/types";
import type { RoundNoteDropDest } from "@/lib/notes/useNoteDrag";

interface NoteRoundListProps {
  replay: Replay;
  rounds: RoundNote[];
  selected: NotePick[];
  dragging: NoteDrag | null;
  dropOn: string | null;
  skipClickRef: MutableRefObject<boolean>;
  tps: number;
  onJump: (tick: number) => void;
  onNotes: (next: RoundNote[]) => void;
  toggle: (pick: NotePick) => void;
  toggleAll: (picks: NotePick[]) => void;
  startDrag: (e: ReactDragEvent, round: number, refs: NoteItemRef[]) => void;
  markDrag: () => void;
  endDrag: () => void;
  dropAt: (e: ReactDragEvent, dest: RoundNoteDropDest) => void;
  allowDrop: (e: ReactDragEvent, key: string, sameRound: boolean) => void;
  setEdge: (round: number, ref: NoteItemRef, edge: "start" | "end", rnd: Round | undefined) => void;
  setClock: (
    round: number,
    ref: NoteItemRef,
    edge: "start" | "end",
    seconds: number,
    rnd: Round | undefined,
  ) => void;
  clearWindow: (round: number, ref: NoteItemRef) => void;
}

export function NoteRoundList({
  replay,
  rounds,
  selected,
  dragging,
  dropOn,
  skipClickRef,
  tps,
  onJump,
  onNotes,
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
  const { messages, t } = useMessages();
  const [open, setOpen] = useState<string[]>([]);

  const commitNote = (round: number, note: Note) => {
    onNotes(updateRoundNote(rounds, round, () => note));
  };

  return (
    <>
      {rounds.map((row) => {
        const rnd = replay.rounds.find((r) => r.number === row.round);
        const windowEnd = roundWindowEnd(rnd, replay);
        const jump = rnd ? overlayJumpTick(row.note, rnd) : 0;
        const clusters = clusterNote(row.note);
        const looseDraw = row.note.drawings.filter(isPenOrArrow).length;
        const sameRound = dragging?.round === row.round;
        return (
          <div key={row.round} className="notes-round">
            <div className="notes-round-head">
              <p className="notes-round-label">
                {rnd?.is_knife
                  ? messages.hud.knife
                  : t(messages.sidebar.roundLabel, { n: row.round })}
              </p>
              {looseDraw >= 2 && (
                <button
                  type="button"
                  onClick={() => commitNote(row.round, squashLooseDrawings(row.note))}
                >
                  {messages.sidebar.squashDrawings}
                </button>
              )}
            </div>
            {sameRound && (
              <div
                className={`note-drop-slot${dropOn === `out-${row.round}` ? " on" : ""}`}
                onDragOver={(e) => allowDrop(e, `out-${row.round}`, true)}
                onDrop={(e) => dropAt(e, { round: row.round, kind: "ungroup" })}
              >
                {messages.sidebar.dropUngroup}
              </div>
            )}
            {clusters.map((cluster) => {
              const foldKey = cluster.groupId ?? `loose-${row.round}`;
              const foldedAway = cluster.groupId != null && !open.includes(foldKey);
              const memberPicks: NotePick[] = cluster.items.map((item) => ({
                round: row.round,
                ref: item.ref,
              }));
              const head = cluster.items[0];
              const win = head ? itemWindow(row.note, head.ref) : null;
              const at = win?.start ?? rnd?.freeze_end_tick ?? rnd?.start_tick ?? jump;
              const dropKey = `g-${row.round}-${cluster.groupId ?? "loose"}`;
              const groupHidden = cluster.groupHidden;
              const draggingThisLayer =
                cluster.groupIndex != null &&
                dragging != null &&
                dragging.refs.length === memberPicks.length &&
                memberPicks.every((pick) =>
                  dragging.refs.some(
                    (ref) =>
                      ref.kind === pick.ref.kind &&
                      (ref.kind === "group" && pick.ref.kind === "group"
                        ? ref.groupIndex === pick.ref.groupIndex &&
                          ref.drawingIndex === pick.ref.drawingIndex
                        : false),
                  ),
                );
              const canDropInto = cluster.groupIndex != null && sameRound && !draggingThisLayer;
              return (
                <div
                  key={foldKey}
                  className={`note-cluster${cluster.groupId ? "" : " note-loose"}${
                    dropOn === dropKey && canDropInto ? " note-drop" : ""
                  }`}
                  draggable={cluster.groupIndex != null}
                  onPointerDownCapture={(e) => {
                    lockNoteDrag(e.currentTarget, e.target, cluster.groupIndex != null);
                  }}
                  onPointerUp={(e) => unlockNoteDrag(e.currentTarget, cluster.groupIndex != null)}
                  onPointerCancel={(e) =>
                    unlockNoteDrag(e.currentTarget, cluster.groupIndex != null)
                  }
                  onDragStart={(e) => {
                    if (cluster.groupIndex == null) return;
                    startDrag(
                      e,
                      row.round,
                      memberPicks.map((pick) => pick.ref),
                    );
                  }}
                  onDrag={markDrag}
                  onDragEnd={(e) => {
                    unlockNoteDrag(e.currentTarget, cluster.groupIndex != null);
                    endDrag();
                  }}
                  onDragOver={(e) => {
                    if (cluster.groupIndex != null) allowDrop(e, dropKey, canDropInto);
                  }}
                  onDrop={(e) => {
                    if (cluster.groupIndex != null) {
                      dropAt(e, { round: row.round, kind: "into", groupIndex: cluster.groupIndex });
                    }
                  }}
                >
                  {cluster.groupIndex != null && cluster.groupId && head && (
                    <div
                      className="note-cluster-head"
                      onDragOver={(e) => allowDrop(e, dropKey, canDropInto)}
                      onDrop={(e) => {
                        dropAt(e, {
                          round: row.round,
                          kind: "into",
                          groupIndex: cluster.groupIndex!,
                        });
                      }}
                    >
                      <button
                        type="button"
                        className="note-cluster-fold"
                        aria-expanded={!foldedAway}
                        aria-label={
                          foldedAway
                            ? messages.sidebar.showLayerMembers
                            : messages.sidebar.hideLayerMembers
                        }
                        title={
                          foldedAway
                            ? messages.sidebar.showLayerMembers
                            : messages.sidebar.hideLayerMembers
                        }
                        onClick={() => {
                          setOpen((cur) =>
                            cur.includes(foldKey)
                              ? cur.filter((name) => name !== foldKey)
                              : [...cur, foldKey],
                          );
                        }}
                      >
                        {foldedAway ? "▸" : "▾"}
                      </button>
                      <label className="note-pick">
                        <input
                          type="checkbox"
                          checked={memberPicks.every((pick) =>
                            selected.some((rowPick) => picksEqual(rowPick, pick)),
                          )}
                          onChange={() => toggleAll(memberPicks)}
                          aria-label={t(messages.sidebar.selectNamed, {
                            name: groupLabel(cluster.groupName ?? cluster.groupId),
                          })}
                        />
                      </label>
                      <GroupNameField
                        key={cluster.groupId}
                        groupIndex={cluster.groupIndex}
                        groupName={cluster.groupName ?? cluster.groupId}
                        note={row.note}
                        onNote={(next) => commitNote(row.round, next)}
                      />
                      <button
                        type="button"
                        className="note-cluster-count"
                        title={messages.sidebar.jumpToLayer}
                        onClick={() => onJump(at)}
                      >
                        {cluster.items.length}
                      </button>
                      <label
                        className={`note-eye${groupHidden ? " off" : ""}`}
                        title={
                          groupHidden
                            ? messages.sidebar.showLayerRadar
                            : messages.sidebar.hideLayerRadar
                        }
                      >
                        <input
                          type="checkbox"
                          checked={!groupHidden}
                          aria-label={
                            groupHidden
                              ? messages.sidebar.showLayerRadar
                              : messages.sidebar.hideLayerRadar
                          }
                          onChange={() =>
                            commitNote(
                              row.round,
                              setGroupHidden(row.note, cluster.groupIndex!, !groupHidden),
                            )
                          }
                        />
                        {groupHidden ? "○" : "●"}
                      </label>
                    </div>
                  )}
                  {cluster.groupIndex != null && head && (
                    <div className="note-cluster-io">
                      <MomentInOut
                        win={win}
                        round={rnd}
                        tps={tps}
                        roundEndTick={windowEnd}
                        onSetEdge={(edge) => setEdge(row.round, head.ref, edge, rnd)}
                        onClear={() => clearWindow(row.round, head.ref)}
                        onClockEdge={(edge, seconds) =>
                          setClock(row.round, head.ref, edge, seconds, rnd)
                        }
                      />
                    </div>
                  )}
                  {!foldedAway && (
                    <ul className="review-notes">
                      {cluster.items.map((item) => (
                        <NoteListRow
                          key={
                            item.ref.kind === "group"
                              ? `${item.ref.kind}-${item.ref.groupIndex}-${item.ref.drawingIndex}`
                              : `${item.ref.kind}-${item.ref.index}`
                          }
                          item={item}
                          round={row.round}
                          note={row.note}
                          rnd={rnd}
                          jump={jump}
                          tps={tps}
                          windowEnd={windowEnd}
                          groupHidden={groupHidden}
                          showMoment={cluster.groupIndex == null}
                          selected={selected}
                          skipClickRef={skipClickRef}
                          onJump={onJump}
                          onNote={(next) => commitNote(row.round, next)}
                          toggle={toggle}
                          startDrag={startDrag}
                          markDrag={markDrag}
                          endDrag={endDrag}
                          setEdge={setEdge}
                          setClock={setClock}
                          clearWindow={clearWindow}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
            {sameRound && (
              <div
                className={`note-drop-slot${dropOn === `new-${row.round}` ? " on" : ""}`}
                onDragOver={(e) => allowDrop(e, `new-${row.round}`, true)}
                onDrop={(e) => dropAt(e, { round: row.round, kind: "new-group" })}
              >
                {messages.sidebar.dropNewGroup}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
