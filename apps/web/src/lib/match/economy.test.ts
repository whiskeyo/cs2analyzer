import { describe, expect, it } from "vitest";
import {
  ECO_MAX_EQUIPMENT,
  FORCE_BUY_MAX_EQUIPMENT,
  OVERTIME_START_MONEY,
} from "@/lib/shared/constants";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT, type Side } from "@/lib/replay/replayTypes";
import { makePlayer, makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import {
  bySide,
  formatBuyRecord,
  formatBuyWinRate,
  matchEconomy,
  roundTeamName,
  spendBuy,
} from "./economy";

describe("spendBuy", () => {
  it("uses the shared eco and force equipment cutoffs", () => {
    expect(spendBuy(ECO_MAX_EQUIPMENT - 1)).toBe("eco");
    expect(spendBuy(ECO_MAX_EQUIPMENT)).toBe("force");
    expect(spendBuy(FORCE_BUY_MAX_EQUIPMENT - 1)).toBe("force");
    expect(spendBuy(FORCE_BUY_MAX_EQUIPMENT)).toBe("full");
  });
});

describe("bySide", () => {
  it("reads the field for the given side", () => {
    const pair = { ct: "ct-value", t: "t-value" };
    expect(bySide(pair, "CT")).toBe("ct-value");
    expect(bySide(pair, "T")).toBe("t-value");
  });
});

describe("formatBuyWinRate", () => {
  it("rounds wins over rounds to a percent", () => {
    expect(formatBuyRecord(1, 3)).toBe("1/3");
    expect(formatBuyWinRate(1, 3)).toBe("33%");
    expect(formatBuyWinRate(2, 3)).toBe("67%");
    expect(formatBuyWinRate(0, 0)).toBe("—");
  });
});

interface Spec {
  number: number;
  winner: Side | null;
  ctEquip: number;
  tEquip: number;
  team_ct?: string;
  team_t?: string;
  is_knife?: boolean;
  present?: boolean;
}

function economyReplay(specs: Spec[]) {
  const players = [makePlayer(0, "CT", "C"), makePlayer(1, "T", "T")];
  const ticks = makeTicks(2, specs.length);
  const rounds = specs.map((spec, index) => {
    const start = index * 1000;
    const freeze = start + 64;
    ticks.ticks[index] = freeze;
    const base = index * 2;
    if (spec.present !== false) {
      ticks.flags[base] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
      ticks.flags[base + 1] = FLAG_PRESENT | FLAG_ALIVE;
      ticks.equip[base] = spec.ctEquip;
      ticks.equip[base + 1] = spec.tEquip;
    }
    return makeRound({
      number: spec.number,
      winner: spec.winner,
      start_tick: start,
      freeze_end_tick: freeze,
      end_tick: start + 800,
      is_knife: spec.is_knife ?? false,
      team_ct: spec.team_ct,
      team_t: spec.team_t,
    });
  });
  return makeReplay({
    header: { team_ct: "Astralis", team_t: "Vitality" },
    players,
    rounds,
    ticks,
  });
}

describe("matchEconomy", () => {
  it("skips knife rounds and labels regulation pistols", () => {
    const economy = matchEconomy(
      economyReplay([
        { number: 0, winner: "T", ctEquip: 0, tEquip: 0, is_knife: true },
        { number: 1, winner: "CT", ctEquip: 800, tEquip: 800 },
        {
          number: 13,
          winner: "T",
          ctEquip: 800,
          tEquip: 800,
          team_ct: "Vitality",
          team_t: "Astralis",
        },
      ]),
    );
    expect(economy.rounds.map((round) => round.round)).toEqual([1, 13]);
    expect(economy.rounds[0]?.ct.buy).toBe("pistol");
    expect(economy.rounds[0]?.t.buy).toBe("pistol");
    expect(economy.rounds[1]?.ct.buy).toBe("pistol");
    expect(economy.rows[0]?.cells[1]?.breakBefore).toBe(true);
  });

  it("marks a force or full buy against an eco as anti-eco", () => {
    const economy = matchEconomy(
      economyReplay([
        {
          number: 4,
          winner: "CT",
          ctEquip: FORCE_BUY_MAX_EQUIPMENT,
          tEquip: ECO_MAX_EQUIPMENT - 1,
        },
        { number: 5, winner: "T", ctEquip: 2500, tEquip: 1000 },
        { number: 6, winner: "CT", ctEquip: 1000, tEquip: 1000 },
        { number: 7, winner: "T", ctEquip: 5000, tEquip: 4200 },
      ]),
    );
    expect(economy.rounds.map((round) => [round.ct.buy, round.t.buy])).toEqual([
      ["anti-eco", "eco"],
      ["anti-eco", "eco"],
      ["eco", "eco"],
      ["full", "full"],
    ]);
  });

  it("keeps overtime on equipment bands instead of pistol", () => {
    const economy = matchEconomy(
      economyReplay([
        {
          number: 25,
          winner: "CT",
          ctEquip: OVERTIME_START_MONEY,
          tEquip: OVERTIME_START_MONEY,
        },
        { number: 26, winner: "T", ctEquip: 800, tEquip: 5000 },
      ]),
    );
    expect(economy.rounds[0]?.ct.buy).toBe("full");
    expect(economy.rounds[0]?.t.buy).toBe("full");
    expect(economy.rounds[1]?.ct.buy).toBe("eco");
    expect(economy.rounds[1]?.t.buy).toBe("anti-eco");
    expect(economy.rows[0]?.cells[0]?.breakBefore).toBe(false);
    expect(economy.rows[0]?.cells[1]?.breakBefore).toBe(false);
  });

  it("opens a gap at the overtime side swap", () => {
    const economy = matchEconomy(
      economyReplay([
        { number: 24, winner: "CT", ctEquip: 4500, tEquip: 4500 },
        { number: 25, winner: "T", ctEquip: 4500, tEquip: 4500 },
        { number: 27, winner: "CT", ctEquip: 4500, tEquip: 4500 },
        { number: 28, winner: "T", ctEquip: 4500, tEquip: 4500 },
      ]),
    );
    const breaks = economy.rows[0]?.cells.map((cell) => cell.breakBefore);
    expect(breaks).toEqual([false, true, false, true]);
  });

  it("tracks each team's win rate across a side swap", () => {
    const economy = matchEconomy(
      economyReplay([
        {
          number: 1,
          winner: "CT",
          ctEquip: 800,
          tEquip: 800,
          team_ct: "Astralis",
          team_t: "Vitality",
        },
        {
          number: 4,
          winner: "CT",
          ctEquip: 5000,
          tEquip: 500,
          team_ct: "Astralis",
          team_t: "Vitality",
        },
        {
          number: 13,
          winner: "T",
          ctEquip: 800,
          tEquip: 800,
          team_ct: "Vitality",
          team_t: "Astralis",
        },
      ]),
    );
    expect(economy.rates).toEqual([
      {
        team: "Vitality",
        rows: [
          { buy: "pistol", rounds: 2, wins: 0 },
          { buy: "eco", rounds: 1, wins: 0 },
        ],
      },
      {
        team: "Astralis",
        rows: [
          { buy: "pistol", rounds: 2, wins: 2 },
          { buy: "anti-eco", rounds: 1, wins: 1 },
        ],
      },
    ]);
    const swapped = economy.rows.find((row) => row.team === "Astralis")?.cells[2];
    expect(swapped?.side).toBe("T");
    expect(swapped?.won).toBe(true);
    expect(swapped?.buy).toBe("pistol");
  });

  it("names each side from that round, including after the half swap", () => {
    const replay = economyReplay([
      {
        number: 1,
        winner: "CT",
        ctEquip: 800,
        tEquip: 800,
        team_ct: "Astralis",
        team_t: "Vitality",
      },
      {
        number: 13,
        winner: "T",
        ctEquip: 800,
        tEquip: 800,
        team_ct: "Vitality",
        team_t: "Astralis",
      },
    ]);
    expect(roundTeamName(replay, replay.rounds[0]!, "CT")).toBe("Astralis");
    expect(roundTeamName(replay, replay.rounds[0]!, "T")).toBe("Vitality");
    expect(roundTeamName(replay, replay.rounds[1]!, "CT")).toBe("Vitality");
    expect(roundTeamName(replay, replay.rounds[1]!, "T")).toBe("Astralis");
  });

  it("ignores a leftover dead $0 controller when averaging a side", () => {
    const players = [
      makePlayer(0, "CT", "C"),
      makePlayer(1, "T", "T"),
      makePlayer(2, "CT", "Ghost"),
    ];
    const ticks = makeTicks(3, 1);
    const freeze = 64;
    ticks.ticks[0] = freeze;
    ticks.flags[0] = FLAG_PRESENT | FLAG_ALIVE | FLAG_CT;
    ticks.flags[1] = FLAG_PRESENT | FLAG_ALIVE;
    ticks.flags[2] = FLAG_PRESENT | FLAG_CT;
    ticks.equip[0] = 5000;
    ticks.equip[1] = 5000;
    ticks.equip[2] = 0;
    ticks.money[2] = 0;
    const replay = makeReplay({
      players,
      ticks,
      rounds: [
        makeRound({
          number: 4,
          winner: "CT",
          start_tick: 0,
          freeze_end_tick: freeze,
          end_tick: 800,
        }),
      ],
    });
    const economy = matchEconomy(replay);
    expect(economy.rounds[0]?.ct.buy).toBe("full");
    expect(economy.rounds[0]?.ct.averageEquipment).toBe(5000);
    expect(economy.rounds[0]?.t.buy).toBe("full");
  });

  it("classifies half edges and overtime from equipment, except the second pistol", () => {
    const economy = matchEconomy(
      economyReplay([
        {
          number: 12,
          winner: "CT",
          ctEquip: 4500,
          tEquip: 4500,
          team_ct: "Astralis",
          team_t: "Vitality",
        },
        {
          number: 13,
          winner: "T",
          ctEquip: 5000,
          tEquip: 4200,
          team_ct: "Vitality",
          team_t: "Astralis",
        },
        { number: 24, winner: "CT", ctEquip: 800, tEquip: 800 },
        { number: 25, winner: "CT", ctEquip: 4500, tEquip: 4500 },
        { number: 28, winner: "T", ctEquip: 800, tEquip: 5000 },
        { number: 31, winner: "CT", ctEquip: 2500, tEquip: 2500 },
      ]),
    );
    expect(economy.rounds.map((round) => [round.round, round.ct.buy, round.t.buy])).toEqual([
      [12, "full", "full"],
      [13, "pistol", "pistol"],
      [24, "eco", "eco"],
      [25, "full", "full"],
      [28, "eco", "anti-eco"],
      [31, "force", "force"],
    ]);
    const pistolRounds = economy.rounds
      .filter((round) => round.ct.buy === "pistol" || round.t.buy === "pistol")
      .map((round) => round.round);
    expect(pistolRounds).toEqual([13]);
    expect(economy.rounds[0]?.t.team).toBe("Vitality");
    expect(economy.rounds[1]?.ct.team).toBe("Vitality");
    expect(economy.rounds[1]?.t.team).toBe("Astralis");
  });

  it("classifies a repeated round number from that round's own freeze", () => {
    const economy = matchEconomy(
      economyReplay([
        { number: 8, winner: "CT", ctEquip: 5000, tEquip: 5000 },
        { number: 8, winner: "T", ctEquip: 500, tEquip: 500 },
      ]),
    );
    expect(economy.rounds).toHaveLength(2);
    expect(economy.rounds[0]?.ct.buy).toBe("full");
    expect(economy.rounds[1]?.ct.buy).toBe("eco");
    expect(economy.rounds[0]?.jumpTick).not.toBe(economy.rounds[1]?.jumpTick);
  });

  it("leaves the buy empty when a side is missing at freeze", () => {
    const economy = matchEconomy(
      economyReplay([{ number: 4, winner: null, ctEquip: 0, tEquip: 0, present: false }]),
    );
    expect(economy.rounds[0]?.ct.buy).toBeNull();
    expect(economy.rounds[0]?.t.buy).toBeNull();
    expect(economy.rates[0]?.rows).toEqual([]);
    expect(economy.rows[0]?.cells[0]?.decided).toBe(false);
  });
});
