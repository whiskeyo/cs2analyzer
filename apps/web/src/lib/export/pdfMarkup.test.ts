import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { wrapMarkupParagraph } from "./pdfMarkup";

describe("wrapMarkupParagraph", () => {
  it("drops markers and keeps styled runs", async () => {
    const pdf = await PDFDocument.create();
    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
    };
    const lines = wrapMarkupParagraph(fonts, "Smoke **stairs**", 11, 400);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.map((run) => run.text).join("")).toBe("Smoke stairs");
    expect(lines[0]?.[1]).toMatchObject({ underline: false });
    expect(lines[0]?.some((run) => run.font === fonts.bold && run.text === "stairs")).toBe(true);
  });
});
