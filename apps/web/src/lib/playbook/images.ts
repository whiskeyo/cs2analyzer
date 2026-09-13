import { PIECE_HIT_PX } from "./pieces";
import type { PlaybookImage, PlaybookImageMime } from "./types";
import { PLAYBOOK_IMAGE_MIMES } from "./types";

/** Cap so a live playbook save stays metadata-only and JSON export stays shareable. */
export const PLAYBOOK_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
export const PLAYBOOK_IMAGE_MAX_MB = 4;

/** Landscape picture-frame pin (readable next to a YouTube mark). */
export const PLAYBOOK_IMAGE_PIN_WIDTH = 16;
export const PLAYBOOK_IMAGE_PIN_HEIGHT = 14;

/** World-unit gap when stacking pins added from the sidebar. */
export const PLAYBOOK_IMAGE_PIN_STACK = 240;

/** Pointer slop: treat as a click, not a drag. */
export const PLAYBOOK_IMAGE_CLICK_PX = 4;

export const PLAYBOOK_IMAGE_PIN_FRAME = "#f2eee6";
export const PLAYBOOK_IMAGE_PIN_STROKE = "#0b0e12";
export const PLAYBOOK_IMAGE_PIN_SKY = "#5b9fd6";
export const PLAYBOOK_IMAGE_PIN_LAND = "#3a6b4a";
export const PLAYBOOK_IMAGE_PIN_SUN = "#f6d36a";
export const PLAYBOOK_IMAGE_PIN_INDEX_BG = "#0b0e12";
export const PLAYBOOK_IMAGE_PIN_INDEX_INK = "#f4f1ea";
export const PLAYBOOK_IMAGE_PIN_INDEX_SIZE = 7;

export const PLAYBOOK_IMAGE_TYPE_ERROR = "Use a PNG, JPEG, or WebP image.";
export const PLAYBOOK_IMAGE_SIZE_ERROR = `Image must be ${PLAYBOOK_IMAGE_MAX_MB} MB or smaller.`;
export const PLAYBOOK_IMAGE_DECODE_ERROR = "Could not read that image.";
export const PLAYBOOK_IMAGE_URL_PARSE_ERROR = "Paste an image URL (http or https).";
export const PLAYBOOK_IMAGE_URL_ERROR = "Could not load that image URL.";

const IMGUR_PAGE_HOSTS = new Set(["imgur.com", "www.imgur.com", "m.imgur.com"]);
const IMGUR_DIRECT_HOST = "i.imgur.com";
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47] as const;
const JPEG_MAGIC = [0xff, 0xd8, 0xff] as const;
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50] as const;
const SNIFF_BYTES = 12;

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

/** 1-based index when a floor has more than one photo; otherwise omit. */
export function playbookImagePinIndex(images: readonly PlaybookImage[], id: string): number | null {
  if (images.length < 2) return null;
  const index = images.findIndex((image) => image.id === id);
  return index >= 0 ? index + 1 : null;
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

export function imageFileNameFromUrl(url: URL): string {
  const last = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
  let decoded = last;
  try {
    decoded = decodeURIComponent(last);
  } catch {
    decoded = last;
  }
  const trimmed = decoded.trim();
  return trimmed === "" ? "image" : trimmed;
}

export function parsePlaybookImageUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  for (const candidate of [trimmed, `https://${trimmed}`]) {
    try {
      const url = new URL(candidate);
      if (url.protocol === "http:" || url.protocol === "https:") return url;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** Imgur page → `i.imgur.com` so we fetch bytes, not HTML. Never uploads. */
export function imgurDirectImageUrl(url: URL): URL | null {
  const host = url.hostname.toLowerCase();
  if (host === IMGUR_DIRECT_HOST) return url;
  if (!IMGUR_PAGE_HOSTS.has(host)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const first = parts[0];
  if (first == null || first === "a" || first === "gallery" || first === "t" || first === "r") {
    return null;
  }
  const id = first.replace(/\.jpe?g$/i, ".jpg");
  if (/\.(png|jpg|webp)$/i.test(id)) {
    return new URL(`https://${IMGUR_DIRECT_HOST}/${id}`);
  }
  if (/^[A-Za-z0-9]+$/.test(id)) {
    return new URL(`https://${IMGUR_DIRECT_HOST}/${id}.jpg`);
  }
  return null;
}

export function playbookImageCandidateUrls(raw: string): URL[] | null {
  const parsed = parsePlaybookImageUrl(raw);
  if (!parsed) return null;
  const out = [parsed];
  const imgur = imgurDirectImageUrl(parsed);
  if (imgur && imgur.href !== parsed.href) out.push(imgur);
  return out;
}

export function sniffPlaybookImageMime(bytes: Uint8Array): PlaybookImageMime | null {
  if (bytes.length >= PNG_MAGIC.length && PNG_MAGIC.every((b, i) => bytes[i] === b)) {
    return "image/png";
  }
  if (bytes.length >= JPEG_MAGIC.length && JPEG_MAGIC.every((b, i) => bytes[i] === b)) {
    return "image/jpeg";
  }
  if (
    bytes.length >= SNIFF_BYTES &&
    RIFF_MAGIC.every((b, i) => bytes[i] === b) &&
    WEBP_MAGIC.every((b, i) => bytes[8 + i] === b)
  ) {
    return "image/webp";
  }
  return null;
}

function mimeFromContentType(value: string | null): PlaybookImageMime | null {
  if (!value) return null;
  return normalizePlaybookImageMime(value.split(";")[0]!.trim().toLowerCase());
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

async function fetchPlaybookImage(url: URL): Promise<PlaybookImageFile> {
  let response: Response;
  try {
    response = await fetch(url.href, {
      headers: { Accept: PLAYBOOK_IMAGE_MIMES.join(",") },
    });
  } catch {
    return { ok: false, message: PLAYBOOK_IMAGE_URL_ERROR };
  }
  if (!response.ok) return { ok: false, message: PLAYBOOK_IMAGE_URL_ERROR };
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > PLAYBOOK_IMAGE_MAX_BYTES) {
    return { ok: false, message: PLAYBOOK_IMAGE_SIZE_ERROR };
  }
  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    return { ok: false, message: PLAYBOOK_IMAGE_URL_ERROR };
  }
  if (blob.size > PLAYBOOK_IMAGE_MAX_BYTES) {
    return { ok: false, message: PLAYBOOK_IMAGE_SIZE_ERROR };
  }
  const header = new Uint8Array(await blob.slice(0, SNIFF_BYTES).arrayBuffer());
  const mime = mimeFromContentType(blob.type) ?? sniffPlaybookImageMime(header);
  if (!mime) return { ok: false, message: PLAYBOOK_IMAGE_TYPE_ERROR };
  const typed = blob.type === mime ? blob : new Blob([blob], { type: mime });
  try {
    const natural = await naturalImageSize(typed);
    if (natural.width <= 0 || natural.height <= 0) {
      return { ok: false, message: PLAYBOOK_IMAGE_DECODE_ERROR };
    }
    return {
      ok: true,
      name: imageFileNameFromUrl(url),
      mime,
      blob: typed,
    };
  } catch {
    return { ok: false, message: PLAYBOOK_IMAGE_DECODE_ERROR };
  }
}

export async function readPlaybookImageUrl(raw: string): Promise<PlaybookImageFile> {
  const urls = playbookImageCandidateUrls(raw);
  if (!urls) return { ok: false, message: PLAYBOOK_IMAGE_URL_PARSE_ERROR };
  let last: PlaybookImageFile = { ok: false, message: PLAYBOOK_IMAGE_URL_ERROR };
  for (const url of urls) {
    const decoded = await fetchPlaybookImage(url);
    if (decoded.ok) return decoded;
    last = decoded;
    if (decoded.message === PLAYBOOK_IMAGE_SIZE_ERROR) return decoded;
  }
  return last;
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
