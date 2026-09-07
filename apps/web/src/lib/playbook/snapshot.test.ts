import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_TICK_RATE, SMOKE_SECONDS } from "@/lib/shared/constants";
import { emptyNote } from "@/lib/notes/note";
import type { Piece } from "@/lib/notes/types";
import { CT_COLOR, T_COLOR, type NadeRender, type RadarFrame } from "@/lib/radar/radarFrame";
import { GEAR_C4 } from "@/lib/replay/replayTypes";
import {
  makeBombEvent,
  makeFreezeTicks,
  makeGrenade,
  makePlayer,
  makeReplay,
  makeRound,
  UNIT_CALIBRATION,
} from "@/lib/testing/fixtures";
import { newPlaybook } from "./pages";
import { makePiece } from "./pieces";
import { UNTITLED_STRAT, UNTITLED_PLAYBOOK } from "./types";
import {
  SNAPSHOT_FALLBACK_FILE,
  SNAPSHOT_UNKNOWN_ROUND,
  addSnapshotPage,
  frameToPieces,
  nadePiecePos,
  snapshotPieces,
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

function emptyFrame(overrides: Partial<RadarFrame> = {}): RadarFrame {
  return {
    tick: 0,
    round: null,
    players: [],
    useLowerFloor: false,
    heatmap: [],
    summary: [],
    nades: [],
    tracers: [],
    bomb: { state: "none" },
    deaths: [],
    opening: null,
    trails: [],
    cone: null,
    hits: [],
    flashes: [],
    pawns: [],
    ...overrides,
  };
}

describe("nadePiecePos", () => {
  it("uses head, then trail, then centroid or linger point", () => {
    expect(
      nadePiecePos({
        phase: "flight",
        kind: "flash",
        color: "#fff",
        trail: [
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ],
        head: { x: 9, y: 8 },
      }),
    ).toEqual({ x: 9, y: 8 });
    expect(
      nadePiecePos({
        phase: "flight",
        kind: "flash",
        color: "#fff",
        trail: [{ x: 3, y: 4 }],
        head: null,
      }),
    ).toEqual({ x: 3, y: 4 });
    expect(
      nadePiecePos({ phase: "flight", kind: "flash", color: "#fff", trail: [], head: null }),
    ).toBeNull();
    expect(
      nadePiecePos({
        phase: "fires",
        kind: "molotov",
        color: "#fff",
        cells: [],
        cellRadius: 1,
        centroid: { x: 10, y: 20 },
        dialRadius: 1,
        left: 1,
      }),
    ).toEqual({ x: 10, y: 20 });
    const linger: NadeRender = {
      phase: "linger",
      kind: "smoke",
      color: "#fff",
      at: { x: 5, y: 6 },
      radius: 1,
      dialRadius: 1,
      left: 1,
    };
    expect(nadePiecePos(linger)).toEqual({ x: 5, y: 6 });
    expect(
      nadePiecePos({
        phase: "burst",
        kind: "he",
        color: "#fff",
        at: { x: 7, y: 8 },
        progress: 0.5,
      }),
    ).toEqual({ x: 7, y: 8 });
    expect(
      nadePiecePos({
        phase: "puff",
        kind: "smoke",
        color: "#fff",
        at: { x: 2, y: 3 },
        radius: 4,
        alpha: 0.2,
      }),
    ).toEqual({ x: 2, y: 3 });
  });
});

describe("frameToPieces", () => {
  it("copies present pawns, nades, and a planted or loose bomb", () => {
    const pieces = frameToPieces(
      emptyFrame({
        players: [
          {
            index: 0,
            x: 1,
            y: 2,
            z: 40,
            yaw: 90,
            health: 100,
            armor: 0,
            present: true,
            alive: true,
            ducked: false,
            scoped: false,
            ct: true,
            planting: false,
            defusing: false,
            money: 0,
            equip: 0,
            gear: 0,
            primary: 0,
            secondary: 0,
            active: 0,
            clip: 0,
            reserve: 0,
          },
        ],
        pawns: [
          {
            index: 0,
            x: 1,
            y: 2,
            yaw: 90,
            color: CT_COLOR,
            alive: true,
            selected: false,
            flash: 0,
            name: "s1mple",
            health: 100,
          },
          {
            index: 1,
            x: 8,
            y: 9,
            yaw: 0,
            color: T_COLOR,
            alive: false,
            selected: false,
            flash: 0,
            name: "  ",
            health: 0,
            carriesC4: true,
          },
        ],
        nades: [
          {
            phase: "linger",
            kind: "smoke",
            color: "#fff",
            at: { x: 30, y: 40 },
            radius: 1,
            dialRadius: 1,
            left: 1,
          },
          { phase: "flight", kind: "flash", color: "#fff", trail: [], head: null },
        ],
        bomb: { state: "planted", remaining: 20, x: 50, y: 60 },
      }),
    );
    expect(pieces).toHaveLength(4);
    expect(pieces[0]).toMatchObject({
      kind: "pawn",
      x: 1,
      y: 2,
      z: 40,
      yaw: 90,
      side: "CT",
      label: "s1mple",
      alive: true,
    });
    expect(pieces[1]).toMatchObject({
      kind: "pawn",
      side: "T",
      alive: false,
      carriesC4: true,
    });
    expect(pieces[1]?.label).toBeUndefined();
    expect(pieces[2]).toMatchObject({ kind: "smoke", x: 30, y: 40 });
    expect(pieces[3]).toMatchObject({ kind: "bomb", x: 50, y: 60 });
  });

  it("does not add a bomb token while it is carried", () => {
    const pieces = frameToPieces(emptyFrame({ bomb: { state: "carried", player: 2 } }));
    expect(pieces.filter((row) => row.kind === "bomb")).toEqual([]);
  });

  it("places a loose pack", () => {
    const pieces = frameToPieces(emptyFrame({ bomb: { state: "loose", x: 11, y: 12 } }));
    expect(pieces).toMatchObject([{ kind: "bomb", x: 11, y: 12 }]);
  });
});

describe("snapshotPieces", () => {
  it("turns the live frame into tokens without copying drawings", () => {
    const ticks = makeFreezeTicks(2, 1);
    ticks.x[0] = 10;
    ticks.y[0] = 20;
    ticks.z[0] = 5;
    ticks.yaw[0] = 45;
    ticks.gear[1] = GEAR_C4;
    ticks.x[1] = 30;
    ticks.y[1] = 40;
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 5000 })],
      ticks,
      grenades: [
        makeGrenade({
          kind: "smoke",
          start_tick: 80,
          detonate_tick: 120,
          end_tick: 0,
          points: [
            { tick: 80, x: 0, y: 0, z: 0 },
            { tick: 120, x: 70, y: 80, z: 0 },
          ],
        }),
      ],
      bombEvents: [makeBombEvent({ tick: 200, kind: "planted", x: 120, y: 220 })],
    });
    const atPop = snapshotPieces(replay, 120, UNIT_CALIBRATION);
    expect(atPop.filter((row) => row.kind === "pawn")).toHaveLength(2);
    expect(atPop.find((row) => row.kind === "pawn" && row.label === "Alice")).toMatchObject({
      x: 10,
      y: 20,
      z: 5,
      yaw: 45,
      side: "CT",
      alive: true,
    });
    expect(atPop.find((row) => row.label === "Bob")?.carriesC4).toBe(true);
    expect(atPop.find((row) => row.kind === "smoke")).toMatchObject({ x: 70, y: 80 });
    expect(atPop.some((row) => row.kind === "bomb")).toBe(false);

    const planted = snapshotPieces(replay, 200 + tps, UNIT_CALIBRATION);
    expect(planted.find((row) => row.kind === "bomb")).toMatchObject({ x: 120, y: 220 });
    expect(planted.find((row) => row.label === "Bob")?.carriesC4).toBeUndefined();
    expect(
      snapshotPieces(replay, 120 + (SMOKE_SECONDS + 1) * tps, UNIT_CALIBRATION).some(
        (row) => row.kind === "smoke",
      ),
    ).toBe(false);
  });
});

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
