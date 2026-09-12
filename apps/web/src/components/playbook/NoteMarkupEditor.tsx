import { useLayoutEffect, useRef, type RefObject } from "react";
import {
  convertTypedNoteMarkup,
  insertNoteMarkup,
  noteMarkupEditorEmpty,
  renderNoteMarkup,
  restyleRawNoteMarkup,
  serializeNoteMarkupFromElement,
  textNodesHaveClosedMarkup,
  toggleNoteMark,
  type NoteMark,
} from "@/lib/playbook/noteMarkupDom";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function NoteMarkupEditor({ value, onChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastValue = useRef(value);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (serializeNoteMarkupFromElement(el) === value && !textNodesHaveClosedMarkup(el)) {
      lastValue.current = value;
      syncEmpty(el);
      return;
    }
    renderNoteMarkup(el, value);
    lastValue.current = value;
    syncEmpty(el);
  }, [value]);

  const emit = () => {
    const el = rootRef.current;
    if (!el) return;
    syncEmpty(el);
    const next = serializeNoteMarkupFromElement(el);
    lastValue.current = next;
    if (next !== value) onChange(next);
  };

  return (
    <div className="playbook-notes-editor-wrap">
      <div className="playbook-notes-toolbar" role="toolbar" aria-label="Strat notes style">
        <MarkButton label="Bold" mark="bold" rootRef={rootRef} onApplied={emit} />
        <MarkButton label="Italic" mark="italic" rootRef={rootRef} onApplied={emit} />
        <MarkButton label="Underline" mark="underline" rootRef={rootRef} onApplied={emit} />
      </div>
      <div
        ref={rootRef}
        className="playbook-notes-editor"
        role="textbox"
        aria-label="Strat notes"
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Callouts, timings, utility…"
        onInput={(event) => {
          if (event.nativeEvent.isComposing) return;
          const el = rootRef.current;
          if (!el) return;
          convertTypedNoteMarkup(el);
          restyleRawNoteMarkup(el);
          emit();
        }}
        onPaste={(event) => {
          event.preventDefault();
          const el = rootRef.current;
          if (!el) return;
          insertNoteMarkup(el, event.clipboardData.getData("text/plain"));
          emit();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          event.preventDefault();
          document.execCommand("insertLineBreak");
        }}
      />
    </div>
  );
}

function MarkButton({
  label,
  mark,
  rootRef,
  onApplied,
}: {
  label: string;
  mark: NoteMark;
  rootRef: RefObject<HTMLDivElement | null>;
  onApplied: () => void;
}) {
  return (
    <button
      type="button"
      className="ghost"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        const el = rootRef.current;
        if (!el) return;
        const sel = window.getSelection();
        const inEditor = Boolean(sel && sel.rangeCount > 0 && el.contains(sel.anchorNode));
        if (!inEditor) el.focus();
        toggleNoteMark(el, mark);
        onApplied();
      }}
    >
      {label}
    </button>
  );
}

function syncEmpty(el: HTMLElement) {
  el.dataset.empty = noteMarkupEditorEmpty(el) ? "true" : "false";
}
