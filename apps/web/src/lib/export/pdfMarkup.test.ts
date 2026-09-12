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

  it("paints nested and combined marks without leftover markers", async () => {
    const pdf = await PDFDocument.create();
    const fonts = {
      regular: await pdf.embedFont(StandardFonts.Helvetica),
      bold: await pdf.embedFont(StandardFonts.HelveticaBold),
      italic: await pdf.embedFont(StandardFonts.HelveticaOblique),
      boldItalic: await pdf.embedFont(StandardFonts.HelveticaBoldOblique),
    };
    const samples = [
      "**bold *italic* still bold**",
      "*italic **bold** still italic*",
      "__*both*__",
      "**__both__**",
      "__**both**__",
      "**__*both**__*",
    ];
    for (const sample of samples) {
      const lines = wrapMarkupParagraph(fonts, sample, 11, 400);
      const text = lines
        .flat()
        .map((run) => run.text)
        .join("");
      expect(text, sample).not.toContain("*");
      expect(text, sample).not.toContain("_");
    }
    const nested = wrapMarkupParagraph(fonts, "**bold *italic* still**", 11, 400);
    expect(nested[0]?.some((run) => run.font === fonts.bold && run.text === "bold ")).toBe(true);
    expect(nested[0]?.some((run) => run.font === fonts.boldItalic && run.text === "italic")).toBe(
      true,
    );
    const combo = wrapMarkupParagraph(fonts, "__*both*__", 11, 400);
    expect(combo[0]).toEqual([
      expect.objectContaining({ text: "both", font: fonts.italic, underline: true }),
    ]);
    const triple = wrapMarkupParagraph(fonts, "**__*both**__*", 11, 400);
    expect(triple[0]).toEqual([
      expect.objectContaining({ text: "both", font: fonts.boldItalic, underline: true }),
    ]);
  });
});
