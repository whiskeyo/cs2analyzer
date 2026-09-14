import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { NOTE_BOOKMARK_TITLE } from "@/lib/shared/constants";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import {
  MATCH_PDF_ECO_ECO,
  MATCH_PDF_ECO_KNIFE,
  MATCH_PDF_ECO_PISTOL,
  MATCH_PDF_FILE_FALLBACK,
} from "./constants";
import {
  bookmarkStillTick,
  matchDemoStem,
  matchPdfFilename,
  matchPdfHeading,
  matchPdfStem,
  matchReport,
  matchRoundEconomy,
} from "./matchReport";

const EXPORTED_AT = Date.UTC(2026, 8, 14, 15, 0, 0);

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

describe("matchPdfStem", () => {
  it("slugs map, teams, and demo name", () => {
    expect(matchPdfStem(["Mirage", "NAVI", "Vitality", "match"])).toBe(
      "mirage-navi-vitality-match",
    );
    expect(matchPdfStem(["  ", "???"])).toBe(MATCH_PDF_FILE_FALLBACK);
  });
});

describe("matchDemoStem", () => {
  it("strips .dem and falls back", () => {
    expect(matchDemoStem("faceit-bo1.dem")).toBe("faceit-bo1");
    expect(matchDemoStem("")).toBe(MATCH_PDF_FILE_FALLBACK);
  });
});

describe("matchPdfHeading", () => {
  it("uses pretty map and starting sides", () => {
    expect(matchPdfHeading("Mirage", "NAVI", "Vitality")).toBe("Mirage: NAVI - Vitality");
  });
});

describe("matchRoundEconomy", () => {
  it("labels knife, pistol, and later-round buy", () => {
    const replay = scoredReplay();
    expect(matchRoundEconomy(replay, makeRound({ number: 0, is_knife: true }))).toBe(
      MATCH_PDF_ECO_KNIFE,
    );
    expect(matchRoundEconomy(replay, makeRound({ number: 1 }))).toBe(MATCH_PDF_ECO_PISTOL);
    expect(matchRoundEconomy(replay, makeRound({ number: 4, freeze_end_tick: 64 }))).toBe(
      MATCH_PDF_ECO_ECO,
    );
  });
});

describe("bookmarkStillTick", () => {
  it("prefers the overlay window, then the pin tick, then freeze", () => {
    const round = makeRound({ number: 1, freeze_end_tick: 64, start_tick: 0 });
    expect(bookmarkStillTick({ color: "#fff", text: "a", tick: 90, start_tick: 80 }, round)).toBe(
      80,
    );
    expect(bookmarkStillTick({ color: "#fff", text: "a", tick: 90 }, round)).toBe(90);
    expect(bookmarkStillTick({ color: "#fff", text: "a", tick: Number.NaN }, round)).toBe(64);
  });
});

describe("matchReport", () => {
  it("builds a scorecard, notes by round, and bookmark captions", () => {
    const replay = scoredReplay();
    const report = matchReport(
      replay,
      [
        {
          round: 1,
          note: {
            ...emptyNote(),
            drawings: [
              { type: "text", color: "#fff", x: 1, y: 2, text: "Flash mid" },
              { type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] },
              { type: "text", color: "#fff", x: 1, y: 2, text: "hidden", hidden: true },
            ],
            bookmarks: [
              { color: "#f00", text: "Entry", tick: 200 },
              { color: "#0f0", text: "Skip", tick: 210, hidden: true },
            ],
          },
        },
      ],
      "navi-vitality.dem",
      EXPORTED_AT,
    );
    expect(report.heading).toBe("Mirage: NAVI - Vitality");
    expect(report.scoreLine).toBe("NAVI - Vitality, 1:0 (1:0)");
    expect(report.exportedOn).toBe("14 Sept 2026");
    expect(report.fileStem).toBe("mirage-navi-vitality-navi-vitality");
    expect(matchPdfFilename(report)).toBe("mirage-navi-vitality-navi-vitality.pdf");
    expect(report.ctName).toBe("NAVI");
    expect(report.tName).toBe("Vitality");
    expect(report.players.ct.map((p) => p.name)).toEqual(["s1mple"]);
    expect(report.players.t.map((p) => p.name)).toEqual(["ZywOo"]);
    expect(report.players.ct[0]).toMatchObject({
      kills: 1,
      deaths: 0,
    });
    expect(report.notes).toEqual([
      {
        roundLabel: "R1",
        items: [
          { title: "Flash mid", kind: "text" },
          { title: "Entry", kind: "bookmark" },
        ],
      },
    ]);
    expect(report.bookmarks).toHaveLength(1);
    expect(report.bookmarks[0]).toMatchObject({
      id: "1:0",
      title: "Entry",
      roundLabel: "R1",
      tick: 200,
      economy: MATCH_PDF_ECO_PISTOL,
    });
    expect(report.bookmarks[0]?.caption).toContain("R1");
    expect(report.bookmarks[0]?.caption).toContain(MATCH_PDF_ECO_PISTOL);
  });

  it("uses the default bookmark title and skips empty text", () => {
    const replay = scoredReplay();
    const report = matchReport(
      replay,
      [
        {
          round: 1,
          note: {
            ...emptyNote(),
            drawings: [{ type: "text", color: "#fff", x: 0, y: 0, text: "   " }],
            bookmarks: [{ color: "#fff", text: "  ", tick: 100 }],
          },
        },
      ],
      "match.dem",
      EXPORTED_AT,
    );
    expect(report.notes[0]?.items).toEqual([{ title: NOTE_BOOKMARK_TITLE, kind: "bookmark" }]);
    expect(report.bookmarks[0]?.title).toBe(NOTE_BOOKMARK_TITLE);
  });

  it("returns an empty notes list when nothing is written", () => {
    const report = matchReport(scoredReplay(), [], "match.dem", EXPORTED_AT);
    expect(report.notes).toEqual([]);
    expect(report.bookmarks).toEqual([]);
  });
});
