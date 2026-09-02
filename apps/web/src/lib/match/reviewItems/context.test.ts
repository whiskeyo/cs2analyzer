import { describe, expect, it } from "vitest";
import {
  makeFreezeTicks,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
} from "@/lib/testing/fixtures";
import { deathContext, deathNote, roundContext } from "./context";

describe("roundContext", () => {
  it("skips knife rounds and rounds whose freeze is still in the future", () => {
    const knife = makeRound({ number: 0, is_knife: true, freeze_end_tick: 10, end_tick: 50 });
    const live = makeRound({ number: 1, start_tick: 50, freeze_end_tick: 100, end_tick: 800 });
    const m = makeReplay({ rounds: [knife, live], kills: [makeKill(200, 0, 1)] });
    expect(roundContext(m, 0, 800, knife)).toBeNull();
    expect(roundContext(m, 0, 80, live)).toBeNull();
  });

  it("fills first enemy kill, deaths, side, and team-lost from the round", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 3, winner: "T" })],
      kills: [makeKill(80, 1, 0), makeKill(200, 0, 1)],
    });
    const ctx = roundContext(m, 0, 640, m.rounds[0]);
    expect(ctx).not.toBeNull();
    expect(ctx!.first).toEqual(m.kills[0]);
    expect(ctx!.myDeaths).toEqual([m.kills[0]]);
    expect(ctx!.side).toBe("CT");
    expect(ctx!.teamLost).toBe(true);
    expect(ctx!.completed).toBe(true);
    expect(ctx!.playerName(1)).toBe("Bob");
    expect(ctx!.playerName(-1)).toBe("World");
  });

  it("treats a still-running round as incomplete and not lost", () => {
    const m = makeReplay({
      rounds: [makeRound({ number: 1, winner: "T", end_tick: 640 })],
      kills: [makeKill(100, 1, 0)],
    });
    const ctx = roundContext(m, 0, 200, m.rounds[0]);
    expect(ctx!.completed).toBe(false);
    expect(ctx!.teamLost).toBe(false);
    expect(ctx!.roundKills).toEqual([m.kills[0]]);
  });
});

describe("deathContext", () => {
  it("marks an opening death when the first enemy kill is the player", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "CT", "C"), makePlayer(2, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      ticks: makeFreezeTicks(3, 2),
      kills: [makeKill(100, 2, 0)],
    });
    const ctx = roundContext(m, 0, 640, m.rounds[0])!;
    const death = deathContext(ctx, ctx.myDeaths[0]);
    expect(death.openingDeath).toBe(true);
    expect(death.clutchDeath).toBe(false);
    expect(death.pre).toBe(Math.max(64, 100 - 8));
  });

  it("marks a clutch death when no teammate is alive", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "B")],
      rounds: [makeRound({ number: 1, winner: "T" })],
      ticks: makeFreezeTicks(2, 1),
      kills: [makeKill(200, 1, 0)],
    });
    const ctx = roundContext(m, 0, 640, m.rounds[0])!;
    const death = deathContext(ctx, ctx.myDeaths[0]);
    expect(death.clutchDeath).toBe(true);
    expect(death.enemies).toBe(1);
    expect(death.openingDeath).toBe(true);
  });
});

describe("deathNote", () => {
  it("titles opening, clutch, and regular deaths and joins detail bits", () => {
    const m = makeReplay({
      players: [makePlayer(0, "CT", "A"), makePlayer(1, "T", "Bob")],
      rounds: [makeRound({ number: 4, winner: "T" })],
      ticks: makeFreezeTicks(2, 1),
      kills: [makeKill(200, 1, 0, { weapon: "ak47", headshot: true })],
    });
    const ctx = roundContext(m, 0, 640, m.rounds[0])!;
    const opening = deathContext(ctx, ctx.myDeaths[0]);
    expect(deathNote(opening, { bits: ["opening death"], severity: "high" })).toMatchObject({
      tick: 200,
      roundLabel: "R4",
      title: "Lost the opening to Bob",
      detail: "AK-47 HS · opening death",
      severity: "high",
      kind: "opening",
    });

    const clutchOnly = { ...opening, openingDeath: false, clutchDeath: true, enemies: 2 };
    expect(deathNote(clutchOnly, { bits: ["lost 1v2"], severity: "high" }).title).toBe(
      "Lost a 1v2 to Bob",
    );
    expect(deathNote(clutchOnly, { bits: [], severity: "high" }).kind).toBe("clutch");

    const regular = { ...opening, openingDeath: false, clutchDeath: false };
    expect(deathNote(regular, { bits: ["untraded"], severity: "mid" })).toMatchObject({
      title: "Died to Bob",
      kind: "death",
      detail: "AK-47 HS · untraded",
    });
  });
});
