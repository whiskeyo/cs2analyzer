import type { DragEvent as ReactDragEvent, MutableRefObject } from "react";
import { roundClock } from "@/lib/match/roundEvents";
import { itemWindow, removeItems, setItemsHidden, windowKind } from "@/lib/notes";
import { picksEqual, refsForDrag, type NotePick } from "@/lib/notes/drag";
import type { NoteItemRef } from "@/lib/notes/noteGroups";
import type { NoteListItem } from "@/lib/notes";
import { MomentInOut } from "@/components/sidebar/NoteClocks";
import { BookmarkTitleField } from "./BookmarkTitleField";
import type { Round } from "@/lib/replay/replayTypes";
import type { Note } from "@/lib/notes/types";

export function NoteListRow({
  item,
  round,
  note,
  rnd,
  jump,
  tps,
  windowEnd,
  groupHidden,
  showMoment,
  selected,
  skipClick,
  onJump,
  onNote,
  toggle,
  startDrag,
  markDrag,
  endDrag,
  setEdge,
  setClock,
  clearWindow,
}: {
  item: NoteListItem;
  round: number;
  note: Note;
  rnd: Round | undefined;
  jump: number;
  tps: number;
  windowEnd: number;
  groupHidden: boolean;
  showMoment: boolean;
  selected: NotePick[];
  skipClick: MutableRefObject<boolean>;
  onJump: (tick: number) => void;
  onNote: (next: Note) => void;
  toggle: (pick: NotePick) => void;
  startDrag: (e: ReactDragEvent, round: number, refs: NoteItemRef[]) => void;
  markDrag: () => void;
  endDrag: () => void;
  setEdge: (round: number, ref: NoteItemRef, edge: "start" | "end", rnd: Round | undefined) => void;
  setClock: (
    round: number,
    ref: NoteItemRef,
    edge: "start" | "end",
    seconds: number,
    rnd: Round | undefined,
  ) => void;
  clearWindow: (round: number, ref: NoteItemRef) => void;
}) {
  const pick: NotePick = { round, ref: item.ref };
  const itemWin = itemWindow(note, item.ref);
  const itemAt = itemWin?.start ?? rnd?.freeze_end_tick ?? rnd?.start_tick ?? jump;
  const dim = groupHidden || item.hidden;
  const rowKey =
    item.ref.kind === "group"
      ? `${item.ref.kind}-${item.ref.groupIndex}-${item.ref.drawingIndex}`
      : `${item.ref.kind}-${item.ref.index}`;
  return (
    <li
      key={rowKey}
      className={`note-row${selected.some((rowPick) => picksEqual(rowPick, pick)) ? " on" : ""}${
        dim ? " dim" : ""
      }`}
      draggable
      onDragStart={(e) => startDrag(e, round, refsForDrag(item.ref, selected, round))}
      onDrag={markDrag}
      onDragEnd={endDrag}
    >
      <label className="note-pick">
        <input
          type="checkbox"
          checked={selected.some((rowPick) => picksEqual(rowPick, pick))}
          onChange={() => toggle(pick)}
          aria-label={`Select ${item.title}`}
        />
      </label>
      <div
        className="review-note"
        role="button"
        tabIndex={0}
        aria-label={item.title}
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
        <span className="note-swatch" style={{ background: item.color }} />
        <span className="review-copy">
          {item.type === "bookmark" ? (
            <BookmarkTitleField refItem={item.ref} title={item.title} note={note} onNote={onNote} />
          ) : (
            <span className="review-title">{item.title}</span>
          )}
          <span className="review-detail">
            {rnd ? `${roundClock(rnd, itemAt, tps)} · ` : ""}
            {windowKind(itemWin)}
            {dim ? " · Hidden" : ""}
          </span>
        </span>
      </div>
      <label
        className={`note-eye${item.hidden ? " off" : ""}`}
        title={
          item.type === "bookmark"
            ? item.hidden
              ? "Show on timeline"
              : "Hide on timeline"
            : item.hidden
              ? "Show on radar"
              : "Hide on radar"
        }
      >
        <input
          type="checkbox"
          checked={!item.hidden}
          aria-label={
            item.type === "bookmark"
              ? item.hidden
                ? "Show on timeline"
                : "Hide on timeline"
              : item.hidden
                ? "Show on radar"
                : "Hide on radar"
          }
          onChange={() => onNote(setItemsHidden(note, [item.ref], !item.hidden))}
        />
        {item.hidden ? "○" : "●"}
      </label>
      {item.type === "bookmark" && (
        <button
          type="button"
          className="note-remove"
          title="Remove bookmark"
          aria-label="Remove bookmark"
          onClick={() => onNote(removeItems(note, [item.ref]))}
        >
          ×
        </button>
      )}
      {showMoment && (
        <MomentInOut
          win={itemWin}
          round={rnd}
          tps={tps}
          roundEndTick={windowEnd}
          onSetEdge={(edge) => setEdge(round, item.ref, edge, rnd)}
          onClear={() => clearWindow(round, item.ref)}
          onClockEdge={(edge, seconds) => setClock(round, item.ref, edge, seconds, rnd)}
        />
      )}
    </li>
  );
}
