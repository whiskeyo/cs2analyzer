/** Trigger a browser download for in-memory data (notes export, CSV, etc.). */
export function downloadBlob(filename: string, mime: string, data: BlobPart): void {
  const blob = new Blob([data], { type: mime });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}
