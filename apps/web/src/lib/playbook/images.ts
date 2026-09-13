import { PIECE_HIT_PX } from "./pieces";
import type { PlaybookImage, PlaybookImageMime } from "./types";
import { PLAYBOOK_IMAGE_MIMES } from "./types";

/** Cap so a live playbook save stays metadata-only and JSON export stays shareable. */
export const PLAYBOOK_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const PLAYBOOK_IMAGE_MAX_MB = 4;

/** Canvas size of the photo pin (matches a nade token / YouTube pin). */
export const PLAYBOOK_IMAGE_PIN_WIDTH = 16;
export const PLAYBOOK_IMAGE_PIN_HEIGHT = 18;

/** World-unit gap when stacking pins added from the sidebar. */
export const PLAYBOOK_IMAGE_PIN_STACK = 240;

/** Pointer slop: treat as a click, not a drag. */
export const PLAYBOOK_IMAGE_CLICK_PX = 4;

export const PLAYBOOK_IMAGE_PIN_FRAME = "#f2eee6";
export const PLAYBOOK_IMAGE_PIN_SKY = "#5b9fd6";
export const PLAYBOOK_IMAGE_PIN_LAND = "#3a6b4a";
export const PLAYBOOK_IMAGE_PIN_SUN = "#f6d36a";

export const PLAYBOOK_IMAGE_TYPE_ERROR = "Use a PNG, JPEG, or WebP image.";
export const PLAYBOOK_IMAGE_SIZE_ERROR = `Image must be ${PLAYBOOK_IMAGE_MAX_MB} MB or smaller.`;
export const PLAYBOOK_IMAGE_DECODE_ERROR = "Could not read that image.";

export type PlaybookImageFile =
  | {
      ok: true;
      name: string;
      mime: PlaybookImageMime;
      blob: Blob;
    }
  | { ok: false; message: string };

export function normalizePlaybookImageMime(value: string): PlaybookImageMime | null {
  const mime = value === "image/jpg" ? "image/jpeg" : value;
  return (PLAYBOOK_IMAGE_MIMES as readonly string[]).includes(mime)
    ? (mime as PlaybookImageMime)
    : null;
}

export function hitTestImage(
  images: readonly PlaybookImage[],
  screen: { x: number; y: number },
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  hitPx = PIECE_HIT_PX,
): PlaybookImage | null {
  const radiusSq = hitPx * hitPx;
  for (let i = images.length - 1; i >= 0; i--) {
    const image = images[i]!;
    const at = toScreen(image.x, image.y);
    const dx = at.x - screen.x;
    const dy = at.y - screen.y;
    if (dx * dx + dy * dy <= radiusSq) return image;
  }
  return null;
}

export function moveImage(
  images: readonly PlaybookImage[],
  id: string,
  x: number,
  y: number,
): PlaybookImage[] {
  return images.map((image) => (image.id === id ? { ...image, x, y } : image));
}

export function removeImage(images: readonly PlaybookImage[], id: string): PlaybookImage[] {
  return images.filter((image) => image.id !== id);
}

export function nextImagePin(
  images: readonly PlaybookImage[],
  fallback: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const last = images[images.length - 1];
  if (!last) return fallback;
  return { x: last.x + PLAYBOOK_IMAGE_PIN_STACK, y: last.y };
}

export function imageFileName(file: Pick<File, "name">): string {
  const trimmed = file.name.trim();
  return trimmed === "" ? "image" : trimmed;
}

export function playbookImageFilesFromList(list: FileList | readonly File[] | null): File[] {
  if (!list) return [];
  return Array.from(list);
}

export async function readPlaybookImageFile(file: File): Promise<PlaybookImageFile> {
  const mime = normalizePlaybookImageMime(file.type);
  if (!mime) return { ok: false, message: PLAYBOOK_IMAGE_TYPE_ERROR };
  if (file.size > PLAYBOOK_IMAGE_MAX_BYTES)
    return { ok: false, message: PLAYBOOK_IMAGE_SIZE_ERROR };
  try {
    const natural = await naturalImageSize(file);
    if (natural.width <= 0 || natural.height <= 0) {
      return { ok: false, message: PLAYBOOK_IMAGE_DECODE_ERROR };
    }
    return {
      ok: true,
      name: imageFileName(file),
      mime,
      blob: file,
    };
  } catch {
    return { ok: false, message: PLAYBOOK_IMAGE_DECODE_ERROR };
  }
}

export function makePlaybookImage(
  decoded: Extract<PlaybookImageFile, { ok: true }>,
  at: { x: number; y: number },
  id: string = crypto.randomUUID(),
): PlaybookImage {
  return {
    id,
    name: decoded.name,
    mime: decoded.mime,
    x: at.x,
    y: at.y,
  };
}

async function naturalImageSize(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}
