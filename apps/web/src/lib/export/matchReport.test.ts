import { describe, expect, it } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { FULL_HEALTH, NOTE_BOOKMARK_TITLE } from "@/lib/shared/constants";
import { liveScoreboardPlayers } from "@/lib/stats/stats";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
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
  matchRosterTick,
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
        items: [{ title: "Flash mid" }],
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
    expect(report.notes).toEqual([]);
    expect(report.bookmarks[0]?.title).toBe(NOTE_BOOKMARK_TITLE);
  });

  it("keeps bookmarks off the Notes list", () => {
    const replay = scoredReplay();
    const mixed = matchReport(
      replay,
      [
        {
          round: 1,
          note: {
            ...emptyNote(),
            drawings: [{ type: "text", color: "#fff", x: 1, y: 2, text: "Flash mid" }],
            bookmarks: [{ color: "#f00", text: "Entry", tick: 200 }],
          },
        },
      ],
      "match.dem",
      EXPORTED_AT,
    );
    expect(mixed.notes).toEqual([{ roundLabel: "R1", items: [{ title: "Flash mid" }] }]);
    expect(mixed.bookmarks.map((mark) => mark.title)).toEqual(["Entry"]);

    const bookmarkOnly = matchReport(
      replay,
      [
        {
          round: 1,
          note: {
            ...emptyNote(),
            bookmarks: [{ color: "#0f0", text: "Solo mark", tick: 300 }],
          },
        },
      ],
      "match.dem",
      EXPORTED_AT,
    );
    expect(bookmarkOnly.notes).toEqual([]);
    expect(bookmarkOnly.bookmarks.map((mark) => mark.title)).toEqual(["Solo mark"]);
  });

  it("returns an empty notes list when nothing is written", () => {
    const report = matchReport(scoredReplay(), [], "match.dem", EXPORTED_AT);
    expect(report.notes).toEqual([]);
    expect(report.bookmarks).toEqual([]);
  });

  it("freezes the scoreboard on the last 5v5 roster after late disconnects", () => {
    const players = [
      makePlayer(0, "CT", "CT0"),
      makePlayer(1, "CT", "CT1"),
      makePlayer(2, "CT", "CT2"),
      makePlayer(3, "CT", "CT3"),
      makePlayer(4, "CT", "CT4"),
      makePlayer(5, "T", "T0"),
      makePlayer(6, "T", "T1"),
      makePlayer(7, "T", "T2"),
      makePlayer(8, "T", "T3"),
      makePlayer(9, "T", "T4"),
    ];
    const ticks = makeTicks(10, 3);
    ticks.ticks.set([64, 640, 800]);
    for (let frame = 0; frame < 3; frame++) {
      for (let i = 0; i < 10; i++) {
        const slot = frame * 10 + i;
        const left = frame === 2 && i >= 8;
        ticks.flags[slot] = left ? 0 : FLAG_PRESENT | FLAG_ALIVE | (i < 5 ? FLAG_CT : 0);
        ticks.health[slot] = FULL_HEALTH;
      }
    }
    const replay = makeReplay({
      header: { map_name: "de_mirage", team_ct: "NAVI", team_t: "Vitality" },
      players,
      rounds: [
        makeRound({ number: 1, winner: "CT", start_tick: 0, freeze_end_tick: 64, end_tick: 640 }),
      ],
      kills: [makeKill(200, 0, 5)],
      ticks,
    });
    expect(liveScoreboardPlayers(replay, 800)).toHaveLength(8);
    expect(matchRosterTick(replay)).toBe(640);
    const report = matchReport(replay, [], "match.dem", EXPORTED_AT);
    expect(report.players.ct).toHaveLength(5);
    expect(report.players.t).toHaveLength(5);
    expect(report.players.ct.map((p) => p.name).sort()).toEqual([
      "CT0",
      "CT1",
      "CT2",
      "CT3",
      "CT4",
    ]);
    expect(report.players.t.map((p) => p.name).sort()).toEqual(["T0", "T1", "T2", "T3", "T4"]);
    expect(report.scoreLine).toBe("NAVI - Vitality, 1:0 (1:0)");
  });

  it("falls back to the demo end when a full 5v5 never appears", () => {
    const replay = scoredReplay();
    expect(matchRosterTick(replay)).toBe(640);
  });

  it("counts dead but present pawns toward the 5v5 roster", () => {
    const ticks = makeTicks(10, 1);
    ticks.ticks[0] = 640;
    for (let i = 0; i < 10; i++) {
      ticks.flags[i] = FLAG_PRESENT | (i < 5 ? FLAG_CT : 0);
      if (i !== 2 && i !== 7) ticks.flags[i] |= FLAG_ALIVE;
      ticks.health[i] = i === 2 || i === 7 ? 0 : FULL_HEALTH;
    }
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "CT0"),
        makePlayer(1, "CT", "CT1"),
        makePlayer(2, "CT", "CT2"),
        makePlayer(3, "CT", "CT3"),
        makePlayer(4, "CT", "CT4"),
        makePlayer(5, "T", "T0"),
        makePlayer(6, "T", "T1"),
        makePlayer(7, "T", "T2"),
        makePlayer(8, "T", "T3"),
        makePlayer(9, "T", "T4"),
      ],
      rounds: [makeRound({ number: 1, end_tick: 640 })],
      ticks,
    });
    expect(matchRosterTick(replay)).toBe(640);
  });
});
