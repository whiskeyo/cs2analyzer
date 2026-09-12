import type { PDFDocument, PDFPage } from "pdf-lib";
import { pdfSafeText } from "./pdfText";

type PdfName = (typeof import("pdf-lib"))["PDFName"];
type PdfString = (typeof import("pdf-lib"))["PDFString"];

export interface PdfLinkHit {
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function addUriLink(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  uri: string,
  PDFString: PdfString,
): void {
  const annot = page.doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [x, y, x + width, y + height],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "URI",
      URI: PDFString.of(uri),
    },
  });
  page.node.addAnnot(page.doc.context.register(annot));
}

export function addGoToLink(from: PDFPage, hit: PdfLinkHit, dest: PDFPage): void {
  const top = dest.getHeight();
  const annot = from.doc.context.obj({
    Type: "Annot",
    Subtype: "Link",
    Rect: [hit.x, hit.y, hit.x + hit.width, hit.y + hit.height],
    Border: [0, 0, 0],
    A: {
      Type: "Action",
      S: "GoTo",
      D: [dest.ref, "XYZ", null, top, null],
    },
  });
  from.node.addAnnot(from.doc.context.register(annot));
}

export function addOutline(
  pdf: PDFDocument,
  PDFNameCtor: PdfName,
  PDFStringCtor: PdfString,
  items: { title: string; page: PDFPage }[],
): void {
  if (items.length === 0) return;
  const context = pdf.context;
  const outlinesRef = context.nextRef();
  const itemRefs = items.map(() => context.nextRef());
  items.forEach((item, index) => {
    const prev = itemRefs[index - 1];
    const next = itemRefs[index + 1];
    const node = {
      Title: PDFStringCtor.of(pdfSafeText(item.title)),
      Parent: outlinesRef,
      Dest: [item.page.ref, "XYZ", null, item.page.getHeight(), null],
      ...(prev ? { Prev: prev } : {}),
      ...(next ? { Next: next } : {}),
    };
    const ref = itemRefs[index];
    if (ref) context.assign(ref, context.obj(node));
  });
  const first = itemRefs[0];
  const last = itemRefs[itemRefs.length - 1];
  if (!first || !last) return;
  context.assign(
    outlinesRef,
    context.obj({
      Type: "Outlines",
      First: first,
      Last: last,
      Count: items.length,
    }),
  );
  pdf.catalog.set(PDFNameCtor.of("Outlines"), outlinesRef);
}
