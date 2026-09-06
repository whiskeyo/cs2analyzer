import { describe, expect, it } from "vitest";
import {
  DEFAULT_TICK_RATE,
  BOMB_SECONDS,
  MOLOTOV_SECONDS,
  SMOKE_SECONDS,
} from "@/lib/shared/constants";
import { DEFAULT_LAYERS, DEFAULT_SUMMARY_FILTER, type MapLayers } from "@/lib/notes/types";
import {
  makeBlind,
  makeBombEvent,
  makeFreezeTicks,
  makeGrenade,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeShot,
  makeTicks,
  UNIT_CALIBRATION,
} from "@/lib/testing/fixtures";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT, GEAR_C4, type Replay } from "@/lib/replay/replayTypes";
import { TRACER_SECONDS } from "./radarFx";
import { buildRadarFrame, CT_COLOR, T_COLOR, type FrameInput } from "./radarFrame";

const tps = DEFAULT_TICK_RATE;

function frame(replay: Replay, tick: number, overrides: Partial<FrameInput> = {}) {
  return buildRadarFrame({
    replay,
    tick,
    layers: DEFAULT_LAYERS,
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    selected: null,
    trails: false,
    floorMode: "auto",
    cal: UNIT_CALIBRATION,
    scale: 1,
    ...overrides,
  });
}

/** Two CTs and two Ts alive from the freeze tick of a single long round. */
function matchReplay(overrides: Parameters<typeof makeReplay>[0] = {}): Replay {
  return makeReplay({
    players: [
      makePlayer(0, "CT", "Alice"),
      makePlayer(1, "CT", "Bob"),
      makePlayer(2, "T", "Cara"),
      makePlayer(3, "T", "Dan"),
    ],
    rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 5000 })],
    ticks: makeFreezeTicks(4, 2),
    ...overrides,
  });
}

describe("buildRadarFrame nades", () => {
  const flight = makeGrenade({
    kind: "smoke",
    start_tick: 80,
    detonate_tick: 120,
    end_tick: 0,
    points: [
      { tick: 80, x: 0, y: 0, z: 0 },
      { tick: 100, x: 10, y: 10, z: 0 },
      { tick: 120, x: 20, y: 20, z: 0 },
    ],
  });

  it("draws a throw in flight with the trail it has travelled so far", () => {
    const f = frame(matchReplay({ grenades: [flight] }), 100);
    expect(f.nades).toHaveLength(1);
    const nade = f.nades[0];
    expect(nade.phase).toBe("flight");
    if (nade.phase !== "flight") return;
    // The point at tick 120 has not happened yet.
    expect(nade.trail).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
    expect(nade.head).not.toBeNull();
  });

  it("switches a smoke to the linger phase at the pop and runs the dial down", () => {
    const replay = matchReplay({ grenades: [flight] });
    const atPop = frame(replay, 120).nades[0];
    expect(atPop.phase).toBe("linger");
    if (atPop.phase !== "linger") return;
    expect(atPop.left).toBeCloseTo(1);
    expect(atPop.at).toEqual({ x: 20, y: 20 });

    const halfway = frame(replay, 120 + (SMOKE_SECONDS / 2) * tps).nades[0];
    expect(halfway.phase).toBe("linger");
    if (halfway.phase !== "linger") return;
    expect(halfway.left).toBeCloseTo(0.5, 1);
  });

  it("drops a nade from the frame once it has faded", () => {
    const replay = matchReplay({ grenades: [flight] });
    expect(frame(replay, 120 + (SMOKE_SECONDS + 1) * tps).nades).toEqual([]);
  });

  it("draws a molotov as its burning cells, centred on their mean", () => {
    const molly = makeGrenade({
      kind: "molotov",
      start_tick: 80,
      detonate_tick: 100,
      end_tick: 0,
      points: [{ tick: 100, x: 500, y: 500, z: 0 }],
      fires: [
        { x: 100, y: 200, start_tick: 100, end_tick: 100 + MOLOTOV_SECONDS * tps },
        { x: 300, y: 400, start_tick: 100, end_tick: 100 + MOLOTOV_SECONDS * tps },
      ],
    });
    const nade = frame(matchReplay({ grenades: [molly] }), 200).nades[0];
    expect(nade.phase).toBe("fires");
    if (nade.phase !== "fires") return;
    expect(nade.cells).toHaveLength(2);
    expect(nade.centroid).toEqual({ x: 200, y: 300 });
  });

  it("draws an incendiary as its burning cells, same as a molotov", () => {
    const inc = makeGrenade({
      kind: "incendiary",
      start_tick: 80,
      detonate_tick: 100,
      end_tick: 0,
      points: [{ tick: 100, x: 500, y: 500, z: 0 }],
      fires: [{ x: 80, y: 90, start_tick: 100, end_tick: 100 + MOLOTOV_SECONDS * tps }],
    });
    const nade = frame(matchReplay({ grenades: [inc] }), 200).nades[0];
    expect(nade.phase).toBe("fires");
    if (nade.phase !== "fires") return;
    expect(nade.cells).toHaveLength(1);
    expect(nade.kind).toBe("incendiary");
  });

  it("stops drawing a molotov whose cells burned out early", () => {
    const molly = makeGrenade({
      kind: "molotov",
      start_tick: 80,
      detonate_tick: 100,
      end_tick: 0,
      points: [{ tick: 100, x: 500, y: 500, z: 0 }],
      fires: [{ x: 100, y: 200, start_tick: 100, end_tick: 150 }],
    });
    // Still inside the nominal linger, but nothing is burning any more.
    expect(frame(matchReplay({ grenades: [molly] }), 200).nades).toEqual([]);
  });

  it("gives an HE a burst that runs from 0 to 1", () => {
    const he = makeGrenade({
      kind: "he",
      start_tick: 80,
      detonate_tick: 100,
      end_tick: 0,
      points: [{ tick: 100, x: 5, y: 5, z: 0 }],
    });
    const nade = frame(matchReplay({ grenades: [he] }), 100).nades[0];
    expect(nade.phase).toBe("burst");
    if (nade.phase !== "burst") return;
    expect(nade.progress).toBe(0);
  });

  it("skips throws that belong to another round", () => {
    const replay = matchReplay({
      rounds: [
        makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 500 }),
        makeRound({ number: 2, start_tick: 501, freeze_end_tick: 565, end_tick: 5000 }),
      ],
      grenades: [flight],
    });
    // Round 2 is current at tick 600; the round-1 smoke must not leak into it.
    expect(frame(replay, 600).nades).toEqual([]);
  });

  it("scales the linger radius with the zoom, up to a cap", () => {
    const replay = matchReplay({ grenades: [flight] });
    const near = frame(replay, 120, { scale: 1 }).nades[0];
    const far = frame(replay, 120, { scale: 4 }).nades[0];
    if (near.phase !== "linger" || far.phase !== "linger") throw new Error("expected linger");
    expect(far.radius).toBeGreaterThan(near.radius);
    // Capped, so a deep zoom does not turn a smoke into a wall.
    expect(far.radius / near.radius).toBeLessThanOrEqual(1.4);
  });
});

describe("buildRadarFrame layers", () => {
  const off: MapLayers = {
    grenades: false,
    shots: false,
    names: false,
    deaths: false,
    cone: false,
    heatmap: false,
    summary: false,
    openings: false,
  };

  it("builds nothing optional when every layer is off", () => {
    const replay = matchReplay({
      grenades: [makeGrenade({ kind: "smoke", points: [{ tick: 100, x: 1, y: 1, z: 0 }] })],
      shots: [makeShot(200, 0)],
      kills: [makeKill(300, 0, 2)],
    });
    const f = frame(replay, 200, { layers: off });
    expect(f.nades).toEqual([]);
    expect(f.tracers).toEqual([]);
    expect(f.deaths).toEqual([]);
    expect(f.opening).toBeNull();
    expect(f.cone).toBeNull();
    // Pawns are not a layer: the radar always shows the players.
    expect(f.pawns).toHaveLength(4);
  });

  it("fades a tracer out over its life", () => {
    const replay = matchReplay({ shots: [makeShot(200, 0, { yaw: 90 })] });
    expect(frame(replay, 200).tracers[0].fade).toBeCloseTo(1);
    const late = frame(replay, 200 + Math.round(TRACER_SECONDS * tps * 0.5)).tracers[0];
    expect(late.fade).toBeCloseTo(0.5, 1);
    expect(frame(replay, 200 + Math.ceil(TRACER_SECONDS * tps) + 1).tracers).toEqual([]);
  });

  it("keeps deaths inside the round window and colours the line by the killer's side", () => {
    // Everyone stands at the origin, so the victim has to fall far enough away
    // for the kill line to clear KILL_LINE_MIN_LENGTH.
    const far = { x: 500, y: 0 };
    const replay = matchReplay({
      kills: [makeKill(32, 0, 2, far), makeKill(300, 0, 2, far), makeKill(400, 2, 0, far)],
    });
    const f = frame(replay, 400);
    // The tick-32 frag is before freeze end, so it is not a round death.
    expect(f.deaths).toHaveLength(2);
    expect(f.deaths[0].line?.color).toBe(CT_COLOR);
    expect(f.deaths[1].line?.color).toBe(T_COLOR);
  });

  it("marks the opening duel once the first frag has happened", () => {
    const replay = matchReplay({ kills: [makeKill(300, 0, 2, { x: 500, y: 0 })] });
    expect(frame(replay, 200).opening).toBeNull();
    expect(frame(replay, 300).opening).not.toBeNull();
  });
});

describe("buildRadarFrame view", () => {
  it("trails only the selected player, and every player when none is selected", () => {
    const replay = matchReplay({ ticks: makeFreezeTicks(4, 2) });
    // A single freeze frame is one point per player, which is not a trail.
    expect(frame(replay, 64, { trails: true }).trails).toEqual([]);

    const moving = matchReplay();
    moving.ticks = makeFreezeTicks(4, 2, 64);
    const two = makeFreezeTicks(4, 2, 64);
    // Two frames so each player has a two-point trail.
    const wide = { ...two, frameCount: 2 };
    wide.ticks = new Uint32Array([64, 128]);
    wide.x = new Float32Array([0, 0, 0, 0, 10, 10, 10, 10]);
    wide.y = new Float32Array([0, 0, 0, 0, 10, 10, 10, 10]);
    wide.z = new Float32Array(8);
    wide.yaw = new Float32Array(8);
    wide.flags = new Uint8Array([...two.flags, ...two.flags]);
    wide.health = new Uint8Array([...two.health, ...two.health]);
    wide.armor = new Uint8Array(8);
    wide.money = new Uint16Array(8);
    wide.equip = new Uint16Array(8);
    wide.gear = new Uint16Array(8);
    wide.primary = new Uint8Array(8);
    wide.secondary = new Uint8Array(8);
    wide.active = new Uint8Array(8);
    moving.ticks = wide;

    expect(frame(moving, 128, { trails: true }).trails).toHaveLength(4);
    expect(frame(moving, 128, { trails: true, selected: 2 }).trails).toHaveLength(1);
  });

  it("shows the view cone only for a selected player who is alive", () => {
    const replay = matchReplay();
    expect(frame(replay, 64).cone).toBeNull();
    expect(frame(replay, 64, { selected: 0 })?.cone).not.toBeNull();

    const dead = matchReplay();
    dead.ticks.health[0] = 0;
    dead.ticks.flags[0] &= ~2; // clear FLAG_ALIVE
    expect(frame(dead, 64, { selected: 0 }).cone).toBeNull();
  });

  it("puts a countdown flash pulse on a blinded alive pawn", () => {
    const replay = matchReplay({
      blinds: [makeBlind(64, 2, 0, 3)],
    });
    const f = frame(replay, 64 + 64);
    const flash = f.flashes.find((pulse) => pulse.x === f.pawns.find((p) => p.index === 0)?.x);
    expect(flash).toBeDefined();
    expect(flash?.left).toBeGreaterThan(0);
    expect(flash?.left).toBeLessThan(1);
    expect(f.pawns.find((p) => p.index === 0)?.flash).toBeCloseTo(2, 5);
  });

  it("carries the player's name, health and side colour onto the pawn", () => {
    const f = frame(matchReplay(), 64, { selected: 1 });
    const alice = f.pawns.find((p) => p.index === 0);
    expect(alice?.name).toBe("Alice");
    expect(alice?.health).toBe(100);
    expect(alice?.color).toBe(CT_COLOR);
    expect(alice?.selected).toBe(false);
    expect(f.pawns.find((p) => p.index === 2)?.color).toBe(T_COLOR);
    expect(f.pawns.find((p) => p.index === 1)?.selected).toBe(true);
  });

  it("stays on the upper radar when the map has no lower floor", () => {
    expect(frame(matchReplay(), 64).useLowerFloor).toBe(false);
  });

  it("hides off-radar pawns during post-round scrub", () => {
    const ticks = makeTicks(2, 2);
    ticks.ticks[0] = 500;
    ticks.ticks[1] = 600;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[2] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[3] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.x[0] = 100;
    ticks.y[0] = 200;
    ticks.x[1] = 9000;
    ticks.y[1] = 9000;
    ticks.x[2] = 150;
    ticks.y[2] = 250;
    ticks.x[3] = 9000;
    ticks.y[3] = 9000;
    const replay = matchReplay({
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 500 })],
      ticks,
    });
    const pawns = frame(replay, 600).pawns;
    expect(pawns).toHaveLength(1);
    expect(pawns[0]?.index).toBe(0);
    expect(pawns[0]?.x).toBe(150);
    expect(pawns[0]?.y).toBe(250);
  });
});

describe("buildRadarFrame bomb", () => {
  it("keeps the planted timer path after a plant", () => {
    const replay = matchReplay({
      bombEvents: [makeBombEvent({ tick: 200, kind: "planted", x: 120, y: 220 })],
    });
    expect(frame(replay, 200 + tps).bomb).toEqual({
      state: "planted",
      remaining: BOMB_SECONDS - 1,
      x: 120,
      y: 220,
    });
  });

  it("marks the carrier from GEAR_C4", () => {
    const ticks = makeFreezeTicks(4, 2);
    ticks.gear[2] = GEAR_C4;
    const replay = matchReplay({ ticks });
    expect(frame(replay, 64).bomb).toEqual({ state: "carried", player: 2 });
    expect(frame(replay, 64).pawns.find((p) => p.index === 2)?.carriesC4).toBe(true);
  });

  it("places a loose pack at the drop", () => {
    const replay = matchReplay({
      bombEvents: [makeBombEvent({ tick: 200, kind: "dropped", x: 50, y: 60, player: 2 })],
    });
    expect(frame(replay, 250).bomb).toEqual({ state: "loose", x: 50, y: 60 });
  });
});
