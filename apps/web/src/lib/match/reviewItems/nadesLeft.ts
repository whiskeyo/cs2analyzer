import { samplePlayers } from "@/lib/replay/sample";
import {
  GEAR_DECOY,
  GEAR_FLASH,
  GEAR_FLASH2,
  GEAR_HE,
  GEAR_MOLLY,
  GEAR_SMOKE,
} from "@/lib/replay/replayTypes";
import type { ReviewItem } from "../review";
import { countHeadline, plural } from "./support";

const NADE_GEAR = GEAR_HE | GEAR_FLASH | GEAR_FLASH2 | GEAR_SMOKE | GEAR_MOLLY | GEAR_DECOY;
const MIN_UNUSED_NADES = 2;

function nadeCount(gear: number): number {
  let n = 0;
  if (gear & GEAR_HE) n += 1;
  if (gear & GEAR_FLASH) n += 1;
  if (gear & GEAR_FLASH2) n += 1;
  if (gear & GEAR_SMOKE) n += 1;
  if (gear & GEAR_MOLLY) n += 1;
  if (gear & GEAR_DECOY) n += 1;
  return n;
}

export const nadesLeft: ReviewItem = {
  create() {
    let held = 0;
    return {
      applyDeath(ctx, draft) {
        const load = samplePlayers(ctx.replay, ctx.pre).find((p) => p.index === ctx.player);
        if (!load || (load.gear & NADE_GEAR) === 0) return;
        const n = nadeCount(load.gear);
        if (n < MIN_UNUSED_NADES) return;
        held += 1;
        draft.bits.push(`died holding ${n} nades`);
      },
      headlines() {
        return countHeadline(
          held,
          "low",
          "death",
          `Died holding unused nades ${held} ${plural(held, "time", "times")}`,
        );
      },
    };
  },
};
