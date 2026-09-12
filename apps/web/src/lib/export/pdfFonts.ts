/** Liberation Sans 2.1.5 (OFL-1.1), subset to Latin + Latin Extended-A for Polish. */

import type { PDFDocument } from "pdf-lib";

const FACES = {
  regular: new URL("./fonts/LiberationSans-Regular.ttf", import.meta.url),
  bold: new URL("./fonts/LiberationSans-Bold.ttf", import.meta.url),
  italic: new URL("./fonts/LiberationSans-Italic.ttf", import.meta.url),
  boldItalic: new URL("./fonts/LiberationSans-BoldItalic.ttf", import.meta.url),
} as const;

export interface PlaybookPdfFontBytes {
  regular: Uint8Array;
  bold: Uint8Array;
  italic: Uint8Array;
  boldItalic: Uint8Array;
}

async function loadFontBytes(url: URL): Promise<Uint8Array> {
  if (url.protocol === "file:") {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    return new Uint8Array(await readFile(fileURLToPath(url)));
  }
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not load PDF font ${url.href}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function loadPlaybookPdfFontBytes(): Promise<PlaybookPdfFontBytes> {
  return {
    regular: await loadFontBytes(FACES.regular),
    bold: await loadFontBytes(FACES.bold),
    italic: await loadFontBytes(FACES.italic),
    boldItalic: await loadFontBytes(FACES.boldItalic),
  };
}

/** pdf-lib only embeds custom TTFs after a fontkit instance is registered. */
export async function registerPlaybookPdfFontkit(pdf: PDFDocument): Promise<void> {
  const fontkit = (await import("@pdf-lib/fontkit")).default;
  pdf.registerFontkit(fontkit);
}
