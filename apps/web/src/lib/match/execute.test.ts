import { describe, expect, it } from "vitest";
import { filterExecutes, findExecutes, nextExecuteTick } from "./execute";
import type { GrenadeThrow, Round } from "@/lib/replay/replayTypes";
import {
  makeBombEvent,
  makeCallout,
  makeGrenade,
  makeKill,
  makePlaces,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";

/** Executes need a long round: beats land well after the default 640. */
function round(partial: Partial<Round> & Pick<Round, "number" | "winner">): Round {
  return makeRound({ end_tick: 2000, win_reason: 1, ...partial });
}

/** Throw that detonates at `tick`, optionally landing at (x, y). */
function nade(
  tick: number,
  thrower: number,
  kind: GrenadeThrow["kind"],
  x?: number,
  y?: number,
): GrenadeThrow {
  return makeGrenade({
    thrower,
    kind,
    start_tick: tick - 32,
    detonate_tick: tick,
    end_tick: tick + 64,
    points: x == null || y == null ? [] : [{ tick, x, y, z: 0 }],
  });
}

const roster = [
  makePlayer(0, "T", "T1"),
  makePlayer(1, "T", "T2"),
  makePlayer(2, "T", "T3"),
  makePlayer(3, "CT", "CT1"),
  makePlayer(4, "CT", "CT2"),
];

const layoutPlaces = makePlaces([
  makeCallout("a", "A Site", 0, 0, 100, 100),
  makeCallout("palace", "Palace", 120, 0, 60, 60),
  makeCallout("b", "B Site", 800, 800, 100, 100),
]);

describe("findExecutes", () => {
  it("omits A/B when the map has no layout", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [nade(200, 0, "smoke", 50, 974), nade(220, 1, "smoke", 60, 970)],
    });
    const beats = findExecutes(m);
    expect(beats).toHaveLength(1);
    expect(beats[0].site).toBeNull();
    expect(beats[0].title).not.toMatch(/\bA\b/);
  });

  it("labels an A-site dump from grenade landings", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [nade(200, 0, "smoke", 50, 974), nade(220, 1, "smoke", 60, 970)],
    });
    const beats = findExecutes(m, layoutPlaces);
    expect(beats).toHaveLength(1);
    expect(beats[0].site).toBe("A");
    expect(beats[0].title).toMatch(/A/);
  });

  it("treats Palace landings as an A execute", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [nade(200, 0, "smoke", 150, 994), nade(220, 1, "smoke", 140, 990)],
    });
    const beats = findExecutes(m, layoutPlaces);
    expect(beats).toHaveLength(1);
    expect(beats[0].site).toBe("A");
    expect(beats[0].location).toBe("Palace");
    expect(beats[0].title).toMatch(/Palace/);
  });

  it("labels a plant from layout, not as Mid", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      bombEvents: [makeBombEvent({ tick: 400, kind: "planted", x: 50, y: 974, z: 80 })],
    });
    const unlabeled = findExecutes(m).find((b) => b.kind === "plant");
    expect(unlabeled?.site).toBeNull();
    expect(unlabeled?.title).not.toMatch(/\bA\b/);
    const plant = findExecutes(m, layoutPlaces).find((b) => b.kind === "plant");
    expect(plant?.site).toBe("A");
    expect(plant?.title).toMatch(/A/);
  });

  it("treats a T smoke dump as an execute", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [nade(200, 0, "smoke"), nade(220, 1, "smoke"), nade(240, 2, "molotov")],
    });
    const beats = findExecutes(m);
    expect(beats).toHaveLength(1);
    expect(beats[0].kind).toBe("execute");
    expect(beats[0].side).toBe("T");
    expect(beats[0].tick).toBeLessThan(200);
  });

  it("ignores a lonely opening duel", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [makeKill(120, 0, 3)],
    });
    expect(findExecutes(m)).toEqual([]);
  });

  it("ignores a 2k opening", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      kills: [makeKill(120, 0, 3), makeKill(180, 1, 4)],
    });
    expect(findExecutes(m)).toEqual([]);
  });

  it("keeps a 3k burst as a fight", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      kills: [makeKill(300, 0, 3), makeKill(320, 1, 4), makeKill(340, 0, 4)],
    });
    const beats = findExecutes(m);
    expect(beats.some((b) => b.kind === "fight")).toBe(true);
  });

  it("marks a plant and a later CT util dump as a retake", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      grenades: [
        nade(200, 0, "smoke"),
        nade(210, 1, "smoke"),
        nade(900, 3, "smoke"),
        nade(920, 4, "molotov"),
      ],
      bombEvents: [makeBombEvent({ tick: 400, kind: "planted" })],
    });
    const beats = findExecutes(m);
    expect(beats.some((b) => b.kind === "execute" && b.side === "T")).toBe(true);
    expect(beats.some((b) => b.kind === "retake")).toBe(true);
  });

  it("nextExecuteTick walks forward and back", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [nade(200, 0, "smoke"), nade(220, 1, "smoke")],
      bombEvents: [makeBombEvent({ tick: 1100, kind: "planted" })],
    });
    const beats = findExecutes(m);
    expect(beats.length).toBeGreaterThanOrEqual(2);
    expect(nextExecuteTick(beats, beats[0].tick, 1)).toBe(beats[1].tick);
    expect(nextExecuteTick(beats, beats[1].tick, -1)).toBe(beats[0].tick);
  });

  it("ignores CT smokes on opposite sides of the map", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      grenades: [nade(200, 3, "smoke", 0, 0), nade(220, 4, "smoke", 3200, 0)],
    });
    expect(findExecutes(m)).toEqual([]);
  });

  it("ignores T smokes that land on opposite bombsites", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [nade(200, 0, "smoke", 0, 0), nade(220, 1, "smoke", 0, 3200)],
    });
    expect(findExecutes(m)).toEqual([]);
  });

  it("still treats clustered T smokes as an execute", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [
        nade(200, 0, "smoke", 0, 0),
        nade(220, 1, "smoke", 400, 80),
        nade(240, 2, "molotov", 180, 40),
      ],
    });
    const beats = findExecutes(m);
    expect(beats).toHaveLength(1);
    expect(beats[0].kind).toBe("execute");
    expect(beats[0].side).toBe("T");
  });

  it("labels util and kills per side instead of summing both teams", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [
        nade(200, 0, "smoke"),
        nade(210, 1, "smoke"),
        nade(220, 2, "molotov"),
        nade(230, 3, "smoke"),
        nade(240, 4, "molotov"),
        nade(250, 3, "flash"),
        nade(260, 4, "he"),
      ],
      kills: [makeKill(230, 0, 3), makeKill(250, 1, 4)],
    });
    const beats = findExecutes(m);
    expect(beats).toHaveLength(1);
    expect(beats[0].detail).toMatch(/T .*2 smokes/);
    expect(beats[0].detail).toMatch(/T .*2k/);
    expect(beats[0].detail).toMatch(/CT .*1 smoke/);
    expect(beats[0].detail).toMatch(/CT .*2 util/);
    expect(beats[0].detail).not.toMatch(/7 smoke/);
    expect(beats[0].detail).not.toMatch(/(^|· )4k( ·|$)/);
  });

  it("does not call a CT default dump a take", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      grenades: [nade(200, 3, "smoke", 0, 0), nade(220, 4, "smoke", 300, 40)],
    });
    expect(findExecutes(m)).toEqual([]);
  });

  it("filterExecutes keeps a plant and drops T executes", () => {
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "CT" })],
      grenades: [nade(200, 0, "smoke"), nade(220, 1, "smoke")],
      bombEvents: [makeBombEvent({ tick: 1100, kind: "planted" })],
    });
    const beats = findExecutes(m);
    expect(filterExecutes(beats, { kinds: ["plant"] }).every((b) => b.kind === "plant")).toBe(true);
    expect(filterExecutes(beats, { side: "CT" }).every((b) => b.side === "CT")).toBe(true);
  });

  it("filters executes by layout group name", () => {
    const grouped = makePlaces([
      { ...makeCallout("a", "A Site", 0, 0, 100, 100), group: "A side" },
      { ...makeCallout("palace", "Palace", 120, 0, 60, 60), group: "A side" },
      { ...makeCallout("b", "B Site", 800, 800, 100, 100), group: "B side" },
    ]);
    const m = makeReplay({
      players: roster,
      rounds: [round({ number: 1, winner: "T" })],
      grenades: [nade(200, 0, "smoke", 150, 994), nade(220, 1, "smoke", 140, 990)],
    });
    const beats = findExecutes(m, grouped);
    expect(beats[0]?.location).toBe("Palace");
    expect(
      filterExecutes(beats, { group: "A side", layout: grouped.layout }).map((b) => b.location),
    ).toEqual(["Palace"]);
    expect(filterExecutes(beats, { group: "B side", layout: grouped.layout })).toEqual([]);
  });
});
