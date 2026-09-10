import { describe, expect, it } from "vitest";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT, type ControllerDump } from "@/lib/replay/replayTypes";
import { BOT_STEAM_ID_BASE } from "@/lib/shared/constants";
import {
  makeBlind,
  makeKill,
  makePlayer,
  makeReplay,
  makeRound,
  makeTicks,
} from "@/lib/testing/fixtures";
import { parseDump } from "./parseDump";

describe("parseDump", () => {
  it("counts overlay-band blinds and present steams at the last tick", () => {
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 100;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Bob")],
      ticks,
      blinds: [makeBlind(100, 0, 1, 5.0), makeBlind(100, 0, 0, 1.2)],
    });
    const dump = parseDump(m);
    expect(dump.blinds).toBe(2);
    expect(dump.overlayBlinds).toBe(1);
    expect(dump.overlayDurations).toEqual(["5.00"]);
    expect(dump.presentAtEnd.map((p) => p.name)).toEqual(["Alice", "Bob"]);
    expect(dump.botCount).toBe(0);
    expect(dump.worldKills).toBe(0);
  });

  it("lists Faceit-style bot fills and World frags for the next re-drop paste", () => {
    const botSteam = BOT_STEAM_ID_BASE + 7;
    const ticks = makeTicks(2, 1);
    ticks.ticks[0] = 64;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    const m = makeReplay({
      players: [makePlayer(0, "CT", "Alice"), makePlayer(1, "T", "Mike", botSteam, true)],
      ticks,
      rounds: [makeRound({ number: 12, start_tick: 0, freeze_end_tick: 64, end_tick: 640 })],
      kills: [makeKill(80, -1, 0, { weapon: "world" }), makeKill(90, 1, 0)],
    });
    const dump = parseDump(m);
    expect(dump.botCount).toBe(1);
    expect(dump.botIds).toEqual([botSteam]);
    expect(dump.players[1]).toMatchObject({ name: "Mike", is_bot: true, steam: botSteam });
    expect(dump.worldKills).toBe(1);
    expect(dump.worldKillTicks).toEqual([80]);
    expect(dump.rounds.find((r) => r.n === 12)?.present.map((p) => p.name)).toEqual([
      "Alice",
      "Mike (BOT)",
    ]);
  });

  it("splits last-slot controllers from freeze-end fill candidates", () => {
    const botSteam = BOT_STEAM_ID_BASE + 7;
    const last: ControllerDump = {
      tick: 2000,
      slot: 7,
      name: "Mike",
      steam: 0,
      is_bot: false,
      connected: 0,
      has_team_pawn: true,
      assigned: botSteam,
      at_freeze: false,
    };
    const freeze: ControllerDump = { ...last, tick: 64, at_freeze: true };
    const leftover: ControllerDump = {
      tick: 64,
      slot: 5,
      name: "KatolikCOO",
      steam: 100,
      is_bot: false,
      connected: 1,
      has_team_pawn: true,
      assigned: 0,
      at_freeze: false,
    };
    const dump = parseDump(
      makeReplay({
        controllerDump: [leftover, last, freeze],
      }),
    );
    expect(dump.controllers).toEqual([
      {
        tick: 64,
        slot: 5,
        name: "KatolikCOO",
        steam: 100,
        isBot: false,
        connected: 1,
        pawn: true,
        assigned: 0,
      },
      {
        tick: 2000,
        slot: 7,
        name: "Mike",
        steam: 0,
        isBot: false,
        connected: 0,
        pawn: true,
        assigned: botSteam,
      },
    ]);
    expect(dump.fillFreeze).toEqual([
      {
        tick: 64,
        slot: 7,
        name: "Mike",
        steam: 0,
        isBot: false,
        connected: 0,
        pawn: true,
        assigned: botSteam,
      },
    ]);
  });
});
