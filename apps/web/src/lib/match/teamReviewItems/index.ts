import type { TeamReviewItem } from "../teamReview";
import { antiEcoLoss } from "./antiEcoLoss";
import { clutchConceded } from "./clutchConceded";
import { ecoForceWin } from "./ecoForceWin";
import { flashAssist } from "./flashAssist";
import { gunRoundLoss } from "./gunRoundLoss";
import { manAdvantageLoss } from "./manAdvantageLoss";
import { openingFailed } from "./openingFailed";
import { openingRecovered } from "./openingRecovered";
import { pistolRound } from "./pistolRound";
import { postPlantLoss } from "./postPlantLoss";
import { untradedOpenerLoss } from "./untradedOpenerLoss";

/**
 * Round collectors each emit their own notes. Add a new file and append it here.
 */
export const TEAM_REVIEW_ITEMS: TeamReviewItem[] = [
  ecoForceWin,
  antiEcoLoss,
  gunRoundLoss,
  pistolRound,
  manAdvantageLoss,
  openingFailed,
  openingRecovered,
  untradedOpenerLoss,
  clutchConceded,
  postPlantLoss,
  flashAssist,
];
