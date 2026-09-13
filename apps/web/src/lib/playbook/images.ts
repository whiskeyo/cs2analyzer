import type { PlaybookImage, PlaybookImageMime } from "./types";
import { PLAYBOOK_IMAGE_MIMES } from "./types";

/** Cap so a live playbook save stays metadata-only and JSON export stays shareable. */
export const PLAYBOOK_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const PLAYBOOK_IMAGE_MAX_MB = 4;

/** Default world width; height follows the source aspect. */
export const PLAYBOOK_IMAGE_DEFAULT_WIDTH = 1024;
export const PLAYBOOK_IMAGE_MIN_WIDTH = 160;

/** World-unit gap when stacking stills added from the sidebar. */
export const PLAYBOOK_IMAGE_STACK = 240;

/** Corner handle drawn on a selected still. */
export const PLAYBOOK_IMAGE_HANDLE_PX = 8;
export const PLAYBOOK_IMAGE_HANDLE_HIT_PX = 12;

/** Pointer slop: treat as a click, not a drag. */
export const PLAYBOOK_IMAGE_CLICK_PX = 4;

export const PLAYBOOK_IMAGE_TYPE_ERROR = "Use a PNG, JPEG, or WebP image.";
export const PLAYBOOK_IMAGE_SIZE_ERROR = `Image must be ${PLAYBOOK_IMAGE_MAX_MB} MB or smaller.`;
export const PLAYBOOK_IMAGE_DECODE_ERROR = "Could not read that image.";

export type ImageHandle = "nw" | "ne" | "sw" | "se";

export type PlaybookImageFile =
  | {
      ok: true;
      name: string;
      mime: PlaybookImageMime;
      blob: Blob;
      width: number;
      height: number;
    }
  | { ok: false; message: string };

export function normalizePlaybookImageMime(value: string): PlaybookImageMime | null {
  const mime = value === "image/jpg" ? "image/jpeg" : value;
  return (PLAYBOOK_IMAGE_MIMES as readonly string[]).includes(mime)
    ? (mime as PlaybookImageMime)
    : null;
}

export function imageScreenRect(
  image: PlaybookImage,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
): { x: number; y: number; w: number; h: number } {
  const a = toScreen(image.x - image.width / 2, image.y - image.height / 2);
  const b = toScreen(image.x + image.width / 2, image.y + image.height / 2);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

export function hitTestImage(
  images: readonly PlaybookImage[],
  screen: { x: number; y: number },
  toScreen: (wx: number, wy: number) => { x: number; y: number },
): PlaybookImage | null {
  for (let i = images.length - 1; i >= 0; i--) {
    const image = images[i]!;
    const rect = imageScreenRect(image, toScreen);
    if (pointInRect(screen, rect)) return image;
  }
  return null;
}

export function hitTestImageHandle(
  image: PlaybookImage,
  screen: { x: number; y: number },
  toScreen: (wx: number, wy: number) => { x: number; y: number },
  hitPx = PLAYBOOK_IMAGE_HANDLE_HIT_PX,
): ImageHandle | null {
  const handles = imageHandlePoints(image, toScreen);
  for (const [handle, at] of handles) {
    if (Math.hypot(at.x - screen.x, at.y - screen.y) <= hitPx) return handle;
  }
  return null;
}

export function imageHandlePoints(
  image: PlaybookImage,
  toScreen: (wx: number, wy: number) => { x: number; y: number },
): readonly [ImageHandle, { x: number; y: number }][] {
  const rect = imageScreenRect(image, toScreen);
  return [
    ["nw", { x: rect.x, y: rect.y }],
    ["ne", { x: rect.x + rect.w, y: rect.y }],
    ["sw", { x: rect.x, y: rect.y + rect.h }],
    ["se", { x: rect.x + rect.w, y: rect.y + rect.h }],
  ];
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

export function resizeImage(
  images: readonly PlaybookImage[],
  id: string,
  handle: ImageHandle,
  world: { x: number; y: number },
): PlaybookImage[] {
  return images.map((image) =>
    image.id === id ? resizeImageFromHandle(image, handle, world) : image,
  );
}

export function resizeImageFromHandle(
  image: PlaybookImage,
  handle: ImageHandle,
  world: { x: number; y: number },
): PlaybookImage {
  const aspect = image.width / image.height;
  const hw = image.width / 2;
  const hh = image.height / 2;
  const left = image.x - hw;
  const right = image.x + hw;
  const bottom = image.y - hh;
  const top = image.y + hh;
  const anchor =
    handle === "nw"
      ? { x: right, y: bottom }
      : handle === "ne"
        ? { x: left, y: bottom }
        : handle === "sw"
          ? { x: right, y: top }
          : { x: left, y: top };
  const widthFromX = Math.abs(world.x - anchor.x);
  const heightFromY = Math.abs(world.y - anchor.y);
  const width = Math.max(widthFromX, heightFromY * aspect, PLAYBOOK_IMAGE_MIN_WIDTH);
  const height = width / aspect;
  const signX = world.x >= anchor.x ? 1 : -1;
  const signY = world.y >= anchor.y ? 1 : -1;
  return {
    ...image,
    width,
    height,
    x: anchor.x + signX * (width / 2),
    y: anchor.y + signY * (height / 2),
  };
}

export function nextImageOrigin(
  images: readonly PlaybookImage[],
  fallback: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const last = images[images.length - 1];
  if (!last) return fallback;
  return { x: last.x + PLAYBOOK_IMAGE_STACK, y: last.y };
}

export function scaleImageSize(
  naturalWidth: number,
  naturalHeight: number,
  defaultWidth = PLAYBOOK_IMAGE_DEFAULT_WIDTH,
): { width: number; height: number } {
  const width = defaultWidth;
  const height = width * (naturalHeight / naturalWidth);
  return { width, height };
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
    const size = scaleImageSize(natural.width, natural.height);
    return {
      ok: true,
      name: imageFileName(file),
      mime,
      blob: file,
      width: size.width,
      height: size.height,
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
    width: decoded.width,
    height: decoded.height,
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

function pointInRect(
  point: { x: number; y: number },
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.w &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.h
  );
}
