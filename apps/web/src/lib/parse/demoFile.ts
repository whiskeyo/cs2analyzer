import { DEMO_MAGIC_BYTES, DEMO_MAX_BYTES } from "@/lib/shared/constants";

/** Source 2 CS2 GOTV / POV filestamp (`PBDEMS2\0`). */
export const CS2_DEMO_MAGIC = "PBDEMS2\0";

/** Source 1 HL2 demo filestamp. */
export const SOURCE1_DEMO_MAGIC = "HL2DEMO";

const GZIP_MAGIC0 = 0x1f;
const GZIP_MAGIC1 = 0x8b;

export interface DemoFileIssue {
  file: File;
  message: string;
}

function quotedName(fileName: string): string {
  return fileName.trim() === "" ? "This file" : `"${fileName}"`;
}

export function demoGzipMessage(fileName: string): string {
  return `${quotedName(fileName)} is gzip-compressed. Decompress it first (unsupported gzip), then drop the .dem.`;
}

export function demoEmptyMessage(fileName: string): string {
  return `${quotedName(fileName)} is empty. Drop a complete GOTV .dem.`;
}

export function demoOversizedMessage(fileName: string): string {
  return `${quotedName(fileName)} is too large to parse in the browser (over 1 GB).`;
}

export function demoExtensionMessage(fileName: string): string {
  return `${quotedName(fileName)} is not a .dem file. Drop a Counter-Strike 2 GOTV demo (or a notes .json).`;
}

export function demoPovMessage(fileName: string): string {
  return `${quotedName(fileName)} looks like a POV demo. Drop a GOTV .dem — POV recordings are not supported.`;
}

export function demoSource1Message(fileName: string): string {
  return `${quotedName(fileName)} is a Source 1 demo. This viewer needs a Counter-Strike 2 GOTV .dem.`;
}

export function demoNotCs2Message(fileName: string): string {
  return `${quotedName(fileName)} is not a Counter-Strike 2 demo. Drop a GOTV .dem from FACEIT, Premier, or matchmaking.`;
}

export function demoCorruptMessage(fileName?: string): string {
  const who = fileName ? quotedName(fileName) : "This file";
  return `${who} could not be parsed. It may be corrupt, truncated, or a POV demo — drop a complete GOTV .dem.`;
}

export function demoTruncatedMessage(fileName?: string): string {
  const who = fileName ? quotedName(fileName) : "This file";
  return `${who} looks truncated or corrupt. Re-download the GOTV .dem and drop it again.`;
}

function stemWithoutDem(fileName: string): string {
  return fileName.replace(/\.dem$/i, "");
}

function looksLikePovName(fileName: string): boolean {
  return stemWithoutDem(fileName)
    .split(/[^a-z0-9]+/i)
    .some((part) => part.toLowerCase() === "pov");
}

function isGzipType(type: string): boolean {
  return type === "application/gzip" || type === "application/x-gzip";
}

function startsWithAscii(bytes: Uint8Array, ascii: string): boolean {
  if (bytes.length < ascii.length) return false;
  for (let i = 0; i < ascii.length; i++) {
    if (bytes[i] !== ascii.charCodeAt(i)) return false;
  }
  return true;
}

export function isGzipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC0 && bytes[1] === GZIP_MAGIC1;
}

/** Sync checks: name, MIME, empty, size. Does not read file bytes. */
export function demoFileNameIssue(file: File): string | null {
  const name = file.name;
  if (file.size === 0) return demoEmptyMessage(name);
  if (file.size > DEMO_MAX_BYTES) return demoOversizedMessage(name);
  if (isGzipType(file.type) || /\.dem\.gz$/i.test(name) || /\.gz$/i.test(name)) {
    return demoGzipMessage(name);
  }
  if (!/\.dem$/i.test(name)) return demoExtensionMessage(name);
  if (looksLikePovName(name)) return demoPovMessage(name);
  return null;
}

/** Cheap magic sniff: gzip, Source 1, or not PBDEMS2. */
export function sniffDemoMagic(bytes: Uint8Array, fileName: string): string | null {
  if (isGzipBytes(bytes)) return demoGzipMessage(fileName);
  if (startsWithAscii(bytes, SOURCE1_DEMO_MAGIC)) return demoSource1Message(fileName);
  if (!startsWithAscii(bytes, CS2_DEMO_MAGIC)) return demoNotCs2Message(fileName);
  return null;
}

export async function inspectDemoFile(file: File): Promise<string | null> {
  const named = demoFileNameIssue(file);
  if (named) return named;
  const buf = await file.slice(0, DEMO_MAGIC_BYTES).arrayBuffer();
  return sniffDemoMagic(new Uint8Array(buf), file.name);
}

export async function partitionDemoFiles(files: readonly File[]): Promise<{
  ok: File[];
  issues: DemoFileIssue[];
}> {
  const ok: File[] = [];
  const issues: DemoFileIssue[] = [];
  for (const file of files) {
    const message = await inspectDemoFile(file);
    if (message) issues.push({ file, message });
    else ok.push(file);
  }
  return { ok, issues };
}

/**
 * Map cryptic WASM / source2-demo failures onto drop-zone copy.
 * Already-friendly strings (Wasm fetch, decode field names) pass through.
 */
export function formatParseError(raw: string, fileName?: string): string {
  const text = raw.toLowerCase();
  if (
    text.includes("source 2 replay") ||
    text.includes("filestamp") ||
    text.includes("hl2demo") ||
    text.includes("pbdems2")
  ) {
    return demoNotCs2Message(fileName ?? "");
  }
  if (
    text.includes("truncated") ||
    text.includes("unexpected eof") ||
    text.includes("unexpected end") ||
    text.includes("end of file")
  ) {
    return demoTruncatedMessage(fileName);
  }
  if (text.startsWith("failed to parse demo") || text.includes("corrupt")) {
    return demoCorruptMessage(fileName);
  }
  return raw;
}
