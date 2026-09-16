import type { DragEvent } from "react";
import { filesFromDataTransfer, rememberDemoFileHandles } from "@/lib/notes/projectStore";

/** Files from a drop, plus File System Access handles when the browser exposes them. */
export async function takeDroppedDemoFiles(
  e: DragEvent,
  onFiles: (files: File[]) => void,
): Promise<void> {
  e.preventDefault();
  const { files, handles } = await filesFromDataTransfer(e.dataTransfer);
  rememberDemoFileHandles(handles);
  if (files.length > 0) onFiles(files);
}

export function takePickedDemoFiles(
  files: File[],
  handles: Iterable<FileSystemFileHandle>,
  onFiles: (files: File[]) => void,
): void {
  rememberDemoFileHandles(handles);
  if (files.length > 0) onFiles(files);
}
