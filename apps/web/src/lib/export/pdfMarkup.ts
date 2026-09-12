import type { PDFFont } from "pdf-lib";
import { parseNoteMarkup, type NoteMarkupSpan } from "@/lib/playbook/noteMarkup";
import { pdfSafeText } from "./pdfText";

export interface PdfMarkupFonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
}

export interface PdfMarkupRun {
  text: string;
  font: PDFFont;
  underline: boolean;
}

export function fontForSpan(fonts: PdfMarkupFonts, span: NoteMarkupSpan): PDFFont {
  if (span.bold && span.italic) return fonts.boldItalic;
  if (span.bold) return fonts.bold;
  if (span.italic) return fonts.italic;
  return fonts.regular;
}

export function wrapMarkupParagraph(
  fonts: PdfMarkupFonts,
  paragraph: string,
  size: number,
  maxWidth: number,
): PdfMarkupRun[][] {
  const spans = parseNoteMarkup(paragraph)
    .map((span) => ({ ...span, text: pdfSafeText(span.text) }))
    .filter((span) => span.text !== "");
  const lines: PdfMarkupRun[][] = [];
  let line: PdfMarkupRun[] = [];
  let lineWidth = 0;

  const flush = () => {
    lines.push(line);
    line = [];
    lineWidth = 0;
  };

  const add = (font: PDFFont, text: string, underline: boolean) => {
    if (text === "") return;
    const width = font.widthOfTextAtSize(text, size);
    const last = line[line.length - 1];
    if (last && last.font === font && last.underline === underline) {
      last.text += text;
    } else {
      line.push({ text, font, underline });
    }
    lineWidth += width;
  };

  for (const span of spans) {
    const font = fontForSpan(fonts, span);
    for (const token of span.text.split(/(\s+)/)) {
      if (token === "") continue;
      const space = /^\s+$/.test(token);
      const tokenWidth = font.widthOfTextAtSize(token, size);
      if (lineWidth === 0 && space) continue;
      if (lineWidth + tokenWidth <= maxWidth) {
        add(font, token, span.underline);
        continue;
      }
      if (space) {
        flush();
        continue;
      }
      if (lineWidth > 0) flush();
      if (font.widthOfTextAtSize(token, size) <= maxWidth) {
        add(font, token, span.underline);
        continue;
      }
      let chunk = "";
      for (const ch of token) {
        const next = `${chunk}${ch}`;
        if (chunk !== "" && font.widthOfTextAtSize(next, size) > maxWidth) {
          add(font, chunk, span.underline);
          flush();
          chunk = ch;
        } else {
          chunk = next;
        }
      }
      if (chunk !== "") add(font, chunk, span.underline);
    }
  }
  if (line.length > 0) flush();
  if (lines.length === 0) lines.push([]);
  return lines;
}
