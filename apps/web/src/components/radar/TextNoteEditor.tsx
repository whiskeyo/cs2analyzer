import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject, RefObject } from "react";
import { NOTE_TEXT_MIN_HEIGHT, NOTE_TEXT_MIN_WIDTH } from "@/lib/shared/constants";
import { addDrawing } from "@/lib/playbook/drawings";
import { removeItems, type NoteItemRef } from "@/lib/notes/noteGroups";
import { cloneNote } from "@/lib/notes/note";
import type { Note } from "@/lib/notes/types";

export interface TextEdit {
  ref: NoteItemRef | null;
  x: number;
  y: number;
  /** Wrap-local px so the first paint sits on the click, not after the canvas. */
  sx: number;
  sy: number;
  text: string;
  color: string;
  start_tick?: number;
  end_tick?: number;
  box_w?: number;
  box_h?: number;
}

export interface TextMove {
  ref: NoteItemRef;
  grabWx: number;
  grabWy: number;
  grabSx: number;
  grabSy: number;
  origX: number;
  origY: number;
  x: number;
  y: number;
  moved: boolean;
}

export interface TextEditDrag {
  grabX: number;
  grabY: number;
  origSx: number;
  origSy: number;
}

export function applyTextCommit(
  ed: TextEdit,
  box: { box_w?: number; box_h?: number },
  note: Note,
): Note {
  const trimmed = ed.text.trim();
  if (ed.ref == null) {
    if (!trimmed) return note;
    return addDrawing(note, {
      type: "text",
      color: ed.color,
      x: ed.x,
      y: ed.y,
      text: trimmed,
      ...box,
      ...(ed.start_tick != null ? { start_tick: ed.start_tick, end_tick: ed.end_tick } : {}),
    });
  }
  if (!trimmed) return removeItems(note, [ed.ref]);
  const next = cloneNote(note);
  if (ed.ref.kind === "loose") {
    const drawing = next.drawings[ed.ref.index];
    if (!drawing || drawing.type !== "text") return note;
    next.drawings[ed.ref.index] = { ...drawing, text: trimmed, x: ed.x, y: ed.y, ...box };
    return next;
  }
  if (ed.ref.kind === "group") {
    const drawing = next.groups[ed.ref.groupIndex]?.drawings[ed.ref.drawingIndex];
    if (!drawing || drawing.type !== "text") return note;
    next.groups[ed.ref.groupIndex].drawings[ed.ref.drawingIndex] = {
      ...drawing,
      text: trimmed,
      x: ed.x,
      y: ed.y,
      ...box,
    };
    return next;
  }
  return note;
}

export function useTextNotes(noteRef: MutableRefObject<Note>, onNote: (next: Note) => void) {
  const [editing, setEditing] = useState<TextEdit | null>(null);
  const editingRef = useRef<TextEdit | null>(null);
  editingRef.current = editing;
  const editAreaRef = useRef<HTMLTextAreaElement>(null);
  const editWrapRef = useRef<HTMLDivElement>(null);
  const ignoreBlurRef = useRef(false);
  const editDragRef = useRef<TextEditDrag | null>(null);
  const onNoteRef = useRef(onNote);
  onNoteRef.current = onNote;

  const focusEditor = () => {
    const el = editAreaRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const n = el.value.length;
    el.setSelectionRange(n, n);
  };

  useLayoutEffect(() => {
    if (!editing) return;
    focusEditor();
    const id = window.setTimeout(focusEditor, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- typing / drag should not steal the caret
  }, [editing?.ref]);

  useEffect(() => {
    if (!editing) return;
    const el = editAreaRef.current;
    if (!el) return;
    const sync = () => {
      const ed = editingRef.current;
      if (!ed) return;
      const box_w = Math.max(NOTE_TEXT_MIN_WIDTH, el.offsetWidth);
      const box_h = Math.max(NOTE_TEXT_MIN_HEIGHT, el.offsetHeight);
      if (ed.box_w === box_w && ed.box_h === box_h) return;
      const next = { ...ed, box_w, box_h };
      editingRef.current = next;
      setEditing(next);
    };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-bind when the editor opens
  }, [editing?.ref]);

  const commitEditing = () => {
    const ed = editingRef.current;
    if (!ed) return;
    const el = editAreaRef.current;
    const box =
      el != null
        ? {
            box_w: Math.max(NOTE_TEXT_MIN_WIDTH, el.offsetWidth),
            box_h: Math.max(NOTE_TEXT_MIN_HEIGHT, el.offsetHeight),
          }
        : {
            ...(ed.box_w != null ? { box_w: ed.box_w } : {}),
            ...(ed.box_h != null ? { box_h: ed.box_h } : {}),
          };
    editingRef.current = null;
    setEditing(null);
    if (ed.ref == null && !ed.text.trim()) return;
    onNoteRef.current(applyTextCommit(ed, box, noteRef.current));
  };

  const commitEditingRef = useRef(commitEditing);
  commitEditingRef.current = commitEditing;

  const beginEditing = (next: TextEdit) => {
    ignoreBlurRef.current = true;
    const clear = () => {
      ignoreBlurRef.current = false;
      window.removeEventListener("mouseup", clear);
      focusEditor();
    };
    window.addEventListener("mouseup", clear);
    editingRef.current = next;
    setEditing(next);
  };

  const beginEditingRef = useRef(beginEditing);
  beginEditingRef.current = beginEditing;

  const onTextKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      editingRef.current = null;
      setEditing(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commitEditing();
    }
  };

  return {
    editing,
    setEditing,
    editingRef,
    editAreaRef,
    editWrapRef,
    ignoreBlurRef,
    editDragRef,
    focusEditor,
    beginEditing,
    beginEditingRef,
    commitEditing,
    commitEditingRef,
    onTextKeyDown,
  };
}

interface EditorProps {
  editing: TextEdit;
  wrapRef: RefObject<HTMLDivElement | null>;
  editWrapRef: RefObject<HTMLDivElement | null>;
  editAreaRef: RefObject<HTMLTextAreaElement | null>;
  editingRef: MutableRefObject<TextEdit | null>;
  ignoreBlurRef: MutableRefObject<boolean>;
  editDragRef: MutableRefObject<TextEditDrag | null>;
  focusEditor: () => void;
  commitEditing: () => void;
  onTextKeyDown: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  setEditing: (next: TextEdit | null) => void;
}

export function TextNoteEditor({
  editing,
  wrapRef,
  editWrapRef,
  editAreaRef,
  editingRef,
  ignoreBlurRef,
  editDragRef,
  focusEditor,
  commitEditing,
  onTextKeyDown,
  setEditing,
}: EditorProps) {
  return (
    <div
      ref={editWrapRef}
      className="radar-text-edit-wrap"
      style={{ left: editing.sx, top: editing.sy }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="radar-text-edit-grip"
        title="Drag to move"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const box = wrapRef.current;
          const ed = editingRef.current;
          if (!box || !ed) return;
          ignoreBlurRef.current = true;
          const rect = box.getBoundingClientRect();
          editDragRef.current = {
            grabX: e.clientX - rect.left,
            grabY: e.clientY - rect.top,
            origSx: ed.sx,
            origSy: ed.sy,
          };
        }}
      />
      <textarea
        ref={editAreaRef}
        className="radar-text-edit"
        value={editing.text}
        placeholder="Note"
        rows={2}
        autoFocus
        style={{
          minWidth: NOTE_TEXT_MIN_WIDTH,
          minHeight: NOTE_TEXT_MIN_HEIGHT,
          ...(editing.box_w != null ? { width: editing.box_w } : {}),
          ...(editing.box_h != null ? { height: editing.box_h } : {}),
        }}
        onChange={(e) => {
          const next = { ...editing, text: e.target.value };
          editingRef.current = next;
          setEditing(next);
        }}
        onKeyDown={onTextKeyDown}
        onBlur={() => {
          if (ignoreBlurRef.current) {
            focusEditor();
            return;
          }
          commitEditing();
        }}
      />
    </div>
  );
}
