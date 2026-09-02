import type { ReviewItem } from "../review";
import { clutchLoss } from "./clutchLoss";
import { clutchWin } from "./clutchWin";
import { deathTrade } from "./deathTrade";
import { ecoWin } from "./ecoWin";
import { fedMulti } from "./fedMulti";
import { flashedDeath } from "./flashedDeath";
import { lowReturn } from "./lowReturn";
import { multiKill } from "./multiKill";
import { nadesLeft } from "./nadesLeft";
import { openingDeath } from "./openingDeath";
import { openingWin } from "./openingWin";
import { roundLost } from "./roundLost";
import { tradedOpener } from "./tradedOpener";
import { utilDeath } from "./utilDeath";

/**
 * Death collectors run in order onto one note (detail bit order). Round
 * collectors each emit their own note. Add a new file and append it here.
 */
export const REVIEW_ITEMS: ReviewItem[] = [
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
];
