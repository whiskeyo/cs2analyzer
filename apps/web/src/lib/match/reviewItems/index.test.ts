import { describe, expect, it } from "vitest";
import { clutchLoss } from "./clutchLoss";
import { clutchWin } from "./clutchWin";
import { deathTrade } from "./deathTrade";
import { ecoWin } from "./ecoWin";
import { fedMulti } from "./fedMulti";
import { flashedDeath } from "./flashedDeath";
import { REVIEW_ITEMS } from "./index";
import { lowReturn } from "./lowReturn";
import { multiKill } from "./multiKill";
import { nadesLeft } from "./nadesLeft";
import { openingDeath } from "./openingDeath";
import { openingWin } from "./openingWin";
import { roundLost } from "./roundLost";
import { tradedOpener } from "./tradedOpener";
import { utilDeath } from "./utilDeath";

describe("REVIEW_ITEMS", () => {
  it("runs death collectors first so stacked detail bits stay in this order", () => {
    expect(REVIEW_ITEMS).toEqual([
      openingDeath,
      deathTrade,
      flashedDeath,
      utilDeath,
      clutchLoss,
      fedMulti,
      lowReturn,
      nadesLeft,
      roundLost,
      openingWin,
      tradedOpener,
      multiKill,
      ecoWin,
      clutchWin,
    ]);
  });

  it("creates a fresh collector with headlines() for every item", () => {
    for (const item of REVIEW_ITEMS) {
      const collector = item.create();
      expect(collector.headlines()).toEqual([]);
      expect(item.create()).not.toBe(collector);
    }
  });
});
