import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { loadPlaybookPdfFontBytes, registerPlaybookPdfFontkit } from "./pdfFonts";

const TTF_TRUE_TYPE = [0x00, 0x01, 0x00, 0x00];

describe("loadPlaybookPdfFontBytes", () => {
  it("loads compact Latin-extended TTF faces that can encode Polish", async () => {
    const fonts = await loadPlaybookPdfFontBytes();
    for (const bytes of [fonts.regular, fonts.bold, fonts.italic, fonts.boldItalic]) {
      expect([...bytes.slice(0, 4)]).toEqual(TTF_TRUE_TYPE);
      expect(bytes.byteLength).toBeGreaterThan(8_000);
      expect(bytes.byteLength).toBeLessThan(80_000);
    }
    const pdf = await PDFDocument.create();
    await registerPlaybookPdfFontkit(pdf);
    const font = await pdf.embedFont(fonts.regular, { subset: true });
    expect(font.widthOfTextAtSize("Łódź / zawinięcie", 12)).toBeGreaterThan(0);
  });
});
