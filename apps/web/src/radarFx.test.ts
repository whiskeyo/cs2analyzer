import { describe, expect, it } from "vitest";
import { KILL_LINE_MIN_LENGTH } from "./constants";
import {
  blindsAt,
  firesAt,
  HIT_SECONDS,
  hitsAt,
  killLineEnds,
  lingerRemaining,
  nadeLandPos,
  nadePopTick,
  nadeVisibleEnd,
  nadesForSummary,
  occupancyToDraw,
  openingDuel,
  shortenSegment,
} from "./radarFx";
import {
  FLAG_ALIVE,
  FLAG_CT,
  FLAG_PRESENT,
  type GrenadeThrow,
  type Kill,
  type Player,
  type Replay,
  type Round,
  DEFAULT_SUMMARY_FILTER,
} from "./types";

describe("blindsAt", () => {
  it("returns remaining flash time for the victim", () => {
    const blinds = [{ tick: 100, attacker: 1, victim: 0, duration: 2 }];
    expect(blindsAt(blinds, 99, 64).get(0)).toBeUndefined();
    expect(blindsAt(blinds, 100, 64).get(0)).toBeCloseTo(2, 5);
    expect(blindsAt(blinds, 100 + 64, 64).get(0)).toBeCloseTo(1, 5);
    expect(blindsAt(blinds, 100 + 64 * 2, 64).get(0)).toBeUndefined();
  });

  it("keeps the longest overlapping flash", () => {
    const blinds = [
      { tick: 100, attacker: 1, victim: 0, duration: 0.5 },
      { tick: 110, attacker: 2, victim: 0, duration: 2 },
    ];
    expect(blindsAt(blinds, 120, 64).get(0)).toBeCloseTo(2 - 10 / 64, 5);
  });
});

describe("hitsAt", () => {
  it("tracks the latest hit inside the pulse window", () => {
    const hurts = [
      { tick: 50, attacker: 1, victim: 0, damage: 20, weapon: "ak47" },
      { tick: 100, attacker: 1, victim: 0, damage: 40, weapon: "ak47" },
    ];
    expect(hitsAt(hurts, 100, 64)?.get(0)).toEqual({ age: 0, damage: 40 });
    expect(hitsAt(hurts, 100 + 64 * 0.2, 64)?.get(0)?.damage).toBe(40);
    expect(hitsAt(hurts, 100 + 64 * (HIT_SECONDS + 0.05), 64).get(0)).toBeUndefined();
  });
});

describe("lingerRemaining", () => {
  it("is full at pop and empty at expiry", () => {
    expect(lingerRemaining(100, 100 + 64 * 18, 100)).toBe(1);
    expect(lingerRemaining(100, 100 + 64 * 18, 100 + 64 * 9)).toBeCloseTo(0.5, 5);
    expect(lingerRemaining(100, 100 + 64 * 18, 100 + 64 * 18)).toBe(0);
    expect(lingerRemaining(100, 100, 100)).toBe(0);
  });
});

describe("firesAt", () => {
  it("keeps cells whose lifetime covers the tick", () => {
    const fires = [
      { x: 1, y: 2, start_tick: 100, end_tick: 200 },
      { x: 3, y: 4, start_tick: 150, end_tick: 180 },
    ];
    expect(firesAt(fires, 99)).toEqual([]);
    expect(firesAt(fires, 120)).toEqual([fires[0]]);
    expect(firesAt(fires, 160)).toEqual(fires);
    expect(firesAt(fires, 200)).toEqual([fires[0]]);
    expect(firesAt(fires, 201)).toEqual([]);
    expect(firesAt(undefined, 160)).toEqual([]);
  });
});

describe("occupancyToDraw", () => {
  it("uses the first occupancy wave before cells start, then live cells", () => {
    const g = smoke({
      voxels: [{ x: 1, y: 2, start_tick: 140, end_tick: 200 }],
    });
    expect(occupancyToDraw(g, 110)).toEqual(g.voxels);
    expect(occupancyToDraw(g, 150)).toEqual(g.voxels);
    expect(occupancyToDraw(g, 250)).toEqual(g.voxels);
  });
});

function smoke(partial: Partial<GrenadeThrow> = {}): GrenadeThrow {
  return {
    thrower: 0,
    kind: "smoke",
    start_tick: 80,
    detonate_tick: 100,
    end_tick: 100 + 64 * 18,
    points: [],
    ...partial,
  };
}

describe("nadeVisibleEnd", () => {
  it("caps a stretched end_tick at 18s from pop", () => {
    const g = smoke({ end_tick: 50_000 });
    expect(nadeVisibleEnd(g, 64)).toBe(100 + 64 * 18);
  });

  it("hides when occupancy dies early (molly hole)", () => {
    const g = smoke({
      voxels: [{ x: 0, y: 0, start_tick: 100, end_tick: 400 }],
    });
    expect(nadeVisibleEnd(g, 64)).toBe(400);
  });

  it("does not extend past the default window if occupancy lingered in GOTV", () => {
    const g = smoke({
      end_tick: 50_000,
      voxels: [{ x: 0, y: 0, start_tick: 100, end_tick: 50_000 }],
    });
    expect(nadeVisibleEnd(g, 64)).toBe(100 + 64 * 18);
  });

  it("clips to round end", () => {
    const g = smoke();
    expect(nadeVisibleEnd(g, 64, 200)).toBe(200);
  });

  it("does not hide a smoke when occupancy was only sampled for a few ticks", () => {
    const g = smoke({
      voxels: [{ x: 0, y: 0, start_tick: 100, end_tick: 108 }],
    });
    expect(nadeVisibleEnd(g, 64)).toBe(100 + 64 * 18);
  });
});

describe("nadePopTick", () => {
  it("uses the first occupancy sample when detonate is late", () => {
    const g = smoke({
      detonate_tick: 50_000,
      voxels: [{ x: 0, y: 0, start_tick: 120, end_tick: 400 }],
    });
    expect(nadePopTick(g)).toBe(120);
  });
});

describe("nadeLandPos", () => {
  it("uses the last trajectory point when there is no occupancy", () => {
    const g = smoke({
      points: [
        { tick: 80, x: 0, y: 0, z: 0 },
        { tick: 100, x: 400, y: 200, z: 10 },
      ],
    });
    expect(nadeLandPos(g)).toEqual({ x: 400, y: 200 });
  });

  it("uses the occupancy centroid at pop", () => {
    const g = smoke({
      voxels: [
        { x: 0, y: 0, start_tick: 100, end_tick: 200 },
        { x: 20, y: 40, start_tick: 100, end_tick: 200 },
        { x: 999, y: 999, start_tick: 201, end_tick: 300 },
      ],
    });
    expect(nadeLandPos(g)).toEqual({ x: 10, y: 20 });
  });

  it("returns null with no points and no occupancy", () => {
    expect(nadeLandPos(smoke())).toBeNull();
  });
});

function player(index: number, side: Player["start_side"], name: string): Player {
  return { index, steam_id: index + 1, name, start_side: side };
}

function round(partial: Partial<Round> & Pick<Round, "number">): Round {
  return {
    start_tick: 0,
    freeze_end_tick: 64,
    end_tick: 640,
    winner: "CT",
    win_reason: 8,
    score_ct: 0,
    score_t: 0,
    is_knife: false,
    ...partial,
  };
}

function emptyTicks(playerCount: number, frameCount: number) {
  const n = playerCount * frameCount;
  return {
    frameCount,
    playerCount,
    ticks: new Uint32Array(frameCount),
    x: new Float32Array(n),
    y: new Float32Array(n),
    z: new Float32Array(n),
    yaw: new Float32Array(n),
    health: new Uint8Array(n),
    armor: new Uint8Array(n),
    flags: new Uint8Array(n),
    money: new Uint16Array(n),
    equip: new Uint16Array(n),
    gear: new Uint16Array(n),
    primary: new Uint8Array(n),
    secondary: new Uint8Array(n),
  };
}

function replay(partial: Partial<Replay> = {}): Replay {
  return {
    header: {
      map_name: "de_anubis",
      tick_rate: 64,
      tick_stride: 4,
      duration_s: 10,
      playback_ticks: 1920,
      team_ct: "CT",
      team_t: "T",
      score_ct: 0,
      score_t: 0,
    },
    players: [player(0, "CT", "A"), player(1, "T", "B")],
    rounds: [round({ number: 1 })],
    grenades: [],
    shots: [],
    kills: [],
    hurts: [],
    blinds: [],
    bombEvents: [],
    stats: [],
    ticks: emptyTicks(0, 0),
    ...partial,
  };
}

function kill(partial: Partial<Kill> & Pick<Kill, "tick" | "attacker" | "victim">): Kill {
  return {
    assister: -1,
    weapon: "ak47",
    headshot: false,
    assisted_flash: false,
    x: 0,
    y: 0,
    z: 0,
    ...partial,
  };
}

describe("nadesForSummary", () => {
  it("drops knife-round nades and draws smokes under flashes", () => {
    const flash: GrenadeThrow = {
      thrower: 0,
      kind: "flash",
      start_tick: 200,
      detonate_tick: 220,
      end_tick: 240,
      points: [{ tick: 220, x: 1, y: 1, z: 0 }],
    };
    const knifeSmoke = smoke({ start_tick: 10, detonate_tick: 20 });
    const liveSmoke = smoke({ start_tick: 200, detonate_tick: 220 });
    const m = replay({
      rounds: [
        round({ number: 0, is_knife: true, start_tick: 0, end_tick: 100 }),
        round({ number: 1, start_tick: 100, freeze_end_tick: 164, end_tick: 640 }),
      ],
      grenades: [flash, knifeSmoke, liveSmoke],
    });
    expect(nadesForSummary(m).map((g) => g.kind)).toEqual(["smoke", "flash"]);
  });

  it("filters summary nades by kind and thrower side", () => {
    const tSmoke = smoke({ thrower: 1, start_tick: 200, detonate_tick: 220 });
    const ctFlash: GrenadeThrow = {
      thrower: 0,
      kind: "flash",
      start_tick: 200,
      detonate_tick: 220,
      end_tick: 240,
      points: [{ tick: 220, x: 1, y: 1, z: 0 }],
    };
    const m = replay({
      grenades: [tSmoke, ctFlash],
    });
    expect(
      nadesForSummary(m, {
        ...DEFAULT_SUMMARY_FILTER,
        kinds: { ...DEFAULT_SUMMARY_FILTER.kinds, flash: false },
      }).map((g) => g.kind),
    ).toEqual(["smoke"]);
    expect(nadesForSummary(m, { ...DEFAULT_SUMMARY_FILTER, t: false }).map((g) => g.kind)).toEqual([
      "flash",
    ]);
    expect(nadesForSummary(m, { ...DEFAULT_SUMMARY_FILTER, ct: false }).map((g) => g.kind)).toEqual(
      ["smoke"],
    );
  });
});

describe("killLineEnds", () => {
  it("draws attacker to victim for an enemy frag", () => {
    const ticks = emptyTicks(2, 1);
    ticks.ticks[0] = 100;
    ticks.x[0] = 0;
    ticks.y[0] = 0;
    ticks.x[1] = 200;
    ticks.y[1] = 0;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    const m = replay({ ticks });
    const line = killLineEnds(m, kill({ tick: 100, attacker: 0, victim: 1, x: 200, y: 0 }));
    expect(line).toEqual({
      from: { x: 0, y: 0 },
      to: { x: 200, y: 0 },
      ct: true,
    });
  });

  it("skips suicides, teamkills, and point-blank overlap", () => {
    const ticks = emptyTicks(2, 1);
    ticks.ticks[0] = 100;
    ticks.x[0] = 0;
    ticks.x[1] = 8;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    const m = replay({ ticks });
    expect(killLineEnds(m, kill({ tick: 100, attacker: 0, victim: 0, x: 0, y: 0 }))).toBeNull();
    expect(killLineEnds(m, kill({ tick: 100, attacker: 0, victim: 1, x: 8, y: 0 }))).toBeNull();
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.x[1] = KILL_LINE_MIN_LENGTH - 1;
    expect(
      killLineEnds(
        m,
        kill({ tick: 100, attacker: 0, victim: 1, x: KILL_LINE_MIN_LENGTH - 1, y: 0 }),
      ),
    ).toBeNull();
  });
});

describe("openingDuel", () => {
  it("is the first enemy kill of the round, not a teamkill", () => {
    const m = replay({
      players: [player(0, "CT", "A"), player(1, "T", "B"), player(2, "CT", "C")],
      kills: [
        kill({ tick: 80, attacker: 0, victim: 2, x: 10, y: 0 }),
        kill({ tick: 120, attacker: 0, victim: 1, x: 200, y: 0 }),
        kill({ tick: 180, attacker: 1, victim: 0, x: 0, y: 0 }),
      ],
    });
    const r = m.rounds[0];
    expect(openingDuel(m, r, 110)).toBeNull();
    expect(openingDuel(m, r, 120)?.attacker).toBe(0);
    expect(openingDuel(m, r, 120)?.victim).toBe(1);
    expect(openingDuel(m, r, 640)?.tick).toBe(120);
  });
});

describe("shortenSegment", () => {
  it("caps length and leaves short segments", () => {
    expect(shortenSegment({ x: 0, y: 0 }, { x: 100, y: 0 }, 40)).toEqual({
      from: { x: 0, y: 0 },
      to: { x: 40, y: 0 },
    });
    expect(shortenSegment({ x: 0, y: 0 }, { x: 10, y: 0 }, 40)).toEqual({
      from: { x: 0, y: 0 },
      to: { x: 10, y: 0 },
    });
  });
});
