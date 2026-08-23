import { describe, expect, it } from "vitest";
import { blindsAt, firesAt, HIT_SECONDS, hitsAt, lingerRemaining } from "./radarFx";

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
