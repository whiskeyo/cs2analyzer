import {
  RATING_ADR_MEAN,
  RATING_ADR_STD,
  RATING_CENTER,
  RATING_CHART_HIGH,
  RATING_CLUTCH_1V1_WEIGHT,
  RATING_CLUTCH_1V2_WEIGHT,
  RATING_CLUTCH_1V3_WEIGHT,
  RATING_CLUTCH_1V4_WEIGHT,
  RATING_CLUTCH_1V5_WEIGHT,
  RATING_CLUTCH_PILLAR_CLUTCH_WEIGHT,
  RATING_CLUTCH_PILLAR_OBJ_WEIGHT,
  RATING_CLUTCH_STD,
  RATING_ENTRY_DIFF_STD,
  RATING_FIREPOWER_ADR_WEIGHT,
  RATING_FIREPOWER_KD_WEIGHT,
  RATING_FLOOR,
  RATING_IMPACT_ENTRY_WEIGHT,
  RATING_IMPACT_MULTI_WEIGHT,
  RATING_KAST_MEAN,
  RATING_KAST_STD,
  RATING_KD_DIFF_STD,
  RATING_MULTI_2K_WEIGHT,
  RATING_MULTI_3K_WEIGHT,
  RATING_MULTI_4K_WEIGHT,
  RATING_MULTI_5K_WEIGHT,
  RATING_MULTI_MEAN,
  RATING_MULTI_STD,
  RATING_OBJ_DEFUSE_WEIGHT,
  RATING_OBJ_MEAN,
  RATING_OBJ_PLANT_WEIGHT,
  RATING_OBJ_STD,
  RATING_PILLAR_CLUTCH_WEIGHT,
  RATING_PILLAR_FIREPOWER_WEIGHT,
  RATING_PILLAR_IMPACT_WEIGHT,
  RATING_PILLAR_SUPPORT_WEIGHT,
  RATING_SPREAD_STD,
  RATING_SUPPORT_KAST_WEIGHT,
  RATING_SUPPORT_TRADE_WEIGHT,
  RATING_SUPPORT_UTIL_WEIGHT,
  RATING_TRADE_RATE_MEAN,
  RATING_TRADE_RATE_STD,
  RATING_UDPR_SCALE,
  RATING_UTIL_MEAN,
  RATING_UTIL_STD,
  RATING_Z_SCALE,
} from "@/lib/shared/constants";

/** Counts `matchRating` needs. Extra `PlayerStats` fields are ignored. */
export interface RatingInputs {
  rounds: number;
  kills: number;
  deaths: number;
  adr: number;
  /** KAST as a 0–100 percentage. */
  kast: number;
  first_kills: number;
  first_deaths: number;
  multi_kills_2: number;
  multi_kills_3: number;
  multi_kills_4: number;
  aces: number;
  trade_kills: number;
  trade_deaths: number;
  utility_damage: number;
  flash_assists: number;
  clutch_1v1: number;
  clutch_1v2: number;
  clutch_1v3: number;
  clutch_1v4: number;
  clutch_1v5: number;
  plants: number;
  defuses: number;
}

export interface MatchRating {
  rating: number;
  firepower: number;
  impact: number;
  support: number;
  clutch: number;
}

function roundRating(value: number): number {
  return Math.round(value * 100) / 100;
}

export type MatchRatingRange = {
  min: number;
  max: number | null;
  label: string;
};

/** Gaussian reading bands around `RATING_CENTER` with spread `RATING_SPREAD_STD`. */
export const MATCH_RATING_RANGES: readonly MatchRatingRange[] = [
  { min: RATING_FLOOR, max: RATING_CENTER - RATING_SPREAD_STD, label: "Poor" },
  { min: RATING_CENTER - RATING_SPREAD_STD, max: RATING_CENTER, label: "Average" },
  { min: RATING_CENTER, max: RATING_CENTER + RATING_SPREAD_STD, label: "Good" },
  {
    min: RATING_CENTER + RATING_SPREAD_STD,
    max: RATING_CENTER + 2 * RATING_SPREAD_STD,
    label: "Great",
  },
  { min: RATING_CENTER + 2 * RATING_SPREAD_STD, max: RATING_CHART_HIGH, label: "Excellent" },
  { min: RATING_CHART_HIGH, max: null, label: "Outstanding" },
];

export function formatRatingRange(range: MatchRatingRange): string {
  const lo = range.min.toFixed(2);
  if (range.max == null) return `${lo}+`;
  return `${lo}–${range.max.toFixed(2)}`;
}

/** Inclusive on `min`; a value below the floor maps to Poor. */
export function ratingRangeFor(value: number): MatchRatingRange {
  for (let i = MATCH_RATING_RANGES.length - 1; i >= 0; i--) {
    const range = MATCH_RATING_RANGES[i];
    if (range && value >= range.min) return range;
  }
  return MATCH_RATING_RANGES[0]!;
}

export function ratingBandClass(value: number): string {
  return `rating-band rating-band-${ratingRangeFor(value).label.toLowerCase()}`;
}

/**
 * 1.00–10.00+ match rating from live board stats (v8 unclipped).
 * Knife rounds must already be excluded from the inputs.
 */
export function matchRating(s: RatingInputs): MatchRating {
  const rounds = Math.max(s.rounds, 1);
  const kpr = s.kills / rounds;
  const dpr = s.deaths / rounds;

  const zKd = (kpr - dpr) / RATING_KD_DIFF_STD;
  const zAdr = (s.adr - RATING_ADR_MEAN) / RATING_ADR_STD;
  const firepower = RATING_FIREPOWER_KD_WEIGHT * zKd + RATING_FIREPOWER_ADR_WEIGHT * zAdr;

  const zEntry = (s.first_kills - s.first_deaths) / rounds / RATING_ENTRY_DIFF_STD;
  const mkScore =
    (RATING_MULTI_2K_WEIGHT * s.multi_kills_2 +
      RATING_MULTI_3K_WEIGHT * s.multi_kills_3 +
      RATING_MULTI_4K_WEIGHT * s.multi_kills_4 +
      RATING_MULTI_5K_WEIGHT * s.aces) /
    rounds;
  const zMulti = (mkScore - RATING_MULTI_MEAN) / RATING_MULTI_STD;
  const impact = RATING_IMPACT_ENTRY_WEIGHT * zEntry + RATING_IMPACT_MULTI_WEIGHT * zMulti;

  const zKast = (s.kast - RATING_KAST_MEAN) / RATING_KAST_STD;
  const tradeRate = (s.trade_kills + s.trade_deaths) / Math.max(s.kills + s.deaths, 1);
  const zTrades = (tradeRate - RATING_TRADE_RATE_MEAN) / RATING_TRADE_RATE_STD;
  const udpr = s.utility_damage / rounds;
  const utilScore = udpr / RATING_UDPR_SCALE + s.flash_assists / rounds;
  const zUtil = (utilScore - RATING_UTIL_MEAN) / RATING_UTIL_STD;
  const support =
    RATING_SUPPORT_KAST_WEIGHT * zKast +
    RATING_SUPPORT_TRADE_WEIGHT * zTrades +
    RATING_SUPPORT_UTIL_WEIGHT * zUtil;

  const clutchScore =
    (RATING_CLUTCH_1V1_WEIGHT * s.clutch_1v1 +
      RATING_CLUTCH_1V2_WEIGHT * s.clutch_1v2 +
      RATING_CLUTCH_1V3_WEIGHT * s.clutch_1v3 +
      RATING_CLUTCH_1V4_WEIGHT * s.clutch_1v4 +
      RATING_CLUTCH_1V5_WEIGHT * s.clutch_1v5) /
    rounds;
  const zClutch = clutchScore / RATING_CLUTCH_STD;
  const objScore =
    (RATING_OBJ_PLANT_WEIGHT * s.plants + RATING_OBJ_DEFUSE_WEIGHT * s.defuses) / rounds;
  const zObj = (objScore - RATING_OBJ_MEAN) / RATING_OBJ_STD;
  const clutch =
    RATING_CLUTCH_PILLAR_CLUTCH_WEIGHT * zClutch + RATING_CLUTCH_PILLAR_OBJ_WEIGHT * zObj;

  const zTotal =
    RATING_PILLAR_FIREPOWER_WEIGHT * firepower +
    RATING_PILLAR_IMPACT_WEIGHT * impact +
    RATING_PILLAR_SUPPORT_WEIGHT * support +
    RATING_PILLAR_CLUTCH_WEIGHT * clutch;

  return {
    rating: Math.max(RATING_FLOOR, roundRating(RATING_CENTER + zTotal * RATING_Z_SCALE)),
    firepower,
    impact,
    support,
    clutch,
  };
}
