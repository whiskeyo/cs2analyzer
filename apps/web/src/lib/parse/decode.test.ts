import { describe, expect, it } from "vitest";
import { DECODE_LIST_SAMPLE_STRIDE, decodeList, decodeObject, PayloadError } from "./decode";
import type {
  BombEvent,
  ControllerDump,
  Hurt,
  Kill,
  MatchHeader,
  Player,
  Round,
  RoundScoreboard,
} from "@/lib/replay/replayTypes";
import { makeHurt, makePlayer, sampleMatchInfo } from "@/lib/testing/fixtures";
import type { MatchInfo } from "@/lib/replay/replayTypes";

const header: MatchHeader = {
  map_name: "de_anubis",
  tick_rate: 64,
  tick_stride: 4,
  duration_s: 10,
  playback_ticks: 1920,
  team_ct: "Astralis",
  team_t: "Vitality",
  score_ct: 13,
  score_t: 11,
};

const kill: Kill = {
  tick: 200,
  attacker: 0,
  victim: 2,
  assister: -1,
  weapon: "ak47",
  headshot: true,
  assisted_flash: false,
  wallbang: false,
  noscope: false,
  through_smoke: false,
  attacker_blind: false,
  attacker_airborne: false,
  x: 1,
  y: 2,
  z: 3,
  attacker_x: 4,
  attacker_y: 5,
  attacker_z: 6,
};

/** Serialised payload with one field gone, as a Rust rename would leave it. */
function without<T extends object>(value: T, field: keyof T & string): string {
  const copy = { ...value } as Record<string, unknown>;
  delete copy[field];
  return JSON.stringify(copy);
}

describe("decodeObject", () => {
  it("passes a header the parser really sends", () => {
    expect(decodeObject<MatchHeader>("header", JSON.stringify(header))).toEqual(header);
  });

  it("names the field when Rust renames one", () => {
    const renamed = { ...header, mapName: "de_anubis" } as Record<string, unknown>;
    delete renamed.map_name;
    expect(() => decodeObject<MatchHeader>("header", JSON.stringify(renamed))).toThrow(
      /"map_name".*expected string/s,
    );
  });

  it("names the field when a type changes", () => {
    expect(() =>
      decodeObject<MatchHeader>("header", JSON.stringify({ ...header, tick_rate: "64" })),
    ).toThrow(/a string for "tick_rate", expected number/);
  });

  it("rejects invalid JSON and a non-object payload", () => {
    expect(() => decodeObject("header", "{oops")).toThrow(PayloadError);
    expect(() => decodeObject("header", "42")).toThrow(/expected an object/);
  });
});

describe("decodeObject matchInfo", () => {
  const info: MatchInfo = sampleMatchInfo();

  it("keeps demo strings that equal a default and the tournament table", () => {
    const decoded = decodeObject<MatchInfo>("matchInfo", JSON.stringify(info));
    expect(decoded.convars.defaults.mp_overtime_maxrounds).toBe("6");
    expect(decoded.convars.demo.mp_overtime_maxrounds).toBeUndefined();
    expect(decoded.convars.demo.mp_maxrounds).toBe("24");
    expect(decoded.convars.defaults.mp_maxrounds).toBe("24");
    expect(decoded.convars.demo.mp_maxrounds ?? decoded.convars.defaults.mp_maxrounds).toBe("24");
    expect(decoded.convars.defaults).toEqual({
      mp_buytime: "20",
      mp_c4timer: "40",
      mp_maxmoney: "16000",
      mp_maxrounds: "24",
      mp_overtime_maxrounds: "6",
      mp_overtime_startmoney: "12500",
      mp_roundtime: "1.92",
      mp_roundtime_defuse: "1.92",
      mp_startmoney: "800",
    });
    expect(decoded.rules.m_nOvertimePlaying).toBe(3);
    expect(decoded.teams.ct.m_iScore).toBe(20);
    expect(
      decoded.teams.ct.m_scoreFirstHalf +
        decoded.teams.ct.m_scoreSecondHalf +
        decoded.teams.ct.m_scoreOvertime,
    ).toBe(decoded.teams.ct.m_iScore);
  });

  it("names a convar value that is not a string", () => {
    const broken = structuredClone(info);
    (broken.convars.demo as { mp_maxrounds: unknown }).mp_maxrounds = 24;
    expect(() => decodeObject("matchInfo", JSON.stringify(broken))).toThrow(
      /convars\.demo\.mp_maxrounds.*string/s,
    );
  });
});

describe("decodeList", () => {
  it("passes events the parser really sends", () => {
    expect(decodeList<Kill>("kills", JSON.stringify([kill, kill]))).toHaveLength(2);
  });

  it("accepts an empty array, because a quiet demo looks the same", () => {
    expect(decodeList<Kill>("kills", "[]")).toEqual([]);
  });

  it("points at the element it checked", () => {
    expect(() => decodeList<Kill>("kills", `[${without(kill, "headshot")}]`)).toThrow(
      /"kills\[0\]".*"headshot".*expected boolean/s,
    );
  });

  it("requires kill modifier flags from the parser", () => {
    expect(() => decodeList<Kill>("kills", `[${without(kill, "wallbang")}]`)).toThrow(
      /"kills\[0\]".*"wallbang".*expected boolean/s,
    );
  });

  it("requires hurt hitgroup and armor fields", () => {
    const hurt = makeHurt(90, 0, 1, 34, { hitgroup: 2, damage_armor: 12, health: 66, armor: 85 });
    expect(decodeList<Hurt>("hurts", JSON.stringify([hurt]))).toEqual([hurt]);
    expect(() => decodeList<Hurt>("hurts", `[${without(hurt, "hitgroup")}]`)).toThrow(
      /"hurts\[0\]".*"hitgroup".*expected number/s,
    );
  });

  it("allows a null winner but not a missing one", () => {
    const round: Round = {
      number: 1,
      start_tick: 0,
      freeze_end_tick: 64,
      end_tick: 640,
      winner: null,
      win_reason: 8,
      score_ct: 1,
      score_t: 0,
      round_time_s: 0,
      is_knife: false,
    };
    expect(decodeList<Round>("rounds", JSON.stringify([round]))[0].winner).toBeNull();
    expect(() => decodeList<Round>("rounds", `[${without(round, "winner")}]`)).toThrow(
      /"winner".*expected string or null/s,
    );
  });

  it("requires round is_knife so a Rust rename fails on drop", () => {
    const round: Round = {
      number: 1,
      start_tick: 0,
      freeze_end_tick: 64,
      end_tick: 640,
      winner: "CT",
      win_reason: 8,
      score_ct: 1,
      score_t: 0,
      round_time_s: 115,
      is_knife: false,
    };
    expect(decodeList<Round>("rounds", JSON.stringify([round]))[0].is_knife).toBe(false);
    expect(() => decodeList<Round>("rounds", `[${without(round, "is_knife")}]`)).toThrow(
      /"rounds\[0\]".*"is_knife".*expected boolean/s,
    );
  });

  it("fills a missing round_time_s with 0 and rejects a bad type", () => {
    const round: Round = {
      number: 1,
      start_tick: 0,
      freeze_end_tick: 64,
      end_tick: 640,
      winner: "CT",
      win_reason: 8,
      score_ct: 1,
      score_t: 0,
      round_time_s: 90,
      is_knife: false,
    };
    expect(decodeList<Round>("rounds", JSON.stringify([round]))[0].round_time_s).toBe(90);
    expect(decodeList<Round>("rounds", `[${without(round, "round_time_s")}]`)[0].round_time_s).toBe(
      0,
    );
    expect(() =>
      decodeList<Round>("rounds", JSON.stringify([{ ...round, round_time_s: "90" }])),
    ).toThrow(/"rounds\[0\]".*"round_time_s".*expected number/s);
  });

  it("requires player is_bot so a Rust rename fails on drop", () => {
    const player: Player = makePlayer(0, "T", "Mike", 0xb0700005, true);
    expect(decodeList<Player>("players", JSON.stringify([player]))).toEqual([player]);
    expect(() => decodeList<Player>("players", `[${without(player, "is_bot")}]`)).toThrow(
      /"players\[0\]".*"is_bot".*expected boolean/s,
    );
  });

  it("requires controller dump assigned so a Rust rename fails on drop", () => {
    const row: ControllerDump = {
      tick: 64,
      slot: 7,
      name: "Mike",
      steam: 0,
      is_bot: false,
      connected: 0,
      has_team_pawn: true,
      assigned: 0xb0700007,
      at_freeze: true,
    };
    expect(decodeList<ControllerDump>("controllerDump", JSON.stringify([row]))).toEqual([row]);
    expect(() =>
      decodeList<ControllerDump>("controllerDump", `[${without(row, "assigned")}]`),
    ).toThrow(/"controllerDump\[0\]".*"assigned".*expected number/s);
  });

  it("requires bomb event z so a Rust rename fails on drop", () => {
    const planted: BombEvent = {
      tick: 400,
      kind: "planted",
      player: 3,
      x: 100,
      y: 200,
      z: 50,
      haskit: false,
    };
    expect(decodeList<BombEvent>("bombEvents", JSON.stringify([planted]))).toEqual([planted]);
    expect(() => decodeList<BombEvent>("bombEvents", `[${without(planted, "z")}]`)).toThrow(
      /"bombEvents\[0\]".*"z".*expected number/s,
    );
    expect(() => decodeList<BombEvent>("bombEvents", `[${without(planted, "haskit")}]`)).toThrow(
      /"bombEvents\[0\]".*"haskit".*expected boolean/s,
    );
  });

  it("requires round scoreboard counters so a Rust rename fails on drop", () => {
    const row: RoundScoreboard = {
      round: 12,
      players: [
        {
          steam_id: 765611980000001,
          slot: 4,
          name: "alice",
          kills: 18,
          deaths: 14,
          assists: 5,
          damage: 2100,
          headshot_kills: 9,
          utility_damage: 80,
          enemies_flashed: 11,
        },
      ],
    };
    expect(decodeList<RoundScoreboard>("roundScoreboard", JSON.stringify([row]))).toEqual([row]);
    const missing = {
      round: 12,
      players: [{ ...row.players[0] }],
    };
    delete (missing.players[0] as { damage?: number }).damage;
    expect(() => decodeList<RoundScoreboard>("roundScoreboard", JSON.stringify([missing]))).toThrow(
      /"roundScoreboard\[0\].players\[0\]".*"damage".*expected number/s,
    );
  });

  it("rejects an object where a list belongs", () => {
    expect(() => decodeList("kills", JSON.stringify(kill))).toThrow(/expected an array/);
  });

  it("also checks the last element and a stride sample", () => {
    const lastBad = Array.from({ length: 3 }, () => ({ ...kill }));
    delete (lastBad[2] as { headshot?: boolean }).headshot;
    expect(() => decodeList<Kill>("kills", JSON.stringify(lastBad))).toThrow(
      /"kills\[2\]".*"headshot".*expected boolean/s,
    );

    const mid = Array.from({ length: DECODE_LIST_SAMPLE_STRIDE + 2 }, () => kill);
    mid[DECODE_LIST_SAMPLE_STRIDE] = { ...kill };
    delete (mid[DECODE_LIST_SAMPLE_STRIDE] as { weapon?: string }).weapon;
    expect(() => decodeList<Kill>("kills", JSON.stringify(mid))).toThrow(
      new RegExp(`"kills\\[${DECODE_LIST_SAMPLE_STRIDE}\\]".*"weapon"`, "s"),
    );
  });
});
