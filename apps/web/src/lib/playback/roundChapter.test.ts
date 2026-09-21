import { describe, expect, it } from "vitest";
import {
  ECO_MAX_EQUIPMENT,
  FIRST_OVERTIME_ROUND,
  FORCE_BUY_MAX_EQUIPMENT,
  REGULATION_ROUNDS_PER_HALF,
} from "@/lib/shared/constants";
import { makeFreezeTicks, makeReplay, makeRound } from "@/lib/testing/fixtures";
import { isRegulationPistolRound, roundChapter } from "./roundChapter";

const FREEZE = 64;

function replayWithEquip(roundNumber: number, ctEquip: number, tEquip: number, knife = false) {
  const ticks = makeFreezeTicks(2, 1, FREEZE);
  ticks.equip[0] = ctEquip;
  ticks.equip[1] = tEquip;
  return makeReplay({
    ticks,
    rounds: [
      makeRound({
        number: roundNumber,
        is_knife: knife,
        freeze_end_tick: FREEZE,
      }),
    ],
  });
}

describe("isRegulationPistolRound", () => {
  it("is only the opening round of each regulation half", () => {
    expect(isRegulationPistolRound(1)).toBe(true);
    expect(isRegulationPistolRound(REGULATION_ROUNDS_PER_HALF + 1)).toBe(true);
    expect(isRegulationPistolRound(2)).toBe(false);
    expect(isRegulationPistolRound(FIRST_OVERTIME_ROUND)).toBe(false);
  });
});

describe("roundChapter", () => {
  it("marks knife rounds before equipment", () => {
    const replay = replayWithEquip(0, 0, 0, true);
    expect(roundChapter(replay, replay.rounds[0])).toBe("knife");
  });

  it("marks regulation pistols even when equipment looks like an eco", () => {
    const first = replayWithEquip(1, 800, 800);
    const second = replayWithEquip(REGULATION_ROUNDS_PER_HALF + 1, 5000, 5000);
    expect(roundChapter(first, first.rounds[0])).toBe("pistol");
    expect(roundChapter(second, second.rounds[0])).toBe("pistol");
  });

  it("does not treat an overtime block start as a pistol", () => {
    const replay = makeReplay({
      rounds: [makeRound({ number: FIRST_OVERTIME_ROUND, freeze_end_tick: FREEZE })],
    });
    expect(roundChapter(replay, replay.rounds[0])).toBe("overtime");
  });

  it("labels the poorer side under the eco cap as eco", () => {
    const replay = replayWithEquip(4, FORCE_BUY_MAX_EQUIPMENT, ECO_MAX_EQUIPMENT - 1);
    expect(roundChapter(replay, replay.rounds[0])).toBe("eco");
  });

  it("labels a poorer side between the eco and force caps as force", () => {
    const replay = replayWithEquip(4, 5000, ECO_MAX_EQUIPMENT);
    expect(roundChapter(replay, replay.rounds[0])).toBe("force");
  });

  it("labels both sides at the force cap as a full buy", () => {
    const replay = replayWithEquip(5, FORCE_BUY_MAX_EQUIPMENT, FORCE_BUY_MAX_EQUIPMENT + 400);
    expect(roundChapter(replay, replay.rounds[0])).toBe("full");
  });

  it("labels an overtime full buy as overtime and keeps an overtime eco", () => {
    const full = replayWithEquip(FIRST_OVERTIME_ROUND, 5000, 5000);
    const eco = replayWithEquip(FIRST_OVERTIME_ROUND + 1, 4500, 600);
    expect(roundChapter(full, full.rounds[0])).toBe("overtime");
    expect(roundChapter(eco, eco.rounds[0])).toBe("eco");
  });

  it("uses the only side present at freeze", () => {
    const ticks = makeFreezeTicks(1, 1, FREEZE);
    ticks.equip[0] = ECO_MAX_EQUIPMENT;
    const replay = makeReplay({
      ticks,
      rounds: [makeRound({ number: 6, freeze_end_tick: FREEZE })],
    });
    expect(roundChapter(replay, replay.rounds[0])).toBe("force");
  });

  it("leaves a regulation round blank when freeze equipment is missing", () => {
    const replay = makeReplay({
      rounds: [makeRound({ number: 4, freeze_end_tick: FREEZE })],
    });
    expect(roundChapter(replay, replay.rounds[0])).toBeNull();
  });
});
