import { describe, expect, it } from "vitest";
import { decodeList, decodeObject, PayloadError } from "./decode";
import type { Hurt, Kill, MatchHeader, Round } from "@/lib/replay/replayTypes";
import { makeHurt } from "@/lib/testing/fixtures";

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
      is_knife: false,
    };
    expect(decodeList<Round>("rounds", JSON.stringify([round]))[0].winner).toBeNull();
    expect(() => decodeList<Round>("rounds", `[${without(round, "winner")}]`)).toThrow(
      /"winner".*expected string or null/s,
    );
  });

  it("rejects an object where a list belongs", () => {
    expect(() => decodeList("kills", JSON.stringify(kill))).toThrow(/expected an array/);
  });
});
