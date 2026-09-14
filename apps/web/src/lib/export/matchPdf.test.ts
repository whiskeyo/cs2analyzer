import { inflateSync } from "node:zlib";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import {
  MATCH_PDF_BOOKMARKS,
  MATCH_PDF_KICKER,
  MATCH_PDF_NO_NOTES,
  MATCH_PDF_NOTES,
  MATCH_PDF_RATING_NOTE,
  MATCH_PDF_REOPEN,
  MATCH_PDF_SCOREBOARD,
  PLAYBOOK_PDF_FOOTER,
  PLAYBOOK_PDF_LIGHT_PAGE_BG,
  PLAYBOOK_PDF_PAGE_BG,
} from "./constants";
import { buildMatchPdf } from "./matchPdf";
import { matchReport } from "./matchReport";

const EXPORTED_AT = Date.UTC(2026, 8, 14, 15, 0, 0);

/** 1×1 PNG (red). */
const TINY_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function decodePdfHex(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  let out = "";
  for (let i = 0; i + 1 < clean.length; i += 2) {
    out += String.fromCharCode(Number.parseInt(clean.slice(i, i + 2), 16));
  }
  return out;
}

function decodeUtf16BeHex(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  const units: number[] = [];
  for (let i = 0; i + 3 < clean.length; i += 4) {
    units.push(Number.parseInt(clean.slice(i, i + 4), 16));
  }
  return String.fromCharCode(...units);
}

function parseToUnicode(cmap: string): Map<number, string> {
  const map = new Map<number, string>();
  for (const pair of cmap.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
    map.set(Number.parseInt(pair[1] ?? "", 16), decodeUtf16BeHex(pair[2] ?? ""));
  }
  return map;
}

function decodeTj(hex: string, maps: Map<number, string>[]): string {
  const clean = hex.replace(/\s+/g, "");
  if (maps.length === 0 || clean.length % 4 !== 0) return decodePdfHex(clean);
  const outs: string[] = [];
  for (const map of maps) {
    let out = "";
    let mapped = 0;
    const total = clean.length / 4;
    for (let i = 0; i < clean.length; i += 4) {
      const cid = Number.parseInt(clean.slice(i, i + 4), 16);
      const ch = map.get(cid);
      if (ch == null) continue;
      out += ch;
      mapped += 1;
    }
    if (mapped === total && out !== "") outs.push(out);
  }
  if (outs.length > 0) return outs.join("\n");
  let out = "";
  let mapped = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const cid = Number.parseInt(clean.slice(i, i + 4), 16);
    const ch = maps.map((entry) => entry.get(cid)).find((value) => value != null);
    if (ch == null) continue;
    out += ch;
    mapped += 1;
  }
  return mapped > 0 ? out : decodePdfHex(clean);
}

function pdfDrawnText(bytes: Uint8Array): string {
  const raw = Buffer.from(bytes);
  const latin1 = raw.toString("latin1");
  const maps: Map<number, string>[] = [];
  const texts: string[] = [];
  const headerRe = /\/Length\s+(\d+)[\s\S]*?stream\r?\n/g;
  for (const match of latin1.matchAll(headerRe)) {
    const length = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    if (!Number.isFinite(length) || start + length > raw.length) continue;
    try {
      const inflated = inflateSync(raw.subarray(start, start + length)).toString("latin1");
      if (inflated.includes("beginbfchar") || inflated.includes("begincmap")) {
        maps.push(parseToUnicode(inflated));
      }
    } catch {
      // image / already-raw stream
    }
  }
  for (const match of latin1.matchAll(headerRe)) {
    const length = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    if (!Number.isFinite(length) || start + length > raw.length) continue;
    try {
      const inflated = inflateSync(raw.subarray(start, start + length)).toString("latin1");
      if (inflated.includes("beginbfchar") || inflated.includes("begincmap")) continue;
      if (!/(?:Tj|TJ)\b/.test(inflated)) continue;
      for (const hex of inflated.matchAll(/<([0-9A-Fa-f]+)>/g)) {
        texts.push(decodeTj(hex[1] ?? "", maps));
      }
    } catch {
      // image / already-raw stream
    }
  }
  return texts.join("\n");
}

function pdfContentHasRgb(bytes: Uint8Array, color: { r: number; g: number; b: number }): boolean {
  const raw = Buffer.from(bytes);
  const latin1 = raw.toString("latin1");
  const headerRe = /\/Length\s+(\d+)[\s\S]*?stream\r?\n/g;
  const fills = /([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+rg/g;
  for (const match of latin1.matchAll(headerRe)) {
    const length = Number(match[1]);
    const start = (match.index ?? 0) + match[0].length;
    if (!Number.isFinite(length) || start + length > raw.length) continue;
    try {
      const inflated = inflateSync(raw.subarray(start, start + length)).toString("latin1");
      for (const fill of inflated.matchAll(fills)) {
        const red = Number(fill[1]);
        const green = Number(fill[2]);
        const blue = Number(fill[3]);
        if (
          Math.abs(red - color.r) < 0.002 &&
          Math.abs(green - color.g) < 0.002 &&
          Math.abs(blue - color.b) < 0.002
        ) {
          return true;
        }
      }
    } catch {
      // image / already-raw stream
    }
  }
  return false;
}

function pdfImageCount(bytes: Uint8Array): number {
  return [
    ...Buffer.from(bytes)
      .toString("latin1")
      .matchAll(/\/Subtype\s*\/Image\b/g),
  ].length;
}

function scoredReplay() {
  return makeReplay({
    header: { map_name: "de_mirage", team_ct: "NAVI", team_t: "Vitality" },
    players: [makePlayer(0, "CT", "s1mple"), makePlayer(1, "T", "ZywOo")],
    rounds: [
      makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
    ],
    kills: [makeKill(200, 0, 1)],
    ticks: makeFreezeTicks(2, 1),
  });
}

describe("buildMatchPdf", () => {
  it("writes a scorecard one-pager with notes", async () => {
    const report = matchReport(
      scoredReplay(),
      [
        {
          round: 1,
          note: {
            ...emptyNote(),
            drawings: [{ type: "text", color: "#fff", x: 0, y: 0, text: "Flash mid" }],
          },
        },
      ],
      "match.dem",
      EXPORTED_AT,
    );
    const bytes = await buildMatchPdf(report);
    expect(String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0, bytes[3] ?? 0)).toBe(
      "%PDF",
    );
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
    const text = pdfDrawnText(bytes);
    expect(text).toContain(MATCH_PDF_KICKER);
    expect(text).toContain("Mirage: NAVI - Vitality");
    expect(text).toContain("NAVI - Vitality, 1:0 (1:0)");
    expect(text).toContain(MATCH_PDF_SCOREBOARD);
    expect(text).toContain("s1mple");
    expect(text).toContain("ZywOo");
    expect(text).toContain(MATCH_PDF_NOTES);
    expect(text).toContain("Flash mid");
    expect(text).toContain(MATCH_PDF_RATING_NOTE);
    expect(text).toContain(MATCH_PDF_REOPEN);
    expect(text).toContain(PLAYBOOK_PDF_FOOTER);
    expect(text).not.toContain(MATCH_PDF_NO_NOTES);
    expect(text).not.toContain(MATCH_PDF_BOOKMARKS);
    expect(pdfContentHasRgb(bytes, PLAYBOOK_PDF_PAGE_BG)).toBe(true);
  });

  it("uses the light page fill when the theme is light", async () => {
    const bytes = await buildMatchPdf(
      matchReport(scoredReplay(), [], "match.dem", EXPORTED_AT),
      {},
      "light",
    );
    expect(pdfContentHasRgb(bytes, PLAYBOOK_PDF_LIGHT_PAGE_BG)).toBe(true);
    expect(pdfContentHasRgb(bytes, PLAYBOOK_PDF_PAGE_BG)).toBe(false);
  });

  it("adds a still page per bookmark and keeps the cover list", async () => {
    const report = matchReport(
      scoredReplay(),
      [
        {
          round: 1,
          note: {
            ...emptyNote(),
            bookmarks: [{ color: "#fff", text: "Entry timing", tick: 200 }],
          },
        },
      ],
      "match.dem",
      EXPORTED_AT,
    );
    const bytes = await buildMatchPdf(report, { "1:0": TINY_PNG });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(2);
    const text = pdfDrawnText(bytes);
    expect(text).toContain(MATCH_PDF_BOOKMARKS);
    expect(text).toContain("Entry timing");
    expect(pdfImageCount(bytes)).toBeGreaterThan(0);
  });

  it("still builds a bookmark page when the still is not a PNG", async () => {
    const report = matchReport(
      scoredReplay(),
      [
        {
          round: 1,
          note: { ...emptyNote(), bookmarks: [{ color: "#fff", text: "Peek", tick: 200 }] },
        },
      ],
      "match.dem",
      EXPORTED_AT,
    );
    const bytes = await buildMatchPdf(report, { "1:0": new Uint8Array([1, 2, 3]) });
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(2);
    expect(pdfDrawnText(bytes)).toContain("Peek");
  });

  it("round-trips Polish letters through the embedded font", async () => {
    const replay = makeReplay({
      header: { map_name: "de_mirage", team_ct: "Łódź", team_t: "Gdańsk" },
      players: [makePlayer(0, "CT", "Ąćę"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "CT" })],
      ticks: makeFreezeTicks(2, 1),
    });
    const report = matchReport(
      replay,
      [
        {
          round: 1,
          note: {
            ...emptyNote(),
            drawings: [{ type: "text", color: "#fff", x: 0, y: 0, text: "zawinięcie" }],
          },
        },
      ],
      "mecz.dem",
      EXPORTED_AT,
    );
    const text = pdfDrawnText(await buildMatchPdf(report));
    expect(text).toContain("Mirage: Łódź - Gdańsk");
    expect(text).toContain("zawinięcie");
    expect(text).toContain("Ąćę");
  });

  it("prints the empty-notes line when nothing is written", async () => {
    const text = pdfDrawnText(
      await buildMatchPdf(matchReport(scoredReplay(), [], "match.dem", EXPORTED_AT)),
    );
    expect(text).toContain(MATCH_PDF_NO_NOTES);
    expect(text).not.toContain(MATCH_PDF_BOOKMARKS);
  });
});
