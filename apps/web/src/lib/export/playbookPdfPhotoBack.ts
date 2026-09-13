import type { PDFPage, RGB } from "pdf-lib";
import {
  PLAYBOOK_PDF_MARGIN,
  PLAYBOOK_PDF_PHOTO_BACK_ARROW_GAP,
  PLAYBOOK_PDF_PHOTO_BACK_ARROW_SIZE,
} from "./constants";

/** 90° CCW in the left page margin, centered on the photo. Arrow sits above the label. */
export function playbookPdfPhotoBackPlacement(
  photo: { y: number; height: number },
  labelWidth: number,
  labelSize: number,
  margin = PLAYBOOK_PDF_MARGIN,
): {
  textX: number;
  textY: number;
  arrowX: number;
  arrowY: number;
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const stack = labelWidth + PLAYBOOK_PDF_PHOTO_BACK_ARROW_GAP + PLAYBOOK_PDF_PHOTO_BACK_ARROW_SIZE;
  const textX = margin / 2 + labelSize / 2;
  const textY = stack >= photo.height ? photo.y : photo.y + (photo.height - stack) / 2;
  const arrowY = textY + labelWidth + PLAYBOOK_PDF_PHOTO_BACK_ARROW_GAP;
  return {
    textX,
    textY,
    arrowX: textX - labelSize / 2,
    arrowY,
    x: textX - labelSize,
    y: textY,
    width: labelSize,
    height: stack,
  };
}

export function drawPlaybookPdfPhotoBackArrow(
  page: PDFPage,
  x: number,
  y: number,
  size: number,
  color: RGB,
): void {
  page.drawSvgPath(`M ${x} ${y + size} L ${x - size / 2} ${y} L ${x + size / 2} ${y} Z`, { color });
}
