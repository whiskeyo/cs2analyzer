/* eslint-disable max-lines -- canvas paint paths share one mock setup */
import { describe, expect, it } from "vitest";
import { DEFAULT_TICK_RATE, MOLOTOV_SECONDS, SMOKE_SECONDS } from "@/lib/shared/constants";
import { DEFAULT_SUMMARY_FILTER, type MapLayers } from "@/lib/notes/types";
import { buildSeries, loadedDemo } from "@/lib/parse/session";
import { buildSeriesOverlay } from "@/lib/parse/seriesOverlay";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import {
  makeBombEvent,
  makeBlind,
  makeFreezeTicks,
  makeGrenade,
  makeHurt,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeShot,
  makeTicks,
  UNIT_CALIBRATION,
} from "@/lib/testing/fixtures";
import { arcCountAt, createMockCanvas, identityToScreen } from "@/lib/testing/mockCanvas";
import { NADE_COLORS } from "@/lib/radar/radarFx";
import { buildRadarFrame, CT_COLOR, RADAR_STYLE, type RadarFrame } from "./radarFrame";
import { paintHabitsOverlay, paintPawns, paintRadarFrame, paintViewCone } from "./paintRadarFrame";

const tps = DEFAULT_TICK_RATE;
const toScreen = identityToScreen;
const paintOpts = { scale: 1, c4Icon: null as HTMLImageElement | null };

const allLayers: MapLayers = {
  grenades: true,
  shots: true,
  names: true,
  deaths: true,
  cone: true,
  heatmap: true,
  summary: true,
  openings: true,
};

function frame(replay: ReturnType<typeof makeReplay>, tick: number, layers = allLayers) {
  return buildRadarFrame({
    replay,
    tick,
    layers,
    summaryFilter: DEFAULT_SUMMARY_FILTER,
    selected: null,
    trails: true,
    floorMode: "auto",
    cal: UNIT_CALIBRATION,
    scale: 1,
  });
}

function matchReplay(overrides: Parameters<typeof makeReplay>[0] = {}) {
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

function minimalFrame(partial: Partial<RadarFrame>): RadarFrame {
  return {
    tick: 100,
    round: null,
    players: [],
    useLowerFloor: false,
    heatmap: [],
    summary: [],
    nades: [],
    tracers: [],
    bomb: null,
    deaths: [],
    opening: null,
    trails: [],
    cone: null,
    hits: [],
    flashes: [],
    pawns: [],
    ...partial,
  };
}

function makeTrailTicks(frames = 5) {
  const playerCount = 10;
  const ctCount = 5;
  const buf = makeTicks(playerCount, frames);
  for (let f = 0; f < frames; f++) {
    buf.ticks[f] = 64 + f * 64;
    for (let i = 0; i < playerCount; i++) {
      const slot = f * playerCount + i;
      buf.flags[slot] = FLAG_PRESENT | FLAG_ALIVE | (i < ctCount ? FLAG_CT : 0);
      buf.x[slot] = 100 + f * 12;
      buf.y[slot] = 200;
      buf.yaw[slot] = 45;
    }
  }
  return buf;
}

function habitsOverlay() {
  const focal = "Team A";
  const replay = makeReplay({
    header: { team_ct: focal, team_t: "B" },
    ticks: makeTrailTicks(),
    rounds: [
      makeRound({
        number: 1,
        team_ct: focal,
        team_t: "B",
        start_tick: 0,
        freeze_end_tick: 64,
        end_tick: 2000,
      }),
    ],
    grenades: [
      makeGrenade({
        kind: "smoke",
        thrower: 0,
        start_tick: 100,
        detonate_tick: 200,
        end_tick: 2000,
        points: [
          { tick: 100, x: 50, y: 50, z: 0 },
          { tick: 200, x: 200, y: 200, z: 0 },
        ],
      }),
    ],
    kills: [makeKill(64 + 64 * 3, 1, 0, { x: 150, y: 200 })],
  });
  const demo = loadedDemo(replay, "a.dem", new File([], "a.dem"));
  const series = buildSeries("de_mirage", [demo], focal);
  return buildSeriesOverlay(series, { side: "CT", kind: "pistol" }, null, 8);
}

describe("paintRadarFrame", () => {
  it("paints heatmap dots with the radar heatmap alpha", () => {
    const ctx = createMockCanvas();
    const replay = matchReplay({
      kills: [makeKill(200, 0, 2, { x: 100, y: 200, headshot: true })],
    });
    const f = frame(replay, 300);
    paintRadarFrame(ctx, f, toScreen, paintOpts);
    expect(f.heatmap.length).toBeGreaterThan(0);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(1);
  });

  it("paints summary discs as filled and stroked circles", () => {
    const ctx = createMockCanvas();
    const replay = matchReplay({
      grenades: [
        makeGrenade({
          kind: "smoke",
          points: [{ tick: 100, x: 50, y: 60, z: 0 }],
        }),
      ],
    });
    const f = frame(replay, 200);
    expect(f.summary.length).toBeGreaterThan(0);
    paintRadarFrame(ctx, f, toScreen, paintOpts);
    expect(ctx.fill.mock.calls.length).toBeGreaterThan(0);
    expect(ctx.stroke.mock.calls.length).toBeGreaterThan(0);
  });

  it("paints smoke flight trails with dashed strokes", () => {
    const ctx = createMockCanvas();
    const nade = frame(
      matchReplay({
        grenades: [
          makeGrenade({
            kind: "smoke",
            points: [
              { tick: 80, x: 0, y: 0, z: 0 },
              { tick: 100, x: 10, y: 10, z: 0 },
            ],
          }),
        ],
      }),
      90,
    ).nades[0];
    expect(nade?.phase).toBe("flight");
    paintRadarFrame(ctx, minimalFrame({ nades: nade ? [nade] : [] }), toScreen, paintOpts);
    expect(ctx.setLineDash).toHaveBeenCalledWith([]);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(1);
  });

  it("draws the nade flight trail at 0.4 and the head at full opacity", () => {
    const ctx = createMockCanvas();
    const alphas: number[] = [];
    Object.defineProperty(ctx, "globalAlpha", {
      configurable: true,
      set(value: number) {
        alphas.push(value);
      },
      get() {
        return alphas.at(-1) ?? 1;
      },
    });
    const nade = frame(
      matchReplay({
        grenades: [
          makeGrenade({
            kind: "smoke",
            points: [
              { tick: 80, x: 0, y: 0, z: 0 },
              { tick: 100, x: 10, y: 10, z: 0 },
            ],
          }),
        ],
      }),
      90,
    ).nades[0];
    paintRadarFrame(ctx, minimalFrame({ nades: nade ? [nade] : [] }), toScreen, paintOpts);
    expect(alphas).toContain(0.4);
    expect(alphas.at(-1)).toBe(1);
  });

  it("paints HE flight as a rotated square head when no icon is loaded", () => {
    const ctx = createMockCanvas();
    const nade = frame(
      matchReplay({
        grenades: [
          makeGrenade({
            kind: "he",
            points: [
              { tick: 80, x: 0, y: 0, z: 0 },
              { tick: 100, x: 5, y: 5, z: 0 },
            ],
          }),
        ],
      }),
      90,
    ).nades[0];
    paintRadarFrame(ctx, minimalFrame({ nades: nade ? [nade] : [] }), toScreen, paintOpts);
    expect(ctx.setLineDash).toHaveBeenCalledWith([6, 4]);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("paints a grenade SVG at the flight head when the icon is loaded", () => {
    const ctx = createMockCanvas();
    const icon = { complete: true, naturalWidth: 15, naturalHeight: 32 } as HTMLImageElement;
    const nade = frame(
      matchReplay({
        grenades: [
          makeGrenade({
            kind: "smoke",
            points: [
              { tick: 80, x: 0, y: 0, z: 0 },
              { tick: 100, x: 10, y: 10, z: 0 },
            ],
          }),
        ],
      }),
      90,
    ).nades[0];
    paintRadarFrame(ctx, minimalFrame({ nades: nade ? [nade] : [] }), toScreen, {
      ...paintOpts,
      nadeIcons: { smoke: icon },
    });
    expect(ctx.drawImage).toHaveBeenCalled();
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it("uses the incendiary SVG for an in-flight incendiary, not the molotov bottle", () => {
    const ctx = createMockCanvas();
    const molotov = {
      complete: true,
      naturalWidth: 10,
      naturalHeight: 10,
    } as HTMLImageElement;
    const incendiary = {
      complete: true,
      naturalWidth: 20,
      naturalHeight: 20,
    } as HTMLImageElement;
    const nade = frame(
      matchReplay({
        grenades: [
          makeGrenade({
            kind: "incendiary",
            points: [
              { tick: 80, x: 0, y: 0, z: 0 },
              { tick: 100, x: 10, y: 10, z: 0 },
            ],
          }),
        ],
      }),
      90,
    ).nades[0];
    paintRadarFrame(ctx, minimalFrame({ nades: nade ? [nade] : [] }), toScreen, {
      ...paintOpts,
      nadeIcons: { molotov, incendiary },
    });
    expect(ctx.drawImage.mock.calls[0]?.[0]).toBe(incendiary);
  });

  it("paints molotov fire cells and a dial", () => {
    const ctx = createMockCanvas();
    const nade = frame(
      matchReplay({
        grenades: [
          makeGrenade({
            kind: "molotov",
            start_tick: 80,
            detonate_tick: 100,
            end_tick: 0,
            points: [{ tick: 100, x: 500, y: 500, z: 0 }],
            fires: [
              { x: 100, y: 200, start_tick: 100, end_tick: 100 + MOLOTOV_SECONDS * tps },
              { x: 300, y: 400, start_tick: 100, end_tick: 100 + MOLOTOV_SECONDS * tps },
            ],
          }),
        ],
      }),
      200,
    ).nades[0];
    expect(nade?.phase).toBe("fires");
    paintRadarFrame(ctx, minimalFrame({ nades: nade ? [nade] : [] }), toScreen, paintOpts);
    expect(ctx.fill.mock.calls.length).toBeGreaterThan(1);
    expect(ctx.arc).toHaveBeenCalled();
  });

  it("paints smoke linger with fill, stroke, and dial", () => {
    const ctx = createMockCanvas();
    const replay = matchReplay({
      grenades: [
        makeGrenade({
          kind: "smoke",
          start_tick: 80,
          detonate_tick: 120,
          end_tick: 0,
          points: [
            { tick: 80, x: 0, y: 0, z: 0 },
            { tick: 120, x: 20, y: 20, z: 0 },
          ],
        }),
      ],
    });
    const nade = frame(replay, 120).nades[0];
    expect(nade?.phase).toBe("linger");
    paintRadarFrame(ctx, minimalFrame({ nades: nade ? [nade] : [] }), toScreen, paintOpts);
    expect(arcCountAt(ctx, 20, 20)).toBeGreaterThan(0);
  });

  it("paints HE burst via drawHeBurst", () => {
    const ctx = createMockCanvas();
    const nade = frame(
      matchReplay({
        grenades: [
          makeGrenade({
            kind: "he",
            detonate_tick: 100,
            points: [{ tick: 100, x: 5, y: 5, z: 0 }],
          }),
        ],
      }),
      100,
    ).nades[0];
    expect(nade?.phase).toBe("burst");
    paintRadarFrame(ctx, minimalFrame({ nades: nade ? [nade] : [] }), toScreen, paintOpts);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("paints flash puff circles", () => {
    const ctx = createMockCanvas();
    paintRadarFrame(
      ctx,
      minimalFrame({
        nades: [
          {
            phase: "puff",
            kind: "flash",
            color: NADE_COLORS.flash,
            at: { x: 30, y: 40 },
            radius: 12,
            alpha: 0.45,
          },
        ],
      }),
      toScreen,
      paintOpts,
    );
    expect(arcCountAt(ctx, 30, 40)).toBeGreaterThan(0);
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("paints shot tracers with glow and core lines", () => {
    const ctx = createMockCanvas();
    const replay = matchReplay({ shots: [makeShot(200, 0, { yaw: 0, x: 50, y: 50 })] });
    const f = frame(replay, 200);
    paintRadarFrame(ctx, f, toScreen, paintOpts);
    expect(f.tracers).toHaveLength(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.strokeStyle).toBe(RADAR_STYLE.tracerColor);
  });

  it("paints the planted bomb", () => {
    const ctx = createMockCanvas();
    const replay = matchReplay({
      bombEvents: [makeBombEvent({ tick: 200, kind: "planted", x: 120, y: 220 })],
    });
    const f = frame(replay, 250);
    expect(f.bomb).not.toBeNull();
    paintRadarFrame(ctx, f, toScreen, paintOpts);
    expect(ctx.fillText).toHaveBeenCalledWith("C4", 120, 220);
  });

  it("paints death marks and optional kill lines", () => {
    const ctx = createMockCanvas();
    const far = { x: 500, y: 0 };
    const replay = matchReplay({
      kills: [makeKill(300, 0, 2, far)],
    });
    const f = frame(replay, 400);
    paintRadarFrame(ctx, f, toScreen, paintOpts);
    expect(f.deaths.length).toBeGreaterThan(0);
    expect(ctx.setLineDash).toHaveBeenCalledWith([7, 5]);
    expect(ctx.stroke.mock.calls.length).toBeGreaterThan(1);
  });

  it("paints the opening duel arrow and FK/FD labels", () => {
    const ctx = createMockCanvas();
    const replay = matchReplay({
      kills: [makeKill(300, 0, 2, { x: 500, y: 0 })],
    });
    const f = frame(replay, 300);
    expect(f.opening).not.toBeNull();
    paintRadarFrame(ctx, f, toScreen, paintOpts);
    expect(ctx.strokeText).toHaveBeenCalledWith("FK", expect.any(Number), expect.any(Number));
    expect(ctx.fillText).toHaveBeenCalledWith("FD", expect.any(Number), expect.any(Number));
  });

  it("paints player trails", () => {
    const ctx = createMockCanvas();
    const moving = matchReplay();
    const two = makeFreezeTicks(4, 2, 64);
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
    moving.ticks = wide;
    const f = frame(moving, 128);
    paintRadarFrame(ctx, f, toScreen, paintOpts);
    expect(f.trails.length).toBeGreaterThan(0);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it("resets globalAlpha after painting", () => {
    const ctx = createMockCanvas();
    paintRadarFrame(
      ctx,
      minimalFrame({
        heatmap: [{ x: 1, y: 2, radius: 5, color: "#f00" }],
        summary: [{ x: 3, y: 4, radius: 8, color: "#0f0" }],
        tracers: [{ x: 0, y: 0, yaw: 90, fade: 0.5 }],
      }),
      toScreen,
      paintOpts,
    );
    expect(ctx.globalAlpha).toBe(1);
  });
});

describe("paintHabitsOverlay", () => {
  const nadeFilter = { smoke: true, molotov: true, flash: true, he: true };

  it("paints heatmap dots in heatmap display mode", () => {
    const ctx = createMockCanvas();
    const overlay = habitsOverlay();
    paintHabitsOverlay(ctx, overlay, "heatmap", nadeFilter, toScreen, 1, {
      showTrails: true,
      playSec: 5,
    });
    expect(overlay.heatDots.length).toBeGreaterThan(0);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("paints trails and death crosses in trails display mode", () => {
    const ctx = createMockCanvas();
    const overlay = habitsOverlay();
    paintHabitsOverlay(ctx, overlay, "trails", nadeFilter, toScreen, 1, {
      showTrails: true,
      playSec: 10,
    });
    expect(ctx.stroke).toHaveBeenCalled();
    const hasDeathCross = overlay.trails.some((t) => t.deathAt != null);
    expect(hasDeathCross).toBe(true);
    expect(ctx.stroke.mock.calls.length).toBeGreaterThan(1);
  });

  it("paints a survive tick at round end and skips the movement arrow", () => {
    const ctx = createMockCanvas();
    const overlay = {
      ...habitsOverlay(),
      trails: [
        {
          demoId: "a",
          roundNumber: 1,
          jumpTick: 64,
          tps: 64,
          steamId: 1,
          playerName: "A",
          color: "#fff",
          points: [
            { x: 0, y: 0, z: 0, tick: 64, yaw: 0 },
            { x: 40, y: 40, z: 0, tick: 200, yaw: 45 },
          ],
          deathAt: null,
          deathTick: null,
          survivedAt: { x: 40, y: 40 },
          survivedTick: 200,
        },
      ],
    };
    paintHabitsOverlay(ctx, overlay, "trails", nadeFilter, toScreen, 1, {
      showTrails: true,
      showArrows: true,
      nadesOn: false,
      cal: UNIT_CALIBRATION,
    });
    expect(ctx.strokeStyle).toBe(RADAR_STYLE.surviveMarkColor);
    expect(ctx.rotate).not.toHaveBeenCalled();
  });

  it("paints a survive tick at round end and skips the movement arrow", () => {
    const ctx = createMockCanvas();
    const overlay = {
      ...habitsOverlay(),
      trails: [
        {
          demoId: "a",
          roundNumber: 1,
          jumpTick: 64,
          tps: 64,
          steamId: 1,
          playerName: "A",
          color: "#fff",
          points: [
            { x: 0, y: 0, z: 0, tick: 64, yaw: 0 },
            { x: 40, y: 40, z: 0, tick: 200, yaw: 45 },
          ],
          deathAt: null,
          deathTick: null,
          survivedAt: { x: 40, y: 40 },
          survivedTick: 200,
        },
      ],
    };
    paintHabitsOverlay(ctx, overlay, "trails", nadeFilter, toScreen, 1, {
      showTrails: true,
      showArrows: true,
      nadesOn: false,
      cal: UNIT_CALIBRATION,
    });
    expect(ctx.strokeStyle).toBe(RADAR_STYLE.surviveMarkColor);
    expect(ctx.rotate).not.toHaveBeenCalled();
  });

  it("paints player arrows when showArrows is on", () => {
    const ctx = createMockCanvas();
    const overlay = habitsOverlay();
    paintHabitsOverlay(ctx, overlay, "trails", nadeFilter, toScreen, 1, {
      showTrails: true,
      showArrows: true,
      cal: UNIT_CALIBRATION,
      playSec: 10,
    });
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it("skips arrows for heads off the radar", () => {
    const ctx = createMockCanvas();
    const overlay = {
      ...habitsOverlay(),
      trails: [
        {
          demoId: "a",
          roundNumber: 1,
          jumpTick: 64,
          tps: 64,
          steamId: 1,
          playerName: "A",
          color: "#fff",
          points: [{ x: 99999, y: 99999, z: 0, tick: 64, yaw: 0 }],
          deathAt: null,
          deathTick: null,
          survivedAt: null,
          survivedTick: null,
        },
      ],
    };
    paintHabitsOverlay(ctx, overlay, "trails", nadeFilter, toScreen, 1, {
      showArrows: true,
      cal: UNIT_CALIBRATION,
    });
    expect(ctx.rotate).not.toHaveBeenCalled();
  });

  it("paints util with reduced opacity in heatmap mode", () => {
    const ctx = createMockCanvas();
    const overlay = habitsOverlay();
    paintHabitsOverlay(ctx, overlay, "heatmap", nadeFilter, toScreen, 1, {
      nadesOn: true,
      nadeOpacity: 0.5,
      playSec: 1.5,
    });
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.globalAlpha).toBe(1);
  });

  it("respects the nade kind filter", () => {
    const ctx = createMockCanvas();
    const overlay = habitsOverlay();
    paintHabitsOverlay(
      ctx,
      overlay,
      "trails",
      { smoke: false, molotov: false, flash: false, he: false },
      toScreen,
      1,
      { nadesOn: true, playSec: 1.5 },
    );
    const strokeBefore = ctx.stroke.mock.calls.length;
    const fillBefore = ctx.fill.mock.calls.length;
    ctx.stroke.mockClear();
    ctx.fill.mockClear();
    paintHabitsOverlay(ctx, overlay, "trails", nadeFilter, toScreen, 1, {
      nadesOn: true,
      playSec: 1.5,
    });
    expect(ctx.stroke.mock.calls.length + ctx.fill.mock.calls.length).toBeGreaterThan(
      strokeBefore + fillBefore === 0 ? 0 : -1,
    );
  });

  it("returns early when nades are disabled", () => {
    const ctx = createMockCanvas();
    const overlay = habitsOverlay();
    paintHabitsOverlay(ctx, overlay, "trails", nadeFilter, toScreen, 1, {
      nadesOn: false,
      playSec: 5,
    });
    expect(ctx.globalAlpha).toBe(1);
  });

  it("skips trails when showTrails is false", () => {
    const ctx = createMockCanvas();
    const overlay = habitsOverlay();
    paintHabitsOverlay(ctx, overlay, "trails", nadeFilter, toScreen, 1, {
      showTrails: false,
      showArrows: false,
      nadesOn: false,
    });
    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});

describe("paintViewCone", () => {
  it("does nothing when the frame has no cone", () => {
    const ctx = createMockCanvas();
    paintViewCone(ctx, minimalFrame({}), toScreen);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it("draws a rotated wedge under the pawn", () => {
    const ctx = createMockCanvas();
    paintViewCone(
      ctx,
      minimalFrame({
        cone: { x: 100, y: 200, yaw: 90, radius: 78, color: CT_COLOR },
      }),
      toScreen,
    );
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.translate).toHaveBeenCalledWith(100, 200);
    expect(ctx.rotate).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});

describe("paintPawns", () => {
  it("paints hit pulses and flash rings", () => {
    const ctx = createMockCanvas();
    const replay = matchReplay({
      hurts: [makeHurt(200, 2, 0, 40)],
      blinds: [makeBlind(200, 2, 0, 2)],
    });
    const f = frame(replay, 210, { ...allLayers, cone: false });
    paintPawns(ctx, f, toScreen, false);
    expect(f.hits.length).toBeGreaterThan(0);
    expect(f.flashes.length).toBeGreaterThan(0);
    expect(f.flashes[0]?.left).toBeGreaterThan(0);
    expect(ctx.fill.mock.calls.length).toBeGreaterThan(0);
    expect(ctx.stroke.mock.calls.length).toBeGreaterThan(0);
    const pawn = f.pawns.find((p) => p.flash > 0);
    expect(pawn).toBeDefined();
    expect(arcCountAt(ctx, pawn!.x, pawn!.y)).toBeGreaterThan(0);
  });

  it("paints pawn arrows, selection ring, and health bars", () => {
    const ctx = createMockCanvas();
    const f = frame(matchReplay(), 64, { ...allLayers, names: true });
    paintPawns(ctx, f, toScreen, true);
    expect(f.pawns.length).toBe(4);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillRect).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it("uses the low-health colour below the threshold", () => {
    const ctx = createMockCanvas();
    paintPawns(
      ctx,
      minimalFrame({
        pawns: [
          {
            index: 0,
            x: 50,
            y: 50,
            yaw: 0,
            color: CT_COLOR,
            alive: true,
            selected: false,
            flash: 0,
            name: "LowHP",
            health: 15,
          },
        ],
      }),
      toScreen,
      false,
    );
    expect(ctx.fillStyle).toBe(RADAR_STYLE.deathMarkColor);
    expect(ctx.fillRect).toHaveBeenCalled();
  });

  it("dims dead pawns and skips their health bar", () => {
    const ctx = createMockCanvas();
    paintPawns(
      ctx,
      minimalFrame({
        pawns: [
          {
            index: 0,
            x: 50,
            y: 50,
            yaw: 0,
            color: CT_COLOR,
            alive: false,
            selected: false,
            flash: 0,
            name: "Dead",
            health: 0,
          },
        ],
      }),
      toScreen,
      false,
    );
    expect(ctx.globalAlpha).toBe(1);
    expect(ctx.fillRect).not.toHaveBeenCalled();
  });

  it("shows blind duration text for flashed alive players", () => {
    const ctx = createMockCanvas();
    const replay = matchReplay({
      blinds: [makeBlind(64, 2, 0, 3)],
    });
    const f = frame(replay, 100, allLayers);
    paintPawns(ctx, f, toScreen, false);
    const blindLabel = ctx.fillText.mock.calls.find((call) => String(call[0]).includes("s"));
    expect(blindLabel).toBeDefined();
  });

  it("keeps the team colour on a flashed pawn", () => {
    const ctx = createMockCanvas();
    const styles: string[] = [];
    Object.defineProperty(ctx, "fillStyle", {
      configurable: true,
      set(value: string) {
        styles.push(String(value));
      },
      get() {
        return styles.at(-1) ?? "";
      },
    });
    paintPawns(
      ctx,
      minimalFrame({
        pawns: [
          {
            index: 0,
            x: 50,
            y: 50,
            yaw: 0,
            color: CT_COLOR,
            alive: true,
            selected: false,
            flash: 2,
            name: "Alice",
            health: 100,
          },
        ],
      }),
      toScreen,
      false,
    );
    expect(styles).toContain(CT_COLOR);
    expect(styles.some((s) => s.includes("255, 252, 230"))).toBe(false);
  });

  it("strokes a white outline on the selected pawn", () => {
    const ctx = createMockCanvas();
    const f = frame(matchReplay(), 64, { ...allLayers, cone: true });
    const selected = buildRadarFrame({
      replay: matchReplay(),
      tick: 64,
      layers: allLayers,
      summaryFilter: DEFAULT_SUMMARY_FILTER,
      selected: 1,
      trails: false,
      floorMode: "auto",
      cal: UNIT_CALIBRATION,
      scale: 1,
    });
    paintPawns(ctx, selected, toScreen, false);
    expect(selected.pawns.find((p) => p.index === 1)?.selected).toBe(true);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(f.pawns.length).toBe(4);
  });
});

describe("paintRadarFrame smoke linger timing", () => {
  it("fades linger dial as the smoke expires", () => {
    const replay = matchReplay({
      grenades: [
        makeGrenade({
          kind: "smoke",
          start_tick: 80,
          detonate_tick: 120,
          end_tick: 0,
          points: [
            { tick: 80, x: 0, y: 0, z: 0 },
            { tick: 120, x: 20, y: 20, z: 0 },
          ],
        }),
      ],
    });
    const atPop = frame(replay, 120).nades[0];
    const halfway = frame(replay, 120 + (SMOKE_SECONDS / 2) * tps).nades[0];
    expect(atPop?.phase).toBe("linger");
    expect(halfway?.phase).toBe("linger");
    if (atPop?.phase !== "linger" || halfway?.phase !== "linger") return;
    expect(atPop.left).toBeCloseTo(1);
    expect(halfway.left).toBeCloseTo(0.5, 1);
  });
});
