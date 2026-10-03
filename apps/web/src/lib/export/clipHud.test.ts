import { describe, expect, it } from "vitest";
import { clipHudLayout, clipHudState, paintClipHud } from "@/lib/export/clipHud";
import { createMockCanvas } from "@/lib/testing/mockCanvas";
import {
  makeBombEvent,
  makeKill,
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
  KILL_FEED_SECONDS,
  ROUND_TIME_DEFUSE_S,
  WIN_REASON_DEFUSE,
} from "@/lib/shared/constants";
import { roundHudLabel } from "@/lib/stats/hud";
import { FLAG_ALIVE, FLAG_CT, FLAG_DEFUSING, FLAG_PRESENT } from "@/lib/replay/replayTypes";
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

    const wingman = makeRound({
      number: 5,
      start_tick: 0,
      freeze_end_tick: 64,
      end_tick: 20000,
      round_time_s: 90,
    });
    const short = makeReplay({ rounds: [wingman] });
    expect(clipHudState(short, 64).clockLabel).toBe("1:30");
    expect(clipHudState(short, 64 + 10 * RATE).clockLabel).toBe("1:20");

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
    const holdUntil = begin + 2 * RATE;
    const holding = makeTicks(2, 2);
    holding.ticks[0] = begin;
    holding.ticks[1] = holdUntil;
    for (let frame = 0; frame < 2; frame++) {
      holding.flags[frame * 2] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT | FLAG_DEFUSING;
      holding.flags[frame * 2 + 1] = FLAG_PRESENT | FLAG_ALIVE;
    }
    const noKit = makeReplay({
      rounds: [live],
      ticks: holding,
      bombEvents: [
        makeBombEvent({ tick: plant, kind: "planted" }),
        makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: false }),
      ],
    });
    const defusing = clipHudState(noKit, holdUntil);
    expect(defusing.defuse?.haskit).toBe(false);
    expect(defusing.defuse?.remaining).toBeCloseTo(DEFUSE_WITHOUT_KIT_SECONDS - 2);
    expect(defusing.defuse?.progress).toBeCloseTo(2 / DEFUSE_WITHOUT_KIT_SECONDS);

    const withKit = makeReplay({
      rounds: [live],
      ticks: holding,
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

  it("keeps the 40s C4 clock running unchanged through a fake defuse", () => {
    const plant = 64 + 20 * RATE;
    const live = makeRound({
      number: 5,
      start_tick: 0,
      freeze_end_tick: 64,
      end_tick: 20000,
      round_time_s: 90,
    });
    const fallback = makeReplay({
      rounds: [makeRound({ number: 5, start_tick: 0, freeze_end_tick: 64, end_tick: 20000 })],
    });
    expect(clipHudState(fallback, 64)).toMatchObject({ clockKind: "round", clockLabel: "1:55" });

    const beforePlant = makeReplay({ rounds: [live] });
    expect(clipHudState(beforePlant, 64)).toMatchObject({ clockKind: "round", clockLabel: "1:30" });

    const seen = plant + 10 * RATE;
    const fuseAt = (tick: number) => BOMB_SECONDS - (tick - plant) / RATE;
    function ctFrames(frames: { tick: number; defusing: boolean }[]) {
      const playerCount = 2;
      const buf = makeTicks(playerCount, frames.length);
      frames.forEach((frame, index) => {
        buf.ticks[index] = frame.tick;
        for (let player = 0; player < playerCount; player++) {
          let flags = FLAG_PRESENT | FLAG_ALIVE;
          if (player === 0) flags |= FLAG_CT;
          if (frame.defusing && player === 0) flags |= FLAG_DEFUSING;
          buf.flags[index * playerCount + player] = flags;
        }
      });
      return buf;
    }

    const stillHolding = ctFrames([
      { tick: 64, defusing: false },
      { tick: plant, defusing: false },
      { tick: seen, defusing: true },
    ]);
    const planted = makeBombEvent({ tick: plant, kind: "planted" });
    const clean = makeReplay({
      rounds: [live],
      ticks: stillHolding,
      bombEvents: [planted],
    });
    const begin = plant + RATE;
    const aborted = makeReplay({
      rounds: [live],
      ticks: stillHolding,
      bombEvents: [
        planted,
        makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: false, player: 0 }),
        makeBombEvent({ tick: begin + 1, kind: "abort_defuse", player: 0 }),
      ],
    });
    const during = clipHudState(aborted, begin);
    const afterAbort = clipHudState(aborted, seen);
    const cleanAtSeen = clipHudState(clean, seen);
    expect(during.defuse).not.toBeNull();
    expect(during.clockKind).toBe("bomb");
    expect(during.bombRemaining).toBeCloseTo(fuseAt(begin));
    expect(during.clockLabel).toBe("C4 39.0");
    expect(afterAbort.defuse).toBeNull();
    expect(afterAbort.clockKind).toBe("bomb");
    expect(afterAbort.clockLabel).toBe("C4 30.0");
    expect(afterAbort.bombRemaining).toBeCloseTo(fuseAt(seen));
    expect(afterAbort.bombRemaining).toBeCloseTo(cleanAtSeen.bombRemaining ?? -1);
    expect(afterAbort.clockLabel).toBe(cleanAtSeen.clockLabel);
    const later = clipHudState(aborted, seen + 5 * RATE);
    expect(later.clockKind).toBe("bomb");
    expect(later.clockLabel).toBe("C4 25.0");
    expect(later.bombRemaining).toBeCloseTo(fuseAt(seen + 5 * RATE));

    const stride = 8;
    const slack = stride * 2;
    const dropped = makeReplay({
      header: { tick_stride: stride },
      rounds: [live],
      ticks: ctFrames([
        { tick: 64, defusing: false },
        { tick: begin, defusing: true },
        { tick: begin + slack, defusing: false },
        { tick: seen, defusing: false },
      ]),
      bombEvents: [
        planted,
        makeBombEvent({ tick: begin, kind: "begin_defuse", haskit: false, player: 0 }),
      ],
    });
    const afterDrop = clipHudState(dropped, seen);
    expect(afterDrop.defuse).toBeNull();
    expect(afterDrop.clockKind).toBe("bomb");
    expect(afterDrop.clockLabel).toBe("C4 30.0");
    expect(afterDrop.bombRemaining).toBeCloseTo(cleanAtSeen.bombRemaining ?? -1);

    const defusedAt = plant + 15 * RATE;
    const nextStart = 22000;
    const nextFreeze = nextStart + 2 * RATE;
    const nextRound = makeRound({
      number: 6,
      start_tick: nextStart,
      freeze_end_tick: nextFreeze,
      end_tick: 40000,
      round_time_s: 90,
    });
    const defusedReplay = makeReplay({
      rounds: [live, nextRound],
      ticks: stillHolding,
      bombEvents: [planted, makeBombEvent({ tick: defusedAt, kind: "defused", player: 0 })],
    });
    const defused = clipHudState(defusedReplay, defusedAt);
    const defusedLater = clipHudState(defusedReplay, defusedAt + 20 * RATE);
    expect(defused.bombRemaining).toBeNull();
    expect(defused.clockKind).toBe("bomb");
    expect(defused.clockLabel).toBe("C4 25.0");
    expect(defusedLater.clockKind).toBe("bomb");
    expect(defusedLater.clockLabel).toBe("C4 25.0");
    expect(clipHudState(defusedReplay, nextStart).clockLabel).toMatch(/^Freeze /);
    expect(clipHudState(defusedReplay, nextFreeze)).toMatchObject({
      clockKind: "round",
      clockLabel: "1:30",
    });
    expect(clipHudState(defusedReplay, nextFreeze + 10 * RATE).clockLabel).toBe("1:20");

    const explodedAt = plant + 15 * RATE;
    const explodedReplay = makeReplay({
      rounds: [live, nextRound],
      ticks: stillHolding,
      bombEvents: [planted, makeBombEvent({ tick: explodedAt, kind: "exploded" })],
    });
    const exploded = clipHudState(explodedReplay, explodedAt);
    const explodedLater = clipHudState(explodedReplay, explodedAt + 20 * RATE);
    expect(exploded.bombRemaining).toBeNull();
    expect(exploded.clockKind).toBe("bomb");
    expect(exploded.clockLabel).toBe("C4 0.0");
    expect(explodedLater.clockKind).toBe("bomb");
    expect(explodedLater.clockLabel).toBe("C4 0.0");
    expect(clipHudState(explodedReplay, nextFreeze)).toMatchObject({
      clockKind: "round",
      clockLabel: "1:30",
    });
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
  it("draws a dead player as a dimmed name and money only", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 100;
    ticks.flags[0] = FLAG_PRESENT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.health[1] = FULL_HEALTH;
    ticks.armor[0] = 100;
    ticks.armor[1] = 50;
    ticks.money[0] = 800;
    ticks.money[1] = 1500;
    const ak = WEAPON_BY_ID.indexOf("ak47");
    ticks.active[0] = ak;
    ticks.clip[0] = 12;
    ticks.reserve[0] = 90;
    ticks.active[1] = ak;
    ticks.clip[1] = 20;
    ticks.reserve[1] = 90;
    const replay = makeReplay({
      players: [makePlayer(0, "T", "Dead Bob"), makePlayer(1, "CT", "Alice")],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 4000 })],
      ticks,
    });
    const ctx = createMockCanvas();
    const styles: string[] = [];
    ctx.fillText.mockImplementation((text: string) => {
      styles.push(`${ctx.fillStyle}:${text}`);
    });
    paintClipHud(ctx, replay, 100, clipHudLayout(1920, 1080));
    const deadName = styles.find((line) => line.endsWith(":Dead Bob"));
    const deadMoney = styles.find((line) => line.endsWith(":$800"));
    expect(deadName).toBe("#5c6770:Dead Bob");
    expect(deadMoney).toBe("#5c6770:$800");
    expect(styles.filter((line) => line.includes("AK-47"))).toEqual([
      expect.stringContaining("20/90"),
    ]);
    expect(styles.some((line) => line.includes("100 armor"))).toBe(false);
    expect(styles.some((line) => line.includes("50 armor"))).toBe(true);
  });

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

  it("draws the kill feed, including the assister, until the row expires", () => {
    const killAt = 1000;
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "Alice"),
        makePlayer(1, "T", "Bob"),
        makePlayer(2, "T", "Cara"),
      ],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 8000 })],
      kills: [makeKill(killAt, 0, 1, { assister: 2, assisted_flash: true, weapon: "ak47" })],
    });
    const ctx = createMockCanvas();
    paintClipHud(ctx, replay, killAt, clipHudLayout(1920, 1080));
    const drawn = ctx.fillText.mock.calls.map((call) => String(call[0]));
    expect(drawn).toContain("Alice");
    expect(drawn).toContain(" + ");
    expect(drawn).toContain("Cara");
    expect(drawn).toContain("Bob");
    expect(drawn.some((line) => line.includes("AK-47"))).toBe(true);

    ctx.fillText.mockClear();
    paintClipHud(ctx, replay, killAt + (KILL_FEED_SECONDS + 1) * RATE, clipHudLayout(1920, 1080));
    const later = ctx.fillText.mock.calls.map((call) => String(call[0]));
    expect(later).not.toContain("Cara");
    expect(later).not.toContain(" + ");
  });

  it("draws the newest kill above the older ones", () => {
    const names = ["Nova", "Mia", "Leo", "Kai", "Eve"];
    const replay = makeReplay({
      players: [
        makePlayer(0, "CT", "Ace"),
        ...names.map((name, i) => makePlayer(i + 1, "T", name)),
      ],
      rounds: [makeRound({ number: 1, start_tick: 0, freeze_end_tick: 64, end_tick: 8000 })],
      kills: names.map((_, i) => makeKill(1000 + i * RATE, 0, i + 1)),
    });
    const ctx = createMockCanvas();
    paintClipHud(ctx, replay, 1000 + (names.length - 1) * RATE, clipHudLayout(1920, 1080));
    const yOf = (name: string) => {
      const call = ctx.fillText.mock.calls.find((args) => args[0] === name);
      return typeof call?.[2] === "number" ? call[2] : Number.POSITIVE_INFINITY;
    };
    expect(yOf("Eve")).toBeLessThan(yOf("Kai"));
    expect(yOf("Kai")).toBeLessThan(yOf("Leo"));
    expect(yOf("Leo")).toBeLessThan(yOf("Mia"));
    expect(yOf("Mia")).toBeLessThan(yOf("Nova"));
  });
});
