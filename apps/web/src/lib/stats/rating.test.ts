import { describe, expect, it } from "vitest";
import {
  RATING_CENTER,
  RATING_CHART_HIGH,
  RATING_FLOOR,
  RATING_SPREAD_STD,
} from "@/lib/shared/constants";
import {
  formatRatingRange,
  MATCH_RATING_RANGES,
  matchRating,
  ratingRangeFor,
  type RatingInputs,
} from "./rating";

function inputs(overrides: Partial<RatingInputs> = {}): RatingInputs {
  return {
    rounds: 20,
    kills: 10,
    deaths: 10,
    adr: 75,
    kast: 70,
    first_kills: 0,
    first_deaths: 0,
    multi_kills_2: 5,
    multi_kills_3: 0,
    multi_kills_4: 0,
    aces: 0,
    trade_kills: 4,
    trade_deaths: 3,
    utility_damage: 140,
    flash_assists: 0,
    clutch_1v1: 0,
    clutch_1v2: 0,
    clutch_1v3: 0,
    clutch_1v4: 0,
    clutch_1v5: 0,
    plants: 1,
    defuses: 1,
    ...overrides,
  };
}

describe("matchRating", () => {
  it("is 5.25 when every pillar is at its reference mean", () => {
    const rated = matchRating(inputs());
    expect(rated.rating).toBe(RATING_CENTER);
    expect(rated.firepower).toBeCloseTo(0, 10);
    expect(rated.impact).toBeCloseTo(0, 10);
    expect(rated.support).toBeCloseTo(0, 10);
    expect(rated.clutch).toBeCloseTo(0, 10);
  });

  it("matches v8_unclipped on a typical 24-round line", () => {
    const rated = matchRating(
      inputs({
        rounds: 24,
        kills: 20,
        deaths: 15,
        adr: 83.33,
        kast: 75,
        first_kills: 5,
        first_deaths: 2,
        multi_kills_2: 4,
        multi_kills_3: 2,
        multi_kills_4: 1,
        aces: 0,
        trade_kills: 3,
        trade_deaths: 1,
        utility_damage: 120,
        flash_assists: 1,
        clutch_1v1: 1,
        plants: 2,
        defuses: 1,
      }),
    );
    expect(rated.rating).toBe(6.54);
    expect(rated.firepower).toBeCloseTo(0.6018, 3);
    expect(rated.impact).toBeCloseTo(1.3542, 3);
    expect(rated.support).toBeCloseTo(-0.3423, 3);
    expect(rated.clutch).toBeCloseTo(0.5361, 3);
  });

  it("floors at 1.00 and does not cap historic games at 10.00", () => {
    const empty = matchRating(
      inputs({
        rounds: 24,
        kills: 0,
        deaths: 0,
        adr: 0,
        kast: 0,
        first_kills: 0,
        first_deaths: 0,
        multi_kills_2: 0,
        trade_kills: 0,
        trade_deaths: 0,
        utility_damage: 0,
        plants: 0,
        defuses: 0,
      }),
    );
    expect(empty.rating).toBe(1.77);
    expect(empty.rating).toBeGreaterThanOrEqual(RATING_FLOOR);

    const historic = matchRating(
      inputs({
        rounds: 24,
        kills: 50,
        deaths: 5,
        adr: 160,
        kast: 100,
        first_kills: 15,
        first_deaths: 0,
        multi_kills_2: 4,
        multi_kills_3: 2,
        multi_kills_4: 1,
        aces: 4,
        trade_kills: 3,
        trade_deaths: 1,
        utility_damage: 120,
        flash_assists: 1,
        clutch_1v1: 1,
        clutch_1v5: 3,
        plants: 2,
        defuses: 1,
      }),
    );
    expect(historic.rating).toBe(17.44);
  });

  it("treats zero rounds as one so early playhead ticks stay defined", () => {
    const rated = matchRating(inputs({ rounds: 0, kills: 0, deaths: 0, utility_damage: 0 }));
    expect(Number.isFinite(rated.rating)).toBe(true);
    expect(rated.rating).toBeGreaterThanOrEqual(RATING_FLOOR);
  });
});

describe("MATCH_RATING_RANGES", () => {
  it("covers the Gaussian bands around the scale center", () => {
    expect(MATCH_RATING_RANGES.map((range) => range.label)).toEqual([
      "Poor",
      "Average",
      "Good",
      "Great",
      "Excellent",
      "Outstanding",
    ]);
    expect(MATCH_RATING_RANGES[0]?.min).toBe(RATING_FLOOR);
    expect(MATCH_RATING_RANGES[1]?.min).toBe(RATING_CENTER - RATING_SPREAD_STD);
    expect(MATCH_RATING_RANGES[2]?.min).toBe(RATING_CENTER);
    expect(MATCH_RATING_RANGES[3]?.min).toBe(RATING_CENTER + RATING_SPREAD_STD);
    expect(MATCH_RATING_RANGES[4]?.max).toBe(RATING_CHART_HIGH);
    expect(formatRatingRange(MATCH_RATING_RANGES[0]!)).toBe("1.00–3.55");
    expect(formatRatingRange(MATCH_RATING_RANGES[5]!)).toBe("10.00+");
  });

  it("maps a rating onto the inclusive-min band used on the graph", () => {
    expect(ratingRangeFor(0.5).label).toBe("Poor");
    expect(ratingRangeFor(1).label).toBe("Poor");
    expect(ratingRangeFor(3.54).label).toBe("Poor");
    expect(ratingRangeFor(3.55).label).toBe("Average");
    expect(ratingRangeFor(5.24).label).toBe("Average");
    expect(ratingRangeFor(5.25).label).toBe("Good");
    expect(ratingRangeFor(6.95).label).toBe("Great");
    expect(ratingRangeFor(8.65).label).toBe("Excellent");
    expect(ratingRangeFor(9.99).label).toBe("Excellent");
    expect(ratingRangeFor(10).label).toBe("Outstanding");
    expect(ratingRangeFor(17.44).label).toBe("Outstanding");
  });
});
