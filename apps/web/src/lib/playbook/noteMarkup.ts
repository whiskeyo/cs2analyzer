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

type Marker = typeof BOLD | typeof UNDERLINE | typeof ITALIC_STAR | typeof ITALIC_UNDERSCORE;
type MarkStyle = "bold" | "italic" | "underline";

/** Longest match first so `*` / `_` never steal the first byte of `**` / `__`. */
function markerAt(input: string, i: number): Marker | null {
  if (input.startsWith(BOLD, i)) return BOLD;
  if (input.startsWith(UNDERLINE, i)) return UNDERLINE;
  if (input[i] === "*" && input[i + 1] !== "*") return ITALIC_STAR;
  if (input[i] === "_" && input[i + 1] !== "_") return ITALIC_UNDERSCORE;
  return null;
}

function markerStyle(marker: Marker): MarkStyle {
  if (marker === BOLD) return "bold";
  if (marker === UNDERLINE) return "underline";
  return "italic";
}

function findMarker(input: string, from: number, marker: Marker): number {
  let i = from;
  while (i < input.length) {
    const found = markerAt(input, i);
    if (found === marker) return i;
    i += found ? found.length : 1;
  }
  return -1;
}

function hasCloser(input: string, from: number, marker: Marker): boolean {
  return findMarker(input, from + marker.length, marker) !== -1;
}

/**
 * Markdown-compatible subset for strat notes: `**bold**`, `*italic*` / `_italic_`,
 * and `__underline__` (not CommonMark). Markers do not nest across lines.
 * Nested or overlapping marks become one span with combined flags — no leftover
 * `*` / `**` / `__` in the text when the pair is closed.
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

  const isOn = (style: MarkStyle): boolean => {
    if (style === "bold") return bold;
    if (style === "underline") return underline;
    return italic;
  };

  const toggle = (style: MarkStyle) => {
    if (style === "bold") bold = !bold;
    else if (style === "underline") underline = !underline;
    else italic = !italic;
  };

  while (i < input.length) {
    const marker = markerAt(input, i);
    if (marker) {
      const style = markerStyle(marker);
      if (isOn(style) || hasCloser(input, i, marker)) {
        flush();
        toggle(style);
        i += marker.length;
        continue;
      }
      buf += marker;
      i += marker.length;
      continue;
    }
    buf += input[i] ?? "";
    i += 1;
  }
  flush();
  return spans;
}

/** Parse each line on its own so markers do not leak across `\n` (PDF does the same). */
export function parseNoteMarkupLines(input: string): NoteMarkupSpan[][] {
  return input.split(/\r?\n/).map((line) => parseNoteMarkup(line));
}

/** Emit `**` / `*` / `__` toggles. `_italic_` becomes `*italic*` — same parse result. */
export function serializeNoteMarkup(spans: readonly NoteMarkupSpan[]): string {
  let bold = false;
  let italic = false;
  let underline = false;
  let out = "";

  const toggle = (next: { bold: boolean; italic: boolean; underline: boolean }) => {
    // Close inner marks first so combined spans nest (`**__*both*__**`),
    // not overlap (`**__*both**__*`) — the PDF parser used to leak those closers.
    if (italic && !next.italic) {
      out += ITALIC_STAR;
      italic = false;
    }
    if (underline && !next.underline) {
      out += UNDERLINE;
      underline = false;
    }
    if (bold && !next.bold) {
      out += BOLD;
      bold = false;
    }
    if (next.bold && !bold) {
      out += BOLD;
      bold = true;
    }
    if (next.underline && !underline) {
      out += UNDERLINE;
      underline = true;
    }
    if (next.italic && !italic) {
      out += ITALIC_STAR;
      italic = true;
    }
  };

  for (const span of spans) {
    if (span.text === "") continue;
    toggle(span);
    out += span.text;
  }
  toggle({ bold: false, italic: false, underline: false });
  return out;
}

export function serializeNoteMarkupLines(lines: readonly NoteMarkupSpan[][]): string {
  return lines.map((line) => serializeNoteMarkup(line)).join("\n");
}

/** Normalize stored notes: closed markers stay, `_italic_` becomes `*italic*`. */
export function normalizeNoteMarkup(input: string): string {
  return serializeNoteMarkupLines(parseNoteMarkupLines(input));
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
