import { describe, expect, it } from "vitest";
import { DEFAULT_TICK_RATE, SMOKE_SECONDS } from "@/lib/shared/constants";
import { CT_COLOR, T_COLOR, type NadeRender, type RadarFrame } from "@/lib/radar/radarFrame";
import { GEAR_C4 } from "@/lib/replay/replayTypes";
import {
  makeBombEvent,
  makeFreezeTicks,
  makeGrenade,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  UNIT_CALIBRATION,
} from "@/lib/testing/fixtures";
import {
  frameToPieces,
  frameToRadarFx,
  nadePiecePos,
  nadeToPiece,
  snapshotFrame,
  snapshotPieces,
} from "./snapshot";

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
        trail: [{ x: 1, y: 1 }],
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
      trail: [
        { x: 0, y: 0 },
        { x: 5, y: 6 },
      ],
    };
    expect(nadePiecePos(linger)).toEqual({ x: 5, y: 6 });
    expect(
      nadePiecePos({
        phase: "burst",
        kind: "he",
        color: "#fff",
        at: { x: 7, y: 8 },
        progress: 0.5,
        trail: [
          { x: 1, y: 1 },
          { x: 7, y: 8 },
        ],
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
        trail: [{ x: 2, y: 3 }],
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
            trail: [
              { x: 0, y: 0 },
              { x: 30, y: 40 },
            ],
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
    expect(pieces[2]).toMatchObject({
      kind: "smoke",
      x: 30,
      y: 40,
      nadeStyle: "effect",
      trail: [{ x: 0, y: 0 }],
    });
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

  it("keeps a flight nade as an icon and a popped HE as path plus burst", () => {
    const flight = nadeToPiece({
      phase: "flight",
      kind: "flash",
      color: "#fff",
      trail: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
      head: { x: 3, y: 3 },
    });
    expect(flight).toMatchObject({
      kind: "flash",
      x: 3,
      y: 3,
      nadeStyle: "icon",
      trail: [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    });
    const burst = nadeToPiece({
      phase: "burst",
      kind: "he",
      color: "#fff",
      at: { x: 9, y: 8 },
      progress: 0.2,
      trail: [
        { x: 0, y: 0 },
        { x: 9, y: 8 },
      ],
    });
    expect(burst).toMatchObject({
      kind: "he",
      x: 9,
      y: 8,
      nadeStyle: "effect",
      trail: [{ x: 0, y: 0 }],
    });
  });

  it("copies kill lines and the opening duel onto radar fx", () => {
    const fx = frameToRadarFx(
      emptyFrame({
        deaths: [
          {
            x: 10,
            y: 20,
            line: {
              from: { x: 1, y: 2 },
              to: { x: 10, y: 20 },
              color: CT_COLOR,
              alpha: 0.9,
              lineWidth: 2,
            },
          },
        ],
        opening: { from: { x: 1, y: 2 }, to: { x: 10, y: 20 }, color: CT_COLOR },
      }),
    );
    expect(fx?.deaths).toHaveLength(1);
    expect(fx?.deaths[0]?.line).toMatchObject({ from: { x: 1, y: 2 }, to: { x: 10, y: 20 } });
    expect(fx?.opening).toMatchObject({ from: { x: 1, y: 2 }, to: { x: 10, y: 20 } });
    expect(frameToRadarFx(emptyFrame())).toBeUndefined();
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
    expect(atPop.find((row) => row.kind === "smoke")).toMatchObject({
      x: 70,
      y: 80,
      nadeStyle: "effect",
    });
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

  it("snapshots an in-air nade as an icon and a popped HE with path plus burst", () => {
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 5000 })],
      ticks: makeFreezeTicks(2, 1),
      grenades: [
        makeGrenade({
          kind: "he",
          start_tick: 80,
          detonate_tick: 120,
          end_tick: 130,
          points: [
            { tick: 80, x: 0, y: 0, z: 0 },
            { tick: 100, x: 10, y: 10, z: 0 },
            { tick: 120, x: 40, y: 50, z: 0 },
          ],
        }),
      ],
      kills: [
        makeKill(90, 0, 1, {
          x: 40,
          y: 50,
          attacker_x: 10,
          attacker_y: 12,
        }),
      ],
    });
    const flying = snapshotFrame(replay, 100, UNIT_CALIBRATION);
    expect(flying.pieces.find((row) => row.kind === "he")).toMatchObject({
      nadeStyle: "icon",
      x: 10,
      y: 10,
    });
    const popped = snapshotFrame(replay, 120, UNIT_CALIBRATION);
    expect(popped.pieces.find((row) => row.kind === "he")).toMatchObject({
      nadeStyle: "effect",
      x: 40,
      y: 50,
      trail: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
    });
    expect(popped.radarFx?.deaths).toHaveLength(1);
    expect(popped.radarFx?.opening).not.toBeNull();
  });
});
