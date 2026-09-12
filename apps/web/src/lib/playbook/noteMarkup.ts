export interface NoteMarkupSpan {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

const BOLD = "**";
const UNDERLINE = "__";
const ITALIC_STAR = "*";
const ITALIC_UNDERSCORE = "_";

function hasCloser(input: string, from: number, marker: string): boolean {
  return input.indexOf(marker, from + marker.length) !== -1;
}

/**
 * Markdown-compatible subset for strat notes: `**bold**`, `*italic*` / `_italic_`,
 * and `__underline__` (not CommonMark). Markers do not nest across lines.
 */
export function parseNoteMarkup(input: string): NoteMarkupSpan[] {
  const spans: NoteMarkupSpan[] = [];
  let bold = false;
  let italic = false;
  let underline = false;
  let buf = "";
  let i = 0;

  const flush = () => {
    if (buf === "") return;
    spans.push({ text: buf, bold, italic, underline });
    buf = "";
  };

  while (i < input.length) {
    if (input.startsWith(BOLD, i)) {
      if (bold || hasCloser(input, i, BOLD)) {
        flush();
        bold = !bold;
        i += BOLD.length;
        continue;
      }
      buf += BOLD;
      i += BOLD.length;
      continue;
    }
    if (input.startsWith(UNDERLINE, i)) {
      if (underline || hasCloser(input, i, UNDERLINE)) {
        flush();
        underline = !underline;
        i += UNDERLINE.length;
        continue;
      }
      buf += UNDERLINE;
      i += UNDERLINE.length;
      continue;
    }
    if (input.startsWith(ITALIC_STAR, i) && (italic || hasCloser(input, i, ITALIC_STAR))) {
      flush();
      italic = !italic;
      i += ITALIC_STAR.length;
      continue;
    }
    if (
      input.startsWith(ITALIC_UNDERSCORE, i) &&
      (italic || hasCloser(input, i, ITALIC_UNDERSCORE))
    ) {
      flush();
      italic = !italic;
      i += ITALIC_UNDERSCORE.length;
      continue;
    }
    buf += input[i] ?? "";
    i += 1;
  }
  flush();
  return spans;
}

export function wrapNoteMarkup(
  text: string,
  start: number,
  end: number,
  marker: string,
): { text: string; start: number; end: number } {
  const from = Math.min(start, end);
  const to = Math.max(start, end);
  const selected = text.slice(from, to);
  const open = text.slice(from - marker.length, from);
  const close = text.slice(to, to + marker.length);
  if (
    selected.startsWith(marker) &&
    selected.endsWith(marker) &&
    selected.length > marker.length * 2
  ) {
    const inner = selected.slice(marker.length, selected.length - marker.length);
    return {
      text: `${text.slice(0, from)}${inner}${text.slice(to)}`,
      start: from,
      end: from + inner.length,
    };
  }
  if (open === marker && close === marker) {
    return {
      text: `${text.slice(0, from - marker.length)}${selected}${text.slice(to + marker.length)}`,
      start: from - marker.length,
      end: to - marker.length,
    };
  }
  const next = `${text.slice(0, from)}${marker}${selected}${marker}${text.slice(to)}`;
  return {
    text: next,
    start: from + marker.length,
    end: to + marker.length,
  };
}
