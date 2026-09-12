import { parseNoteMarkupLines, serializeNoteMarkupLines, type NoteMarkupSpan } from "./noteMarkup";

export type NoteMark = "bold" | "italic" | "underline";

const MARK_TAG: Record<NoteMark, string> = {
  bold: "STRONG",
  italic: "EM",
  underline: "U",
};

const BLOCK_TAGS = new Set(["DIV", "P"]);

export function noteMarkupSpanNode(span: NoteMarkupSpan): Node {
  let node: Node = document.createTextNode(span.text);
  if (span.underline) {
    const wrap = document.createElement("u");
    wrap.append(node);
    node = wrap;
  }
  if (span.italic) {
    const wrap = document.createElement("em");
    wrap.append(node);
    node = wrap;
  }
  if (span.bold) {
    const wrap = document.createElement("strong");
    wrap.append(node);
    node = wrap;
  }
  return node;
}

export function noteMarkupToFragment(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const lines = parseNoteMarkupLines(text);
  lines.forEach((line, index) => {
    for (const span of line) {
      if (span.text === "") continue;
      frag.append(noteMarkupSpanNode(span));
    }
    if (index < lines.length - 1) frag.append(document.createElement("br"));
  });
  return frag;
}

export function renderNoteMarkup(root: HTMLElement, text: string): void {
  root.replaceChildren();
  if (text === "") {
    root.append(document.createElement("br"));
    return;
  }
  root.append(noteMarkupToFragment(text));
}

interface Marks {
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

function sameMarks(span: NoteMarkupSpan, marks: Marks): boolean {
  return (
    span.bold === marks.bold && span.italic === marks.italic && span.underline === marks.underline
  );
}

function isMarkTag(el: HTMLElement, mark: NoteMark): boolean {
  const tag = el.tagName;
  if (mark === "bold") return tag === "STRONG" || tag === "B";
  if (mark === "italic") return tag === "EM" || tag === "I";
  return tag === "U";
}

function marksFromElement(el: HTMLElement, inherited: Marks): Marks {
  const next = { ...inherited };
  if (isMarkTag(el, "bold")) next.bold = true;
  if (isMarkTag(el, "italic")) next.italic = true;
  if (isMarkTag(el, "underline")) next.underline = true;
  const weight = el.style.fontWeight;
  if (weight === "bold" || Number(weight) >= 600) next.bold = true;
  if (el.style.fontStyle === "italic") next.italic = true;
  if (el.style.textDecoration.includes("underline")) next.underline = true;
  return next;
}

function editorIsEmpty(root: HTMLElement): boolean {
  const text = (root.textContent ?? "").replace(/\u200b/g, "").trim();
  return text === "" && !root.querySelector("strong, em, u, b, i");
}

/** Walk a contenteditable root back to the stored markdown string. */
export function serializeNoteMarkupFromElement(root: HTMLElement): string {
  if (editorIsEmpty(root)) return "";
  const lines: NoteMarkupSpan[][] = [[]];
  let line = lines[0]!;

  const add = (text: string, marks: Marks) => {
    const clean = text.replace(/\u00a0/g, " ").replace(/\u200b/g, "");
    if (clean === "") return;
    const last = line[line.length - 1];
    if (last && sameMarks(last, marks)) last.text += clean;
    else line.push({ text: clean, ...marks });
  };

  const breakLine = () => {
    line = [];
    lines.push(line);
  };

  const walk = (node: Node, marks: Marks) => {
    if (node.nodeType === Node.TEXT_NODE) {
      add(node.textContent ?? "", marks);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      breakLine();
      return;
    }
    const next = marksFromElement(el, marks);
    const block = BLOCK_TAGS.has(el.tagName) && el !== root;
    if (block && (line.length > 0 || lines.length > 1)) breakLine();
    for (const child of el.childNodes) walk(child, next);
  };

  walk(root, { bold: false, italic: false, underline: false });
  return serializeNoteMarkupLines(lines);
}

const CLOSERS: { marker: string; mark: NoteMark }[] = [
  { marker: "**", mark: "bold" },
  { marker: "__", mark: "underline" },
  { marker: "*", mark: "italic" },
  { marker: "_", mark: "italic" },
];

export function matchClosedNoteMarkup(before: string): {
  start: number;
  marker: string;
  inner: string;
  mark: NoteMark;
} | null {
  for (const { marker, mark } of CLOSERS) {
    if (!before.endsWith(marker)) continue;
    if (marker === "*" && before.endsWith("**")) continue;
    if (marker === "_" && before.endsWith("__")) continue;
    const innerEnd = before.length - marker.length;
    const open = before.lastIndexOf(marker, innerEnd - 1);
    if (open === -1 || open + marker.length > innerEnd) continue;
    const inner = before.slice(open + marker.length, innerEnd);
    if (inner === "" || inner.includes("\n") || inner.includes(marker)) continue;
    return { start: open, marker, inner, mark };
  }
  return null;
}

function ancestorHasMark(node: Node, mark: NoteMark): boolean {
  let cursor: Node | null = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
  while (cursor && cursor.nodeType === Node.ELEMENT_NODE) {
    if (isMarkTag(cursor as HTMLElement, mark)) return true;
    cursor = cursor.parentElement;
  }
  return false;
}

/** Turn a just-typed `**…**` / `*…*` / `__…__` run at the caret into styled text. */
export function convertTypedNoteMarkup(root: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || !sel.isCollapsed || sel.rangeCount === 0) return false;
  const node = sel.anchorNode;
  if (!node || node.nodeType !== Node.TEXT_NODE || !root.contains(node)) return false;
  const found = matchClosedNoteMarkup((node.textContent ?? "").slice(0, sel.anchorOffset));
  if (!found) return false;
  if (ancestorHasMark(node, found.mark)) return false;

  const text = node.textContent ?? "";
  const offset = sel.anchorOffset;
  const parent = node.parentNode;
  if (!parent) return false;

  const styled = document.createElement(MARK_TAG[found.mark].toLowerCase());
  styled.textContent = found.inner;
  const frag = document.createDocumentFragment();
  const before = text.slice(0, found.start);
  const after = text.slice(offset);
  if (before !== "") frag.append(document.createTextNode(before));
  frag.append(styled);
  if (after !== "") frag.append(document.createTextNode(after));
  parent.replaceChild(frag, node);

  const range = document.createRange();
  range.setStartAfter(styled);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

function rangeInside(root: HTMLElement, range: Range): boolean {
  return root.contains(range.commonAncestorContainer);
}

/** Wrap or unwrap the current selection. Persisted form is still markdown. */
export function toggleNoteMark(root: HTMLElement, mark: NoteMark): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!rangeInside(root, range)) return;
  const tag = MARK_TAG[mark].toLowerCase();

  if (range.collapsed) {
    const wrap = document.createElement(tag);
    wrap.append(document.createTextNode("\u200b"));
    range.insertNode(wrap);
    const next = document.createRange();
    next.selectNodeContents(wrap);
    next.collapse(false);
    sel.removeAllRanges();
    sel.addRange(next);
    return;
  }

  if (selectionHasMark(range, mark)) {
    unwrapMarkInRange(root, range, mark);
    return;
  }

  const contents = range.extractContents();
  const wrap = document.createElement(tag);
  wrap.append(contents);
  range.insertNode(wrap);
  const next = document.createRange();
  next.selectNodeContents(wrap);
  sel.removeAllRanges();
  sel.addRange(next);
}

function selectionHasMark(range: Range, mark: NoteMark): boolean {
  if (ancestorHasMark(range.commonAncestorContainer, mark)) return true;
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  let saw = false;
  while (node) {
    if (range.intersectsNode(node) && (node.textContent ?? "") !== "") {
      saw = true;
      if (!ancestorHasMark(node, mark)) return false;
    }
    node = walker.nextNode();
  }
  return saw;
}

function unwrapMarkInRange(root: HTMLElement, range: Range, mark: NoteMark): void {
  const tagged = root.querySelectorAll(MARK_TAG[mark].toLowerCase());
  for (const el of tagged) {
    if (!range.intersectsNode(el)) continue;
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }
}

export function noteMarkupEditorEmpty(root: HTMLElement): boolean {
  return editorIsEmpty(root);
}

/** Re-parse a pasted markdown string into styled nodes (same markers as `parseNoteMarkup`). */
export function insertNoteMarkup(root: HTMLElement, text: string): void {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !root.contains(sel.anchorNode)) {
    root.append(noteMarkupToFragment(text));
    return;
  }
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const frag = noteMarkupToFragment(text);
  const last = frag.lastChild;
  range.insertNode(frag);
  if (last) {
    const next = document.createRange();
    next.setStartAfter(last);
    next.collapse(true);
    sel.removeAllRanges();
    sel.addRange(next);
  }
}

export function renderedNoteMarkupEquals(root: HTMLElement, text: string): boolean {
  return (
    serializeNoteMarkupFromElement(root) === serializeNoteMarkupLines(parseNoteMarkupLines(text))
  );
}
