import {
  makePlaybookImage,
  nextImagePin,
  playbookImageFilesFromList,
  readPlaybookImageFile,
} from "./images";
import { rememberPlaybookImage } from "./playbookImageBitmaps";
import { putPlaybookImageBlob } from "./playbookImageStore";
import type { PlaybookImage } from "./types";

export async function ingestPlaybookImages(
  files: readonly File[],
  current: readonly PlaybookImage[],
  origin?: { x: number; y: number },
): Promise<{ images: PlaybookImage[]; error: string | null }> {
  const list = playbookImageFilesFromList(files);
  if (list.length === 0) return { images: [...current], error: null };
  const next = current.slice();
  let at = origin ?? nextImagePin(current);
  let error: string | null = null;
  for (const file of list) {
    const decoded = await readPlaybookImageFile(file);
    if (!decoded.ok) {
      if (!error) error = decoded.message;
      continue;
    }
    const image = makePlaybookImage(decoded, at);
    await putPlaybookImageBlob(image.id, decoded.blob);
    rememberPlaybookImage(image.id, decoded.blob);
    next.push(image);
    at = nextImagePin(next);
  }
  return { images: next, error };
}
