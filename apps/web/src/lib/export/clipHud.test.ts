import { describe, expect, it } from "vitest";
import { clipHudLayout, clipHudState, paintClipHud } from "@/lib/export/clipHud";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import {
  makeBombEvent,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
} from "@/lib/testing/fixtures";
import {
  BOMB_SECONDS,
  DEFUSE_WITH_KIT_SECONDS,
  DEFUSE_WITHOUT_KIT_SECONDS,
  FULL_HEALTH,
  ROUND_TIME_DEFUSE_S,
  WIN_REASON_DEFUSE,
} from "@/lib/shared/constants";
import { roundHudLabel } from "@/lib/stats/hud";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { WEAPON_BY_ID } from "@/lib/weapons/weapons";

const RATE = 64;

describe("clip HUD state", () => {
  it("updates the score after end_tick and shows the final score on the last round", () => {
    const last = makeRound({
      number: 2,
      winner: "T",
      start_tick: 700,
      freeze_end_tick: 764,
      end_tick: 1400,
      score_ct: 9,
      score_t: 9,
    });
    const replay = makeReplay({
      header: { team_ct: "Alpha", team_t: "Bravo" },
      rounds: [
        makeRound({
          number: 1,
          winner: "CT",
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
          score_ct: 0,
          score_t: 0,
        }),
        last,
      ],
    });
    expect(clipHudState(replay, 639)).toMatchObject({ scoreCt: 0, scoreT: 0 });
    expect(clipHudState(replay, 640)).toMatchObject({ scoreCt: 1, scoreT: 0, ctName: "Alpha" });
    expect(clipHudState(replay, 1399)).toMatchObject({ scoreCt: 1, scoreT: 0 });
    expect(clipHudState(replay, 1400)).toMatchObject({ scoreCt: 1, scoreT: 1, tName: "Bravo" });
    expect(last.score_ct).toBe(9);
  });

  it("labels overtime rounds with the MR3 period", () => {
    expect(roundHudLabel({ number: 12, is_knife: false })).toBe("R12");
    expect(roundHudLabel({ number: 0, is_knife: true })).toBe("Knife");
    expect(roundHudLabel({ number: 25, is_knife: false })).toBe("R25 · OT1");
    expect(roundHudLabel({ number: 26, is_knife: false })).toBe("R26 · OT1");
    expect(roundHudLabel({ number: 30, is_knife: false })).toBe("R30 · OT1");
    expect(roundHudLabel({ number: 31, is_knife: false })).toBe("R31 · OT2");
    const replay = makeReplay({
      rounds: [makeRound({ number: 26, start_tick: 0, freeze_end_tick: 64, end_tick: 2000 })],
    });
    expect(clipHudState(replay, 100).roundLabel).toBe("R26 · OT1");
  });

  it("counts the round clock down from 1:55 and replaces it with the 40s fuse after plant", () => {
    const live = makeRound({ number: 5, start_tick: 0, freeze_end_tick: 64, end_tick: 20000 });
    const replay = makeReplay({ rounds: [live] });
    expect(clipHudState(replay, 64).clockLabel).toBe("1:55");
    expect(clipHudState(replay, 64 + 10 * RATE).clockLabel).toBe("1:45");
    expect(clipHudState(replay, 64 + ROUND_TIME_DEFUSE_S * RATE).clockLabel).toBe("0:00");
    expect(clipHudState(replay, 64 + (ROUND_TIME_DEFUSE_S + 20) * RATE).clockLabel).toBe("0:00");

    const plant = 200;
    const planted = makeReplay({
      rounds: [live],
      bombEvents: [makeBombEvent({ tick: plant, kind: "planted" })],
    });
    const tick = plant + 10 * RATE;
    const bomb = clipHudState(planted, tick);
    expect(bomb.clockKind).toBe("bomb");
    expect(bomb.bombRemaining).toBeCloseTo(BOMB_SECONDS - 10);
    expect(bomb.clockLabel).toBe("C4 30.0");

    const begin = plant + RATE;
    const noKit = makeReplay({
      rounds: [live],
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: false }),
      ],
    });
    const defusing = clipHudState(noKit, begin + 2 * RATE);
    expect(defusing.defuse?.haskit).toBe(false);
    expect(defusing.defuse?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS - 2);
    expect(defusing.defuse?.progress).toBeCloseTo(2 / DEFUSE_WITHOUT_KIT_SECONDS);

    const withKit = makeReplay({
      rounds: [live],
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: true }),
      ],
    });
    const kit = clipHudState(withKit, begin + RATE);
    expect(kit.defuse?.haskit).toBe(true);
    expect(kit.defuse?.remaining).toBeCloseTo(DEFUSE_WITH_KIT_SECONDS - 1);
    expect(kit.defuse?.progress).toBeCloseTo(1 / DEFUSE_WITH_KIT_SECONDS);
  });

  it("lists hp, armor, money, weapon, and ammo for each side", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 100;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.health[0] = 80;
    ticks.health[1] = FULL_HEALTH;
    ticks.armor[0] = 50;
    ticks.money[0] = 1500;
    ticks.money[1] = 200;
    const ak = WEAPON_BY_ID.indexOf("ak47");
    ticks.active[1] = ak;
    ticks.clip[1] = 20;
    ticks.reserve[1] = 90;
    const replay = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 3, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
      ticks,
    });
    const state = clipHudState(replay, 100);
    expect(state.aliveLabel).toBe("1v1");
    expect(state.playersCt[0]).toMatchObject({ name: "Alice", hp: 80, armor: 50, money: "$1,500" });
    expect(state.playersT[0]).toMatchObject({
      name: "Bob",
      weapon: "AK-47",
      ammo: "20/90",
      money: "$200",
    });
  });
});

describe("paintClipHud", () => {
  it("draws the derived score, overtime label, and post-plant clock", () => {
    const layout = clipHudLayout(1920, 1080);
    expect(layout.radar.x).toBeGreaterThan(layout.tColumn.x);
    expect(layout.ctColumn.x).toBeGreaterThan(layout.radar.x);
    expect(layout.width / layout.height).toBeCloseTo(16 / 9);

    const replay = makeReplay({
      header: { map_name: "de_mirage", team_ct: "Alpha", team_t: "Bravo" },
      rounds: [
        makeRound({
          number: 26,
          winner: "CT",
          win_reason: WIN_REASON_DEFUSE,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 5000,
          score_ct: 0,
          score_t: 0,
        }),
      ],
      bombEvents: [makeBombEvent({ tick: 200, kind: "planted" })],
    });
    const ctx = createMockCanvas();
    paintClipHud(ctx, replay, 200 + 10 * RATE, layout);
    const drawn = ctx.fillText.mock.calls.map((call) => String(call[0]));
    expect(drawn).toContain("0v0");
    expect(drawn.join(" ")).toContain("Mirage · R26 · OT1 · C4 30.0");

    const won = makeReplay({
      header: { map_name: "de_mirage", team_ct: "Alpha", team_t: "Bravo" },
      rounds: [
        makeRound({
          number: 26,
          winner: "CT",
          win_reason: WIN_REASON_DEFUSE,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 640,
          score_ct: 0,
          score_t: 0,
        }),
      ],
    });
    ctx.fillText.mockClear();
    paintClipHud(ctx, won, 640, layout);
    const afterWin = ctx.fillText.mock.calls.map((call) => String(call[0]));
    expect(afterWin.join(" ")).toContain("R26 · OT1");
    expect(afterWin).toContain("CT wins · Defuse");
    expect(afterWin.some((line) => line.includes("1") && line.includes("Alpha"))).toBe(true);
  });
});
