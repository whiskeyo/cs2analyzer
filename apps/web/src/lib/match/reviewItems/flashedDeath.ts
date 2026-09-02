import type { ReviewItem } from "../review";
import { countHeadline, flashedAt, plural, setHigh } from "./support";

export const flashedDeath: ReviewItem = {
  create() {
    let flashed = 0;
    return {
      applyDeath(ctx, draft) {
        const flash = flashedAt(ctx.replay, ctx.player, ctx.kill.tick);
        if (!flash) return;
        flashed += 1;
        const by =
          flash.by >= 0 && flash.by !== ctx.player ? ` by ${ctx.playerName(flash.by)}` : "";
        draft.bits.push(`flashed${by} (${flash.duration.toFixed(1)}s)`);
        setHigh(draft);
      },
      headlines() {
        return countHeadline(
          flashed,
          "high",
          "death",
          `Died flashed ${flashed} ${plural(flashed, "time", "times")}`,
        );
      },
    };
  },
};
