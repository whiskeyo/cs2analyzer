import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyNote } from "@/lib/notes/note";
import type { Piece } from "@/lib/notes/types";
import {
  DEFAULT_HABITS_NADE_FILTER,
  type HabitsTrail,
  type SeriesOverlay,
} from "@/lib/parse/seriesOverlay";
import { DEFAULT_TICK_RATE } from "@/lib/shared/constants";
import { makeGrenade, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { newPlaybook } from "./pages";
import { makePiece } from "./pieces";
import { UNTITLED_STRAT, UNTITLED_PLAYBOOK } from "./types";
import {
  SNAPSHOT_FALLBACK_FILE,
  SNAPSHOT_UNKNOWN_ROUND,
  addSnapshotPage,
  overlayToPieces,
  overlayToSnapshot,
  overlayTrailPiece,
  snapshotAggTitle,
  snapshotFromAnalyzer,
  snapshotStratTitle,
  snapshotTitleFromReplay,
  writeSnapshot,
} from "./snapshot";

vi.mock("./playbookStore", () => ({
  loadPlaybook: vi.fn(),
  createPlaybook: vi.fn(),
  savePlaybook: vi.fn(),
}));

import { createPlaybook, loadPlaybook, savePlaybook } from "./playbookStore";

const tps = DEFAULT_TICK_RATE;

describe("snapshot titles", () => {
  it("formats teams, file, round, and clock", () => {
    expect(
      snapshotStratTitle({
        teamA: "NaVi",
        teamB: "FaZe",
        fileName: "faceit.dem",
        roundLabel: "R12",
        clock: "1:24",
      }),
    ).toBe("NaVi - FaZe (faceit.dem) · R12 1:24");
  });

  it("reads starting sides and the round clock from the replay", () => {
    const freeze = 64;
    const tick = freeze + 84 * tps;
    const replay = makeReplay({
      header: { team_ct: "NaVi", team_t: "FaZe" },
      rounds: [
        makeRound({ number: 12, start_tick: 0, freeze_end_tick: freeze, end_tick: tick + 10 }),
      ],
    });
    expect(snapshotTitleFromReplay(replay, tick, "faceit.dem")).toBe(
      "NaVi - FaZe (faceit.dem) · R12 1:24",
    );
    const knife = makeReplay({
      header: { team_ct: "", team_t: "" },
      rounds: [makeRound({ number: 0, is_knife: true, start_tick: 0, freeze_end_tick: freeze })],
    });
    expect(snapshotTitleFromReplay(knife, freeze, "  ")).toBe(
      `CT - T (${SNAPSHOT_FALLBACK_FILE}) · Knife 0:00`,
    );
    expect(snapshotTitleFromReplay(makeReplay({ rounds: [] }), 10, "a.dem")).toBe(
      `CT - T (a.dem) · ${SNAPSHOT_UNKNOWN_ROUND} 0:00`,
    );
  });
});

describe("addSnapshotPage", () => {
  it("fills the blank first strat on a new book", () => {
    const pawn = makePiece("pawn", 1, 2, { side: "CT" });
    const next = addSnapshotPage(newPlaybook("de_mirage", "Defaults"), "R1 0:05", [pawn], "lower");
    expect(next.pages).toHaveLength(1);
    expect(next.pages[0]).toMatchObject({ title: "R1 0:05", floor: "lower" });
    expect(next.pages[0]?.note.pieces).toEqual([pawn]);
    expect(next.activePageId).toBe(next.pages[0]?.id);
  });

  it("adds a new page when the current strat already has content", () => {
    let book = newPlaybook("de_mirage", "Defaults");
    const first = book.pages[0]!;
    const note = emptyNote();
    note.drawings.push({ type: "pen", color: "#fff", points: [{ x: 0, y: 0 }] });
    book = { ...book, pages: [{ ...first, title: "Old", note }] };
    const next = addSnapshotPage(book, "Snap", [makePiece("bomb", 3, 4)]);
    expect(next.pages).toHaveLength(2);
    expect(next.pages[0]?.title).toBe("Old");
    expect(next.pages[1]?.title).toBe("Snap");
    expect(next.pages[1]?.note.pieces).toHaveLength(1);
    expect(next.pages[0]?.note.drawings).toHaveLength(1);
    expect(next.activePageId).toBe(next.pages[1]?.id);
  });

  it("does not overwrite an untitled strat that already has tokens", () => {
    let book = newPlaybook("de_mirage", "Defaults");
    const first = book.pages[0]!;
    expect(first.title).toBe(UNTITLED_STRAT);
    const note = emptyNote();
    note.pieces.push(makePiece("flash", 0, 0));
    book = { ...book, pages: [{ ...first, note }] };
    const next = addSnapshotPage(book, "Snap", [makePiece("he", 1, 1)]);
    expect(next.pages).toHaveLength(2);
    expect(next.pages[0]?.note.pieces[0]?.kind).toBe("flash");
  });
});

describe("writeSnapshot", () => {
  beforeEach(() => {
    vi.mocked(loadPlaybook).mockReset();
    vi.mocked(createPlaybook).mockReset();
    vi.mocked(savePlaybook).mockReset();
    vi.mocked(savePlaybook).mockImplementation(async (book) => ({ ...book, savedAt: 1 }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("adds a page to an existing book", async () => {
    const existing = newPlaybook("de_anubis", "A execs");
    vi.mocked(loadPlaybook).mockResolvedValue(existing);
    const pieces: Piece[] = [makePiece("smoke", 1, 2)];
    const { book, pageId } = await writeSnapshot({
      mapName: "de_anubis",
      bookKey: existing.key,
      stratTitle: "R1 0:10",
      pieces,
      floor: "upper",
    });
    expect(createPlaybook).not.toHaveBeenCalled();
    expect(book.pages).toHaveLength(1);
    expect(book.pages[0]?.title).toBe("R1 0:10");
    expect(book.pages[0]?.floor).toBe("upper");
    expect(pageId).toBe(book.activePageId);
    expect(savePlaybook).toHaveBeenCalled();
  });

  it("creates a book when none is chosen", async () => {
    const created = newPlaybook("de_anubis", "New book");
    vi.mocked(loadPlaybook).mockResolvedValue(null);
    vi.mocked(createPlaybook).mockResolvedValue(created);
    const { book } = await writeSnapshot({
      mapName: "de_anubis",
      bookKey: null,
      newBookTitle: "New book",
      stratTitle: "Snap",
      pieces: [],
    });
    expect(createPlaybook).toHaveBeenCalledWith("de_anubis", "New book");
    expect(book.title).toBe("New book");
    expect(book.pages[0]?.title).toBe("Snap");
  });

  it("creates an untitled book when the chosen key is missing", async () => {
    vi.mocked(loadPlaybook).mockResolvedValue(null);
    vi.mocked(createPlaybook).mockResolvedValue(newPlaybook("de_anubis", UNTITLED_PLAYBOOK));
    await writeSnapshot({
      mapName: "de_anubis",
      bookKey: "gone",
      stratTitle: "Snap",
      pieces: [],
    });
    expect(createPlaybook).toHaveBeenCalledWith("de_anubis", UNTITLED_PLAYBOOK);
  });
});

function overlayTrail(partial: Partial<HabitsTrail> = {}): HabitsTrail {
  return {
    demoId: "d",
    roundNumber: 1,
    jumpTick: 64,
    tps: tps,
    steamId: 1,
    playerName: "donk",
    color: "#fff",
    points: [
      { x: 0, y: 0, z: 0, tick: 64, yaw: 0 },
      { x: 10, y: 20, z: 5, tick: 128, yaw: 45 },
    ],
    deathAt: null,
    deathTick: null,
    survivedAt: null,
    survivedTick: null,
    ...partial,
  };
}

function overlayOf(partial: Partial<SeriesOverlay> = {}): SeriesOverlay {
  return {
    trails: [],
    heatDots: [],
    nades: [],
    roundCount: 1,
    windowSec: 10,
    ...partial,
  };
}

describe("overlayToPieces", () => {
  it("places a live pawn at the last point at or before the playhead", () => {
    const pieces = overlayToPieces(
      overlayOf({ trails: [overlayTrail()] }),
      1,
      undefined,
      true,
      "CT",
    );
    expect(pieces).toHaveLength(1);
    expect(pieces[0]).toMatchObject({
      kind: "pawn",
      x: 10,
      y: 20,
      z: 5,
      yaw: 45,
      label: "donk",
      alive: true,
      side: "CT",
      color: expect.stringMatching(/^#/),
    });
  });

  it("places a dead pawn at deathAt", () => {
    const pieces = overlayToPieces(
      overlayOf({
        trails: [
          overlayTrail({
            deathAt: { x: 99, y: 88 },
            deathTick: 128,
            playerName: "  ",
          }),
        ],
      }),
      2,
      undefined,
      true,
      "T",
    );
    expect(pieces[0]).toMatchObject({
      kind: "pawn",
      x: 99,
      y: 88,
      alive: false,
      side: "T",
    });
    expect(pieces[0]?.label).toBeUndefined();
  });

  it("skips an empty live trail and respects nade filters", () => {
    expect(overlayTrailPiece(overlayTrail({ points: [], playerName: "" }))).toBeNull();
    const nade = {
      kind: "smoke" as const,
      color: "#fff",
      grenade: makeGrenade({
        kind: "smoke",
        start_tick: 100,
        detonate_tick: 200,
        end_tick: 2000,
        points: [
          { tick: 100, x: 50, y: 50, z: 0 },
          { tick: 200, x: 200, y: 200, z: 0 },
        ],
      }),
      freezeEndTick: 64,
      roundEndTick: 2000,
      tps,
    };
    const overlay = overlayOf({
      trails: [overlayTrail()],
      nades: [
        nade,
        { ...nade, kind: "flash", grenade: makeGrenade({ kind: "flash", start_tick: 100 }) },
      ],
    });
    const withNades = overlayToPieces(overlay, 2);
    expect(withNades.some((row) => row.kind === "smoke")).toBe(true);
    const noNades = overlayToPieces(overlay, 2, DEFAULT_HABITS_NADE_FILTER, false);
    expect(noNades.every((row) => row.kind === "pawn")).toBe(true);
    const noSmoke = overlayToPieces(overlay, 2, {
      ...DEFAULT_HABITS_NADE_FILTER,
      smoke: false,
      flash: false,
    });
    expect(noSmoke.every((row) => row.kind === "pawn")).toBe(true);
  });

  it("gives each player name a stable tint", () => {
    const pieces = overlayToPieces(
      overlayOf({
        trails: [
          overlayTrail({ playerName: "donk" }),
          overlayTrail({ playerName: "donk", steamId: 2 }),
          overlayTrail({ playerName: "m0NESY", steamId: 3 }),
        ],
      }),
      1,
    );
    expect(pieces[0]?.color).toBe(pieces[1]?.color);
    expect(pieces[0]?.color).not.toBe(pieces[2]?.color);
  });

  it("groups a pawn, its trail, and thrown nades under a unique name", () => {
    const nade = {
      kind: "smoke" as const,
      color: "#fff",
      grenade: makeGrenade({
        kind: "smoke",
        start_tick: 100,
        detonate_tick: 200,
        end_tick: 2000,
        points: [
          { tick: 100, x: 50, y: 50, z: 0 },
          { tick: 200, x: 200, y: 200, z: 0 },
        ],
      }),
      freezeEndTick: 64,
      roundEndTick: 2000,
      tps,
      demoId: "d",
      roundNumber: 1,
      steamId: 1,
    };
    const snap = overlayToSnapshot(
      overlayOf({
        trails: [
          overlayTrail({ playerName: "donk", steamId: 1 }),
          overlayTrail({ playerName: "donk", steamId: 2, demoId: "d2" }),
        ],
        nades: [nade, { ...nade, steamId: 99, demoId: "other" }],
      }),
      2,
    );
    expect(snap.groups.map((group) => group.name)).toEqual(["donk", "donk (2)"]);
    const donk = snap.groups[0]!;
    expect(
      snap.pieces.filter((piece) => piece.groupId === donk.id).map((piece) => piece.kind),
    ).toEqual(["pawn", "smoke"]);
    expect(snap.radarFx?.trails[0]).toMatchObject({ groupId: donk.id, label: "donk" });
    const smokes = snap.pieces.filter((piece) => piece.kind === "smoke");
    expect(smokes).toHaveLength(2);
    expect(smokes.filter((piece) => piece.groupId === donk.id)).toHaveLength(1);
    expect(smokes.filter((piece) => piece.groupId == null)).toHaveLength(1);
  });
});

describe("snapshotAggTitle / snapshotFromAnalyzer", () => {
  it("formats the series bucket title", () => {
    expect(
      snapshotAggTitle({
        focalTeam: "Spirit",
        demoCount: 12,
        side: "CT",
        kind: "pistol",
        playSec: 24,
      }),
    ).toBe("Spirit series (12 demos) · CT pistol · 0:24");
  });

  it("uses overlay tokens when a habits overlay is on", () => {
    const replay = makeReplay();
    const fromOverlay = snapshotFromAnalyzer({
      replay,
      tick: 64,
      fileName: "a.dem",
      floor: "lower",
      mapName: "de_anubis",
      overlay: overlayOf({ trails: [overlayTrail()] }),
      playSec: 24,
      series: { mapName: "de_dust2", focalTeam: "Spirit", demos: { length: 12 } },
      bucket: { side: "CT", kind: "pistol" },
    });
    expect(fromOverlay.mapName).toBe("de_dust2");
    expect(fromOverlay.floor).toBe("lower");
    expect(fromOverlay.stratTitle).toBe("Spirit series (12 demos) · CT pistol · 0:24");
    expect(fromOverlay.pieces[0]?.kind).toBe("pawn");
    expect(fromOverlay.groups).toHaveLength(1);
    expect(fromOverlay.groups?.[0]?.name).toBe("donk");

    const live = snapshotFromAnalyzer({
      replay,
      tick: 64,
      fileName: "a.dem",
      floor: "auto",
      mapName: "de_anubis",
      overlay: null,
      playSec: 0,
    });
    expect(live.mapName).toBe("de_anubis");
    expect(live.stratTitle).toContain("CT - T");
  });

  it("falls back when series metadata is missing", () => {
    const snap = snapshotFromAnalyzer({
      replay: makeReplay(),
      tick: 0,
      fileName: "a.dem",
      floor: "auto",
      mapName: "de_anubis",
      overlay: overlayOf(),
      playSec: 0,
    });
    expect(snap.stratTitle).toBe("Team series (1 demos) · CT pistol · 0:00");
    expect(snap.mapName).toBe("de_anubis");
  });
});
