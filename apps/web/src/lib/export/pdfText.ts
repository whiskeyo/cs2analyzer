import type { PDFFont } from "pdf-lib";

/**
 * Keep ASCII, Latin-1, and Latin Extended-A (Polish ąćęłńóśźż). Map a few
 * Windows punctuation marks Helvetica-era notes still use.
 */
export function pdfSafeText(text: string): string {
  return text
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\n\r\t\x20-\x7E\u00A0-\u017F]/g, "");
}

export function wrapPdfText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of pdfSafeText(text).split(/\r?\n/)) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/).filter((word) => word !== "");
    let line = "";
    for (const word of words) {
      const pieces = splitLongWord(font, word, size, maxWidth);
      for (const piece of pieces) {
        const next = line === "" ? piece : `${line} ${piece}`;
        if (font.widthOfTextAtSize(next, size) <= maxWidth) {
          line = next;
        } else {
          if (line !== "") lines.push(line);
          line = piece;
        }
      }
    }
    if (line !== "") lines.push(line);
  }
  return lines;
}

function splitLongWord(font: PDFFont, word: string, size: number, maxWidth: number): string[] {
  if (font.widthOfTextAtSize(word, size) <= maxWidth) return [word];
  const parts: string[] = [];
  let chunk = "";
  for (const ch of word) {
    const next = `${chunk}${ch}`;
    if (chunk !== "" && font.widthOfTextAtSize(next, size) > maxWidth) {
      parts.push(chunk);
      chunk = ch;
    } else {
      chunk = next;
    }
  }
  if (chunk !== "") parts.push(chunk);
  return parts;
}
