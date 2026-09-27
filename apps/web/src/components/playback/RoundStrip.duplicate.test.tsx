import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ECO_MAX_EQUIPMENT, FORCE_BUY_MAX_EQUIPMENT } from "@/lib/shared/constants";
import { makeReplay, makeRound, makeTicks } from "@/lib/testing/fixtures";
import { FLAG_ALIVE, FLAG_CT, FLAG_PRESENT } from "@/lib/replay/replayTypes";
import { RoundStrip } from "./RoundStrip";

describe("RoundStrip duplicate rounds", () => {
  it("keeps a restored round as its own chip", async () => {
    const present = FLAG_PRESENT | FLAG_ALIVE;
    const ticks = makeTicks(2, 2);
    ticks.ticks[0] = 64;
    ticks.ticks[1] = 800;
    const ct = present | FLAG_CT;
    ticks.flags.set([ct, present, ct, present]);
    ticks.equip[0] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[1] = FORCE_BUY_MAX_EQUIPMENT;
    ticks.equip[2] = ECO_MAX_EQUIPMENT - 1;
    ticks.equip[3] = ECO_MAX_EQUIPMENT - 1;
    const replay = makeReplay({
      ticks,
      rounds: [
        makeRound({
          number: 8,
          start_tick: 0,
          freeze_end_tick: 64,
          end_tick: 700,
          winner: "CT",
        }),
        makeRound({
          number: 8,
          start_tick: 700,
          freeze_end_tick: 800,
          end_tick: 1400,
          winner: "T",
        }),
      ],
    });
    render(<RoundStrip replay={replay} tick={100} notes={[]} places={null} />);
    const chips = await screen.findAllByRole("listitem");
    expect(chips).toHaveLength(2);
    expect(chips[0]).toHaveAccessibleName("Round 8 · T Full · CT Full");
    expect(chips[1]).toHaveAccessibleName("Round 8 · T Eco · CT Eco");
  });
});
