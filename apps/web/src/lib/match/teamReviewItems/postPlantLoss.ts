import type { TeamReviewItem } from "../teamReview";
import { plural, teamDetail, teamHeadline, teamNote } from "./support";
import type { ReviewHeadlineDetail } from "./support";

/**
 * T: lost after planting. CT: lost the retake (plant happened, CT lost).
 */
export const postPlantLoss: TeamReviewItem = {
  create() {
    let count = 0;
    const details: ReviewHeadlineDetail[] = [];
    return {
      collectRound(ctx) {
        if (!ctx.completed || !ctx.teamLost) return;
        const plant = ctx.replay.bombEvents.find(
          (e) =>
            e.kind === "planted" &&
            e.tick >= ctx.round.freeze_end_tick &&
            e.tick <= Math.min(ctx.round.end_tick, ctx.untilTick),
        );
        if (plant == null) return;
        count += 1;
        const line = ctx.side === "T" ? "Lost after planting" : "Failed the retake";
        details.push(teamDetail(ctx, plant.tick, line));
        return [teamNote(ctx, plant.tick, "death", "high", line, "post-plant")];
      },
      headlines() {
        return teamHeadline(
          count,
          "high",
          "death",
          `Lost ${count} post-plant / retake ${plural(count, "round", "rounds")}`,
          details,
        );
      },
    };
  },
};
